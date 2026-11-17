import test from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechCoach, preferredVoice, spokenChessText } from '../extension/speech-coach.js'
import { Chess } from 'chess.js'
import { coachingSpeechEvents } from '../extension/coach-insights.js'
import { createNarrationController } from '../extension/narration.js'
import { overlayModel } from '../extension/board-overlays.js'

function fixture(extra = {}) {
  const utterances = []; let canceled = 0
  let time = 0; let nextTimer = 0; const timers = new Map(); const states = []; const errors = []
  const schedule = (callback, delay) => { const id = ++nextTimer; timers.set(id, { callback, at: time + delay }); return id }
  const tick = delay => {
    const until = time + delay
    while (true) {
      const first = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
      if (!first) break
      timers.delete(first[0]); time = first[1].at; first[1].callback()
    }
    time = until
  }
  const synthesis = { getVoices: () => [], speak: utterance => utterances.push(utterance), cancel: () => { canceled++ } }
  const coach = createSpeechCoach(synthesis, text => ({ text }), () => ({ voiceRate: 1, voiceName: '' }), error => errors.push(error),
    { schedule, unschedule: id => timers.delete(id), now: () => time, onState: state => states.push(state), ...extra })
  return { coach, utterances, canceled: () => canceled, tick, states, errors, synthesis }
}

test('a changing board interrupts a current warning and replaces it with an explicitly past-tense note', () => {
  const { coach, utterances, canceled, tick } = fixture()
  coach.positionChanged('A')
  coach.enqueue({ key: 'mate', fen: 'A', critical: true, text: 'Siyah için iki hamlede mat.', historicalText: 'Siyah için mat hesaplanmıştı.' })
  coach.positionChanged('B')
  assert.equal(canceled(), 1)
  utterances[0].onend(); utterances[0].onerror({ error: 'canceled' })
  tick(60)
  assert.match(utterances[1].text, /^Geçmiş konum\./)
  assert.match(utterances[1].text, /hesaplanmıştı/)
  assert.doesNotMatch(utterances[1].text, /hamlede şah matı\./)
  assert.equal(coach.getState().historical, true)
})

test('an obsolete ordinary suggestion is canceled without throwing away a queued critical note', () => {
  const { coach, utterances, canceled, tick } = fixture()
  coach.positionChanged('A')
  coach.enqueue({ key: 'suggestion', fen: 'A', critical: false, text: 'Sen Nf3 oynayabilirsin.' })
  coach.enqueue({ key: 'warning', fen: 'A', critical: true, text: 'Rakibin açmazına dikkat.', historicalText: 'Rakip için açmaz hesaplanmıştı.' })
  assert.equal(canceled(), 1)
  coach.positionChanged('B')
  assert.equal(canceled(), 1)
  tick(60)
  assert.match(utterances[1].text, /açmaz/)
  coach.stop()
  assert.equal(canceled(), 2)
})

test('a speech request that never starts retries once and surfaces the failure instead of locking silently', () => {
  const { coach, utterances, tick, errors, states } = fixture()
  coach.enqueue({ key: 'a', text: 'Ses denemesi.', critical: true })
  assert.equal(coach.getState().state, 'starting')
  tick(5060)
  assert.equal(utterances.length, 2)
  tick(5000)
  assert.deepEqual(errors, ['speech-start-timeout'])
  assert.equal(coach.getState().state, 'error')
  assert.ok(states.some(state => state.state === 'recovering'))
  coach.enqueue({ key: 'b', text: 'Yeni deneme.', critical: true })
  assert.equal(utterances.length, 2)
  coach.unlock()
  assert.equal(utterances.length, 3)
  utterances[2].onstart(); utterances[2].onend()
  assert.equal(coach.getState().state, 'ready')
})

test('late cancel callbacks cannot swallow the next utterance and a suspended service is resumed', () => {
  const { coach, utterances, tick, synthesis } = fixture()
  let resumed = 0
  synthesis.paused = true; synthesis.resume = () => { resumed++; synthesis.paused = false }
  coach.positionChanged('A')
  coach.unlock()
  coach.enqueue({ key: 'ordinary', text: 'Atını geliştir.', fen: 'A' })
  coach.enqueue({ key: 'mate', text: 'İki hamlede mat.', fen: 'A', critical: true })
  utterances[0].onerror({ error: 'canceled' })
  tick(60)
  assert.equal(utterances.length, 2)
  assert.equal(resumed, 1)
  utterances[1].onstart(); utterances[1].onend()
  assert.equal(coach.getState().state, 'ready')
})

