import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { describeLines, tacticalMotifs } from '../extension/coach-core.js'
import { coachingSpeechEvents, defaultPreferences, gradePlayedMove, matchesArrowShortcut, positionAlerts, positionEvaluation, reviewReport, speechForEvents } from '../extension/coach-insights.js'

test('passed-pawn explanations accept chess.js get() pieces without a square property', () => {
  const fen = '7k/8/8/8/8/8/P7/K7 w - - 0 1'
  const candidates = describeLines(fen, [{ depth: 14, score: { type: 'cp', value: 300 }, pv: ['a2a4', 'h8h7', 'a4a5'] }])
  assert.match(candidates[0].why, /[Gg]eçer piyonun/)
  assert.match(candidates[0].continuationWhy, /[Gg]eçer piyonun/)
})

test('new absolute pins and king–queen skewers name their concrete targets', () => {
  const pin = tacticalMotifs('4k3/4n3/8/8/8/8/R7/6K1 w - - 0 1', 'a2e2').find(item => item.type === 'pin')
  assert.deepEqual(pin.targets, ['e7', 'e8'])
  assert.equal(pin.absolute, true)
  const skewer = tacticalMotifs('3k1q2/8/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8').find(item => item.type === 'skewer')
  assert.deepEqual(skewer.targets, ['d8', 'f8'])
})

test('evaluation always uses White’s perspective and hides unsupported scores', () => {
  const fen = new Chess().fen().replace(' w ', ' b ')
  assert.equal(positionEvaluation(fen, { type: 'cp', value: 220 }).text, '-2.2')
  assert.ok(positionEvaluation(fen, { type: 'cp', value: 220 }).whitePercent < 50)
  assert.match(positionEvaluation(fen, { type: 'mate', value: -3 }).text, /M3.*Beyaz/)
  assert.equal(positionEvaluation(fen, null), null)
})

test('mate alerts use the current side’s score and never invent a five-move mate from a long score', () => {
  const fen = '7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'
  const lines = describeLines(fen, [{ depth: 14, score: { type: 'mate', value: 1 }, pv: ['f7f8'] }])
  const alert = positionAlerts(fen, lines).find(item => item.channel === 'mate')
  assert.equal(alert.color, 'w')
  assert.match(alert.text, /1 hamlede/)
  assert.equal(positionAlerts(fen, [{ ...lines[0], score: { type: 'mate', value: 6 } }]).some(item => item.channel === 'mate'), false)
  assert.equal(positionAlerts(fen.replace(' w ', ' b '), [{ ...lines[0], answerUci: null, motifs: [], score: { type: 'mate', value: -3 } }])[0].color, 'w')
})

const candidate = (score, extra = {}) => ({ uci: 'e2e4', san: 'e4', depth: 14, score: { type: 'cp', value: score }, why: 'Merkezi kontrol eder.', motifs: [], ...extra })
const record = { san: 'f3', uci: 'f2f3', color: 'w', number: 1, legalCount: 20, beforeFen: new Chess().fen(), afterFen: 'after', ply: 1 }

test('both sides are graded with score reversal, while shallow searches get no grade', () => {
  const grade = gradePlayedMove(record, [candidate(30)], candidate(350), 'b')
  assert.equal(grade.code, 'blunder')
  assert.equal(grade.actor, 'Rakip')
  assert.equal(grade.loss, 380)
  assert.match(grade.cue, /açığı/)
  assert.equal(gradePlayedMove(record, [candidate(30, { depth: 6 })], candidate(350), 'w'), null)
})

test('great moves need a concrete idea; forced replies and already lost mates are not praised as discoveries', () => {
  const best = candidate(300, { motifs: [{ type: 'fork', label: 'Çatal' }] })
  assert.equal(gradePlayedMove({ ...record, uci: 'e2e4' }, [best, candidate(50, { uci: 'd2d4' })], null, 'w').code, 'great')
  assert.equal(gradePlayedMove({ ...record, uci: 'e2e4', legalCount: 1 }, [best, candidate(50)], null, 'w').code, 'good')
  const losing = candidate(0, { score: { type: 'mate', value: -4 } })
  assert.equal(gradePlayedMove(record, [losing], candidate(0, { score: { type: 'mate', value: 2 } }), 'w').code, 'good')
})

