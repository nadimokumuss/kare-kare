import test from 'node:test'
import assert from 'node:assert/strict'
import { createSpeechEditor } from '../extension/speech-editor.js'
import { createSpeechCoach } from '../extension/speech-coach.js'
import { coachingSpeechEvents, defaultPreferences } from '../extension/coach-insights.js'

test('balanced speech suppresses repeated routine grades but never suppresses a fresh urgent warning', () => {
  let time = 0
  const preferences = { speechDetail: 'balanced' }
  const editor = createSpeechEditor(() => preferences, { now: () => time })
  const grade = { channel: 'grades', gradeCode: 'good', own: true, variationGroup: 'grade:good:true', text: 'İyi hamle.' }
  const first = editor.prepare(grade); editor.started(first)
  time = 1000
  assert.equal(editor.prepare(grade), null)
  const enemy = editor.prepare({ ...grade, own: false, variationGroup: 'grade:good:false' })
  assert.match(enemy.text, /^Rakip/)
  const urgent = { channel: 'mate', text: 'Rakip için iki hamlede mat var.', critical: true }
  assert.equal(editor.prepare(urgent).text, urgent.text)
  time = 10001
  assert.notEqual(editor.prepare(grade).text, first.text)
})

test('all-grades rotates honest short phrases without changing the grade or adding a repeated actor prefix', () => {
  const editor = createSpeechEditor(() => ({ speechDetail: 'all' }))
  for (const own of [true, false]) {
    const texts = []
    for (let index = 0; index < 3; index++) {
      const item = editor.prepare({ channel: 'grades', own, gradeCode: 'best', variationGroup: `best:${own}`, text: 'En iyi.' })
      assert.equal(item.gradeCode, 'best')
      assert.doesNotMatch(item.text, /Senin son hamlen|Rakibin son hamlesi|çatal|açmaz/)
      if (!own) assert.match(item.text, /Rakip|Rakibin/)
      texts.push(item.text); editor.started(item)
    }
    assert.equal(new Set(texts).size, 3)
  }
})

test('critical profile and not-started or manual playback do not corrupt repetition memory', () => {
  let detail = 'critical'
  const editor = createSpeechEditor(() => ({ speechDetail: detail }))
  const routine = { channel: 'grades', gradeCode: 'book', own: true, variationGroup: 'book', text: 'Kitap.' }
  assert.equal(editor.prepare(routine), null)
  assert.ok(editor.prepare({ ...routine, gradeCode: 'mistake' }))
  detail = 'balanced'
  assert.equal(editor.prepare(routine).text, editor.prepare(routine).text)
  const manual = { ...routine, kind: 'manual', text: 'İstediğin açıklama.' }
  editor.started(manual)
  assert.equal(editor.prepare(manual).text, manual.text)
  const historical = { ...routine, historical: true, text: 'Eski kitap hamlesi.' }
  assert.equal(editor.prepare(historical).text, historical.text)
  const first = editor.prepare(routine); editor.started(first); editor.reset()
  assert.equal(editor.prepare(routine).text, first.text)
})

test('the actual speech queue skips routine repetition and still starts the next critical item', () => {
  const preferences = { ...defaultPreferences, speechDetail: 'critical' }
  const editor = createSpeechEditor(() => preferences)
  const utterances = []
  const coach = createSpeechCoach({ speak: item => utterances.push(item), cancel() {}, getVoices: () => [] }, text => ({ text }),
    () => preferences, assert.fail, { prepare: editor.prepare, onStarted: editor.started })
  const fen = '8/8/8/8/8/8/K7/7k w - - 0 1'
  coach.positionChanged(fen)
  coach.enqueueMany(coachingSpeechEvents({ grade: { color: 'b', code: 'good', label: 'İyi', afterFen: fen, cue: 'İyi.' } }, { fen, playerColor: 'w' }))
  assert.equal(utterances.length, 0)
  coach.enqueue({ key: 'mate', fen, channel: 'mate', critical: true, text: 'Rakibin mat tehdidi var.' })
  assert.equal(utterances.length, 1)
  utterances[0].onstart(); utterances[0].onend()
  assert.equal(coach.getState().state, 'ready')
  coach.stop()
})

test('a completed checkmate keeps its exact announcement even in the important-grades profile', () => {
  const editor = createSpeechEditor(() => ({ speechDetail: 'critical' }))
  const item = { channel: 'grades', gradeCode: 'best', checkmate: true, own: true, text: 'Matı tamamladın.' }
  assert.equal(editor.prepare(item).text, 'Matı tamamladın.')
})