test('a browser permission failure is reported without repeated automatic attempts', () => {
  const { coach, utterances, errors, tick } = fixture()
  coach.enqueue({ key: 'manual', text: 'Ses denemesi.', critical: true })
  utterances[0].onerror({ error: 'not-allowed' })
  tick(30000)
  assert.equal(utterances.length, 1)
  assert.deepEqual(errors, ['not-allowed'])
  assert.equal(coach.getState().state, 'error')
})

test('speech reads Turkish square names and selects an available Turkish voice', () => {
  const text = spokenChessText('Sen Nf3 oynayabilirsin. Rakip Bxe2+ oynarsa O-O yap.')
  assert.match(text, /at fe üç/)
  assert.match(text, /fil alır e iki şah/)
  assert.match(text, /kısa rok/)
  assert.doesNotMatch(text, /Nf3|Bxe2/)
  const voices = [{ name: 'English', lang: 'en-US' }, { name: 'Turkish', lang: 'tr-TR' }, { name: 'Turkish Enhanced', lang: 'tr-TR' }]
  assert.equal(preferredVoice(voices).name, 'Turkish Enhanced')
  assert.equal(preferredVoice(voices, 'Turkish').name, 'Turkish')
})

test('four rapid half-moves keep the actor fixed for both player colors and retain only two recent past notes', () => {
  for (const playerColor of ['w', 'b']) {
    const { coach, utterances, tick } = fixture()
    const game = new Chess()
    coach.positionChanged(game.fen())
    let ply = 0
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) {
      const move = game.move(san); ply++
      const fen = game.fen()
      coach.positionChanged(fen)
      const events = coachingSpeechEvents({ grade: { afterFen: fen, color: move.color, ply,
        code: 'blunder', label: 'Büyük hata', cue: move.color === playerColor ? 'Büyük hata yaptın.' : 'Rakip büyük hata yaptı.' } }, { fen, playerColor })
      coach.enqueueMany(events.map(item => ({ ...item, context: `${ply}. yarım hamle` })))
    }
    // A canceled native request may send callbacks long after the board advances.
    utterances[0].onend(); utterances[0].onerror({ error: 'canceled' })
    tick(60)
    const own = playerColor === 'b'
    assert.match(utterances[1].text, own ? /^Büyük hata/ : /^Rakip büyük hata/)
    assert.equal(coach.getState().role, own ? 'Senin hamlen' : 'Rakibin hamlesi')
    utterances[1].onend()
    assert.match(utterances[2].text, /^Geçmiş konum\. 3\. yarım hamle/)
    assert.match(utterances[2].text, playerColor === 'w' ? /Senin hamlen büyük hata/ : /Rakibin hamlesi büyük hata/)
    assert.doesNotMatch(utterances[2].text, /yaptın|yaptı\./)
    utterances[2].onend()
    assert.match(utterances[3].text, /^Geçmiş konum\. 2\. yarım hamle/)
    utterances[3].onend()
    assert.equal(utterances.length, 4)
    assert.equal(coach.getState().queued, 0)
    coach.stop()
  }
})

test('a current mate goes first in a batch and interrupts historical speech or a current grade', () => {
  const { coach, utterances, tick, canceled } = fixture()
  coach.positionChanged('A')
  const grade = { key: 'grade', fen: 'A', channel: 'grades', text: 'Senin son hamlen: büyük hata.',
    critical: true, priority: 2, historicalText: 'Senin hamlen büyük hata olarak değerlendirildi.' }
  const mate = { key: 'mate', fen: 'A', channel: 'mate', text: 'Bu konumda rakip için iki hamlede mat var.', critical: true, priority: 4 }
  coach.enqueueMany([grade, mate])
  assert.match(utterances[0].text, /Bu konumda rakip/)
  utterances[0].onend()
  coach.positionChanged('B'); tick(60)
  assert.match(utterances[2].text, /^Geçmiş konum/)
  coach.enqueue({ ...mate, key: 'fresh', fen: 'B' })
  assert.equal(canceled(), 2)
  tick(60)
  assert.match(utterances[3].text, /^Bu konumda rakip/)
  coach.stop()

  const next = fixture()
  next.coach.positionChanged('A'); next.coach.enqueue(grade); next.coach.enqueue(mate)
  next.tick(60)
  assert.match(next.utterances[1].text, /^Bu konumda rakip/)
  next.coach.stop()
})