test('a lost winning mate is a missed opportunity and an actual checkmate can be graded', () => {
  const mating = candidate(0, { score: { type: 'mate', value: 3 }, motifs: [{ type: 'mate', label: 'Mat' }] })
  assert.equal(gradePlayedMove(record, [mating], candidate(-900), 'w').code, 'missed')
  assert.equal(gradePlayedMove({ ...record, san: 'Qf8#', uci: 'f7f8' }, [mating], { depth: 99, score: { type: 'mate', value: 0 } }, 'w').code, 'best')
  const blunder = gradePlayedMove({ ...record, san: 'g4' }, [candidate(0)], candidate(0, { san: 'Qh4#', score: { type: 'mate', value: 1 } }), 'w')
  assert.match(blunder.explanation, /g4 sonrası rakip Qh4# ile 1 hamlede zorunlu mat/)
  assert.equal(blunder.motif, 'Mat savunması')
  const wasCandidate = [candidate(0), candidate(-30, { uci: record.uci })]
  assert.equal(gradePlayedMove(record, wasCandidate, candidate(0, { score: { type: 'mate', value: 1 } }), 'w').code, 'blunder')
})

test('speech channels do not leak a move suggestion into a grades-only or tactics-only setting', () => {
  const events = { grade: { cue: 'Rakip büyük hata yaptı.' }, suggestion: 'Nc5+ oyna.', alerts: [{ channel: 'pin', spoken: 'Beyaz için açmaz fırsatı.' }] }
  const none = Object.fromEntries(Object.keys(defaultPreferences).map(key => [key, false]))
  assert.equal(speechForEvents(events, { ...none, grades: true }), 'Rakip büyük hata yaptı.')
  assert.equal(speechForEvents(events, { ...none, pin: true }), 'Beyaz için açmaz fırsatı.')
  assert.doesNotMatch(speechForEvents(events, { ...defaultPreferences, hideMoves: true }), /Nc5/)
})

test('conditional speech names the setup actor and reply actor for either player color without claiming a played move', () => {
  const fen = new Chess().fen()
  const alert = { channel: 'fork', type: 'fork', color: 'b', conditional: true, setupMove: 'e4', move: 'Nf6', targets: ['a1', 'd1'] }
  const ownSetup = coachingSpeechEvents({ alerts: [alert] }, { fen, playerColor: 'w' })[0]
  assert.equal(ownSetup.text, 'Sen e4 oynarsan, rakip Nf6 ile çatal fikrini kullanabilir.')
  const otherSetup = coachingSpeechEvents({ alerts: [alert] }, { fen, playerColor: 'b' })[0]
  assert.equal(otherSetup.text, 'Rakip e4 oynarsa, sen Nf6 ile çatal fikrini kullanabilirsin.')
  assert.equal(ownSetup.role, 'Rakibin taktiği')
  assert.equal(otherSetup.role, 'Senin taktiğin')
  assert.match(ownSetup.historicalText, /koşullu.*ilk hamleye bağlıydı/)
  assert.notEqual(ownSetup.key, coachingSpeechEvents({ alerts: [{ ...alert, setupMove: 'd4' }] }, { fen, playerColor: 'w' })[0].key)
  const hidden = speechForEvents({ alerts: [alert], suggestion: 'Nf3 oyna.' }, { ...defaultPreferences, hideMoves: true }, { fen, playerColor: 'w' })
  assert.equal(hidden, 'Önerilen hamleyi oynarsan, rakip için çatal fırsatı doğabilir.')
  assert.doesNotMatch(hidden, /e4|Nf6|Nf3/)
})

test('manual summary labels a delayed assessment as historical and preserves the recorded mover', () => {
  const game = new Chess()
  game.move('e4'); const afterFen = game.fen()
  game.move('e5')
  const grade = { afterFen, ply: 1, color: 'w', code: 'blunder', label: 'Büyük hata', cue: 'Büyük hata yaptın.' }
  const text = speechForEvents({ grade }, defaultPreferences, { fen: game.fen(), playerColor: 'w', historyContext: () => '1. Beyaz e4 sonrası' })
  assert.match(text, /^Geçmiş konum\. 1\. Beyaz e4 sonrası\. Senin hamlen büyük hata olarak değerlendirildi\./)
  assert.doesNotMatch(text, /son hamlen|yaptın/)
  const opponent = coachingSpeechEvents({ grade }, { fen: afterFen, playerColor: 'b' })[0]
  assert.match(opponent.text, /^Rakip büyük hata/)
  assert.doesNotMatch(opponent.text, /yaptın|son hamlesi:/)
  assert.equal(opponent.role, 'Rakibin hamlesi')
})

test('arrow shortcuts work while collapsed and ignore typing and key repeats', () => {
  const event = { code: 'KeyO', altKey: true, shiftKey: false, target: { closest: () => null } }
  assert.equal(matchesArrowShortcut(event), true)
  assert.equal(matchesArrowShortcut({ ...event, target: { closest: () => ({}) } }), false)
  assert.equal(matchesArrowShortcut({ ...event, repeat: true }), false)
  assert.equal(matchesArrowShortcut({ ...event, shiftKey: true }, 'Alt+Shift+O'), true)
})

test('postgame notes use the player’s observed examples and distinguish one issue from a repeated pattern', () => {
  const own = { ...record, code: 'missed', label: 'Kaçırılan hamle', loss: 140, motif: 'Çatal', best: candidate(100) }
  const enemy = { ...own, color: 'b', loss: 500, motif: 'Mat' }
  const report = reviewReport([own, enemy], 'w', 40, true)
  assert.equal(report.moments.length, 1)
  assert.equal(report.recurring, false)
  assert.equal('practice' in report, false)
  assert.equal(report.moments[0].number, 1)
  assert.equal(reviewReport([own, { ...own, number: 10 }], 'w', 40).recurring, true)
  assert.equal(reviewReport([], 'w', 40).moments.length, 0)
  const gift = { ...enemy, code: 'blunder', ply: 2, number: 1, san: 'f6' }
  const response = { ...own, ply: 3, san: 'Nc3', best: candidate(100) }
  assert.match(reviewReport([gift, response], 'w', 4).opportunity.text, /f6.*Nc3 yerine e4/)
})


test('a direct mate alert can be rendered and voiced without a motif label', () => {
 const alerts = [{ type: 'mate', channel: 'mate', color: 'b', mateIn: 1, conditional: false }]
 const entries = coachingSpeechEvents({ alerts }, { fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2', playerColor: 'w' })
 assert.match(entries[0].text, /rakip için 1 hamlede zorunlu mat/)
 assert.equal(entries[0].critical, true)
})
