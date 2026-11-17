import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { bookReference, gradeLabels, ordinaryGrade, positiveGrades } from '../extension/move-grades.js'
import { gradePlayedMove, reviewReport } from '../extension/coach-insights.js'
import { sacrificeEvidence } from '../extension/coach-core.js'

test('ten actual move classes have distinct labels; correction remains a separate coach state', () => {
  assert.equal(Object.keys(gradeLabels).filter(code => code !== 'correction').length, 10)
  assert.equal(new Set(Object.values(gradeLabels)).size, 11)
  const base = { loss: 0, bestMove: false, gap: 0, beforeValue: 250, afterValue: 250 }
  const examples = [
    [{ bestMove: true, sacrifice: { offered: 2 }, alternativeValue: 0 }, 'brilliant'],
    [{ bestMove: true, gap: 200 }, 'great'], [{ book: { name: 'sample' } }, 'book'],
    [{ bestMove: true }, 'best'], [{ loss: 10 }, 'excellent'], [{ loss: 35 }, 'good'],
    [{ loss: 80 }, 'inaccuracy'], [{ loss: 140 }, 'mistake'],
    [{ loss: 140, tactical: true }, 'missed'], [{ loss: 400 }, 'blunder']
  ]
  for (const [change, expected] of examples) assert.equal(ordinaryGrade({ ...base, ...change }), expected)
  assert.equal(ordinaryGrade({ ...base, bestMove: true, gap: 200, forced: true }), 'good')
  assert.notEqual(ordinaryGrade({ ...base, bestMove: true, sacrifice: { offered: 2 }, alternativeValue: 900 }), 'brilliant')
  assert.notEqual(ordinaryGrade({ ...base, bestMove: true, sacrifice: { offered: 2 }, alternativeValue: 0, afterValue: -200 }), 'brilliant')
})

test('book moves match legal named positions, including a transposition, while unknown or late moves do not', () => {
  const game = new Chess()
  assert.equal(bookReference(game.fen(), 'e2e4').source, 'Kare Kare yerel açılış referansı')
  assert.equal(bookReference(game.fen(), 'a2a4'), null)
  for (const move of ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'd5', 'Bg5']) game.move(move)
  // Same position as the QGD sample, reached by a different order.
  assert.ok(bookReference(game.fen(), 'f8e7'))
  assert.equal(bookReference(new Chess().fen().replace('0 1', '0 15'), 'e2e4'), null)
})

test('a concrete accepted piece offer requires a legal capture, a material cost and a continuation', () => {
  const fen = '6k1/5ppp/8/8/8/3B1N2/8/3Q2K1 w - - 0 1'
  const pv = ['d3h7', 'g8h7', 'f3g5']
  const evidence = sacrificeEvidence(fen, pv)
  assert.equal(evidence.offered, 2)
  assert.equal(evidence.reply, 'Kxh7')
  assert.equal(sacrificeEvidence(fen, pv.slice(0, 2)), null)
  assert.equal(sacrificeEvidence(fen, ['d3h7', 'g8h7', 'a1a8']), null)
  const game = new Chess(fen)
  const move = game.move('Bxh7+')
  const best = { uci: 'd3h7', san: move.san, depth: 16, score: { type: 'cp', value: 100 }, pv, why: 'Taş fedası.' }
  const grade = gradePlayedMove({ san: move.san, uci: best.uci, color: 'w', beforeFen: fen, afterFen: move.after, number: 1 },
    [best, { ...best, uci: 'd3e4', score: { type: 'cp', value: 0 } }], null, 'w')
  assert.equal(grade.code, 'brilliant')
})

test('new positive grades and all error severities reach postgame reports without blaming a recommendation', () => {
  const game = new Chess(); const move = game.move('e4')
  const best = { uci: 'e2e4', san: 'e4', depth: 16, score: { type: 'cp', value: 30 }, why: 'Merkez.', motifs: [] }
  const grade = gradePlayedMove({ ...move, uci: best.uci, beforeFen: move.before, afterFen: move.after, number: 1, ply: 1 }, [best], null, 'w')
  assert.equal(grade.code, 'book')
  assert.match(grade.explanation, /yerel açılış referansı/)
  assert.ok(positiveGrades.has(grade.code))
  for (const code of ['inaccuracy', 'mistake', 'missed', 'blunder']) {
    const report = reviewReport([grade, { ...grade, code, loss: 120, ply: 3, number: 2 }], 'w', 3)
    assert.match(report.overview, /1 güçlü.*1 geliştirme/)
  }
  const protectedGrade = gradePlayedMove({ ...move, uci: best.uci, beforeFen: move.before, afterFen: move.after, number: 1, shownCandidates: [best] }, [best],
    { depth: 20, score: { type: 'cp', value: 400 } }, 'w')
  assert.ok(positiveGrades.has(protectedGrade.code))
})

test('a frozen grading snapshot retains inferior alternatives that were correctly hidden from strong suggestions', () => {
  const game = new Chess('6k1/8/8/8/8/8/8/3R2K1 w - - 0 12')
  const move = game.move('Rd8+')
  const best = { uci: 'd1d8', san: move.san, depth: 16, score: { type: 'cp', value: 300 }, why: 'Etkin kale.', motifs: [] }
  const weak = { ...best, uci: 'd1d2', score: { type: 'cp', value: 0 } }
  const record = { ...move, uci: best.uci, beforeFen: move.before, afterFen: move.after, number: 12,
    shownCandidates: [best], gradingCandidates: [best, weak] }
  const drifted = [{ ...best, score: { type: 'cp', value: 0 } }, { ...weak, score: { type: 'cp', value: 0 } }]
  assert.equal(gradePlayedMove(record, drifted, null, 'w').code, 'great')
})