test('past notes expire by time and unverified positions reject late speech', () => {
  const { coach, utterances, tick, canceled } = fixture()
  coach.positionChanged('B')
  coach.enqueue({ key: 'manual', text: 'İstediğin açıklama.', kind: 'manual', critical: true })
  utterances[0].onstart()
  coach.enqueue({ key: 'old', fen: 'A', critical: true, text: 'Eski uyarı.', historicalText: 'Eski bir fikir hesaplanmıştı.' })
  tick(12001)
  utterances[0].onend()
  assert.equal(utterances.length, 1)
  assert.equal(coach.getState().queued, 0)
  coach.enqueue({ key: 'new', fen: 'B', critical: true, text: 'Güncel uyarı.' })
  coach.positionChanged('unverified')
  coach.enqueue({ key: 'late', fen: 'B', critical: true, text: 'Geç kalan uyarı.', historicalText: 'Eski fikir.' })
  tick(60)
  assert.equal(canceled(), 1)
  assert.equal(utterances.length, 2)
  assert.equal(coach.getState().queued, 0)
  coach.enqueue({ key: 'test-voice', kind: 'manual', critical: true, text: 'Ses denemesi.', fen: null })
  assert.equal(utterances.length, 3)
  coach.enqueue({ key: 'late-again', fen: 'B', critical: true, text: 'Geç kalan uyarı.', historicalText: 'Eski fikir.' })
  assert.equal(coach.getState().queued, 0)
  coach.stop()
})

test('manual commentary and expired ordinary suggestions never become automatic historical advice', () => {
  const { coach, utterances, tick } = fixture()
  coach.positionChanged('A')
  coach.enqueue({ key: 'manual', fen: 'A', kind: 'manual', critical: true, text: 'Sen bu taşı alabilirsin.' })
  coach.enqueue({ key: 'suggestion', fen: 'A', text: 'Şimdi atını geliştir.' })
  coach.positionChanged('B'); tick(60)
  assert.equal(utterances.length, 1)
  assert.equal(coach.getState().queued, 0)
})

test('a historical replacement retains the one-retry limit on missing speech events', () => {
  const { coach, utterances, tick, errors } = fixture()
  coach.positionChanged('A')
  coach.enqueue({ key: 'old', fen: 'A', critical: true, text: 'Güncel uyarı.', historicalText: 'Eski fikir hesaplanmıştı.' })
  coach.positionChanged('B'); tick(60)
  tick(5060); tick(5000)
  assert.equal(utterances.length, 3)
  assert.deepEqual(errors, ['speech-start-timeout'])
})

test('manual section requests replace each other immediately and keep a non-mate critical note available afterwards', () => {
  const { coach, utterances, tick, canceled } = fixture()
  coach.positionChanged('A')
  coach.enqueue({ key: 'grade', fen: 'A', critical: true, channel: 'grades', text: 'Kritik hamle değerlendirmesi.' })
  utterances[0].onstart()
  coach.request({ key: 'plan', fen: 'A', text: 'Planı dinle.' })
  coach.request({ key: 'opponent', fen: 'A', text: 'Rakibin cevabını dinle.' })
  utterances[0].onend()
  tick(60)
  assert.equal(canceled(), 1)
  assert.equal(utterances[1].text, 'Rakibin cevabını dinle.')
  assert.equal(utterances.length, 2)
  utterances[1].onend()
  assert.equal(utterances[2].text, 'Kritik hamle değerlendirmesi.')
  coach.stop()
})

test('a current urgent mate takes precedence over a manual section and can interrupt one that already started', () => {
  const { coach, utterances, tick, canceled } = fixture()
  coach.positionChanged('A')
  coach.enqueue({ key: 'mate', fen: 'A', critical: true, channel: 'mate', text: 'Acil mat uyarısı.' })
  coach.request({ key: 'plan', fen: 'A', text: 'Planın ayrıntısı.' })
  assert.equal(canceled(), 0)
  utterances[0].onend()
  assert.equal(utterances[1].text, 'Planın ayrıntısı.')
  coach.enqueue({ key: 'mate-new', fen: 'A', critical: true, channel: 'mate', text: 'Yeni mat uyarısı.' })
  assert.equal(canceled(), 1); tick(60)
  assert.match(utterances[2].text, /^Yeni şah matı/)
  coach.stop()
})

test('position changes cancel manual commentary; an unverified board only permits a position-independent voice test', () => {
  const { coach, utterances, tick } = fixture()
  coach.positionChanged('A'); coach.request({ key: 'manual', fen: 'A', text: 'Atını geliştir.' })
  coach.positionChanged('B'); tick(60)
  assert.equal(utterances.length, 1); assert.equal(coach.getState().queued, 0)
  coach.positionChanged('unverified'); coach.request({ key: 'blocked', fen: 'B', text: 'Eski konum.' })
  assert.equal(utterances.length, 1)
  coach.request({ key: 'test', text: 'Ses denemesi.' })
  assert.equal(utterances.length, 2)
  coach.stop()
})

test('an automatic retry rebuilds the transport and later fresh information can recover from a temporary failure', () => {
  const { coach, synthesis, utterances, tick } = fixture(); let resets = 0
  synthesis.reset = () => resets++
  coach.positionChanged('A'); coach.enqueue({ key: 'first', fen: 'A', text: 'İlk açıklama.' })
  utterances[0].onerror({ error: 'speech-connection-lost' }); tick(60)
  assert.equal(resets, 1); assert.equal(utterances.length, 2)
  utterances[1].onerror({ error: 'speech-start-timeout' })
  assert.equal(coach.getState().blocked, true)
  tick(3000)
  assert.equal(utterances.length, 2, 'no infinite idle retry loop')
  coach.positionChanged('B'); coach.enqueue({ key: 'new', fen: 'B', text: 'Yeni konumun açıklaması.' })
  assert.equal(utterances.length, 3); assert.equal(resets, 2)
  assert.equal(utterances[2].text, 'Yeni konumun açıklaması.')
  utterances[2].onstart(); utterances[2].onend()
  assert.equal(coach.getState().state, 'ready'); assert.equal(coach.getState().blocked, false)
  coach.stop()
})

test('permission failures remain blocked even on new positions and an intentional stop cancels recovery', () => {
  const { coach, synthesis, utterances, tick } = fixture(); let resets = 0
  synthesis.reset = () => resets++
  coach.positionChanged('A'); coach.enqueue({ key: 'first', fen: 'A', text: 'Bir açıklama.' })
  utterances[0].onerror({ error: 'not-allowed' }); tick(60000)
  coach.positionChanged('B'); coach.enqueue({ key: 'new', fen: 'B', text: 'Diğer açıklama.' })
  assert.equal(utterances.length, 1); assert.equal(resets, 0)
  coach.stop(); tick(60000)
  assert.equal(utterances.length, 1); assert.equal(coach.getState().recoverAfter, null)
})

test('a valid long explanation is not forcibly cancelled at the former 90-second limit', () => {
  const { coach, utterances, tick, errors } = fixture()
  coach.request({ key: 'long', text: 'Açıklayıcı bir cümle. '.repeat(70) })
  utterances[0].onstart(); tick(90001)
  assert.equal(coach.getState().state, 'speaking'); assert.deepEqual(errors, [])
  utterances[0].onend(); assert.equal(coach.getState().state, 'ready')
  coach.stop()
})

test('narration cues follow actual starts, not enqueue/end, and late callbacks cannot advance another segment', () => {
  const cues = [], started = []
  const { coach, utterances } = fixture({ onSegment: (item, segment) => cues.push(segment.cue?.label), onStarted: item => started.push(item.key) })
  coach.positionChanged('A')
  coach.request({ key: 'explanation', fen: 'A', text: 'İlk açıklama. İkinci açıklama.', segments: [
    { text: 'İlk açıklama.', cue: { fen: 'A', label: 'move' } }, { text: 'İkinci açıklama.', cue: { fen: 'A', label: 'targets' } }
  ] })
  assert.deepEqual(cues, [])
  utterances[0].onstart(); utterances[0].onstart(); assert.deepEqual(cues, ['move'])
  utterances[0].onend(); assert.equal(utterances.length, 2); assert.deepEqual(cues, ['move'])
  utterances[0].onstart(); utterances[0].onend(); assert.equal(utterances.length, 2)
  utterances[1].onstart(); assert.deepEqual(cues, ['move','targets']); assert.deepEqual(started, ['explanation'])
  utterances[1].onend(); assert.equal(coach.getState().state, 'ready'); coach.stop()
})

test('a failed second segment retries only that segment and records the logical start once', () => {
  const starts = [], cues = []
  const { coach, utterances, tick } = fixture({ onStarted: item => starts.push(item.key), onSegment: (item, segment) => cues.push(segment.cue?.label) })
  coach.positionChanged('A'); coach.request({ key: 'plan', fen: 'A', text: 'Birinci bölüm. İkinci bölüm.', segments: [
    { text: 'Birinci bölüm.', cue: { label: 'first' } }, { text: 'İkinci bölüm.', cue: { label: 'second' } }
  ] })
  utterances[0].onstart(); utterances[0].onend()
  utterances[1].onerror({ error: 'speech-connection-lost' }); tick(60)
  assert.equal(utterances[2].text, 'İkinci bölüm.')
  utterances[2].onstart(); assert.deepEqual(starts, ['plan']); assert.deepEqual(cues, ['first','second'])
  utterances[1].onend(); assert.equal(coach.getState().state, 'speaking')
  utterances[2].onend(); coach.stop()
})

test('position changes and stop cancel all remaining segments and their late starts cannot publish cues', () => {
  const cues = [], { coach, utterances, tick } = fixture({ onSegment: (item, segment) => cues.push(segment.cue?.label) })
  coach.positionChanged('A'); coach.request({ key: 'old', fen: 'A', text: 'Birinci bölüm. İkinci bölüm.', segments: [
    { text: 'Birinci bölüm.', cue: { label: 'old-first' } }, { text: 'İkinci bölüm.', cue: { label: 'old-second' } }
  ] })
  utterances[0].onstart(); utterances[0].onend()
  coach.positionChanged('B'); tick(60); utterances[1].onstart(); utterances[1].onend()
  assert.deepEqual(cues, ['old-first']); assert.equal(utterances.length, 2)
  coach.request({ key: 'new', fen: 'B', text: 'Yeni konum.' }); coach.stop()
  utterances[2].onstart(); utterances[2].onend(); assert.deepEqual(cues, ['old-first'])
})

test('historical replacements drop visual segments and mismatched segment text fails closed', () => {
  const cues = [], { coach, utterances, tick } = fixture({ onSegment: (item, segment) => cues.push(segment.cue) })
  coach.positionChanged('A'); coach.enqueue({ key: 'old', fen: 'A', text: 'Güncel uyarı.', historicalText: 'Eski fikir hesaplanmıştı.', critical: true,
    segments: [{ text: 'Güncel uyarı.', cue: { label: 'old-move' } }] })
  coach.positionChanged('B'); tick(60)
  utterances[1].onstart(); assert.match(utterances[1].text, /^Geçmiş konum/); assert.deepEqual(cues, [null])
  utterances[1].onend()
  coach.request({ key: 'mismatch', fen: 'B', text: 'Asıl açıklama.', segments: [{ text: 'Farklı bir metin.', cue: { label: 'wrong' } }] })
  utterances[2].onstart(); assert.equal(utterances[2].text, 'Asıl açıklama.'); assert.deepEqual(cues, [null,null])
  coach.stop()
})

test('speech gaps and cue-free sentences hide idle arrows until completion, stop or failure restores the latest choices', () => {
  const narration = createNarrationController(() => ({ narrationMode: 'all' }))
  const { coach, utterances, tick } = fixture({
    onState: state => { if (state.state === 'starting') narration.nextSegment(); else if (state.state !== 'speaking') narration.clear() },
    onSegment: (item, segment) => narration.start(item, segment, { fen: 'A', verified: true })
  })
  let candidates = [{from:'e2',to:'e4',color:'w'}], enabled = true
  const model = () => overlayModel({ candidates, showCandidates: enabled, narration: narration.cue, narrating: narration.playing })
  const segments = [{text:'İlk adım.',cue:{fen:'A',moves:[{from:'e2',to:'e4'}]}},{text:'Devamı rakibin cevabına bağlı.',cue:null}]
  coach.positionChanged('A'); coach.request({key:'listen',fen:'A',text:segments.map(part=>part.text).join(' '),segments})
  utterances[0].onstart(); assert.equal(model().staticMoves.length,0)
  utterances[0].onend(); assert.equal(narration.playing,true); assert.equal(model().staticMoves.length,0)
  utterances[1].onstart(); assert.equal(narration.cue,null); assert.equal(model().staticMoves.length,0)
  candidates=[{from:'d2',to:'d4',color:'w'}]
  utterances[1].onend(); assert.equal(narration.playing,false); assert.equal(model().staticMoves[0].to,'d4')
  coach.request({key:'stop',fen:'A',text:'İlk adım.',segments:[segments[0]]});utterances[2].onstart()
  enabled=false; coach.stop(); assert.equal(narration.playing,false); assert.equal(model().staticMoves.length,0)
  utterances[2].onstart();assert.equal(narration.cue,null)
  enabled=true;coach.request({key:'failure',fen:'A',text:'İlk adım.',segments:[segments[0]]});tick(60)
  utterances.at(-1).onstart();utterances.at(-1).onerror({error:'not-allowed'})
  assert.equal(narration.playing,false);assert.equal(model().staticMoves[0].to,'d4')
  coach.stop()
})
