import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { describeLines, explainedMotifs, tacticalMotifs, variationMoves } from '../extension/coach-core.js'
import { coachingSpeechEvents, positionAlerts } from '../extension/coach-insights.js'

const samples = [
  ['doubleCheck', '4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1', ['e2b5', 'e8f7', 'e1e7']],
  ['discoveredCheck', '4k3/8/8/8/8/8/4B3/4R1K1 w - - 0 1', ['e2c4', 'e8d7', 'e1e7']],
  ['discoveredAttack', 'k3q3/8/8/8/8/8/4B3/4R1K1 w - - 0 1', ['e2c4', 'a8b7', 'e1e8']],
  ['removeDefender', '7k/8/5n2/3r2B1/8/8/8/3Q2K1 w - - 0 1', ['g5f6', 'h8g8', 'd1d5']],
  ['deflection', '6k1/8/5n2/3r4/8/4B3/8/6KQ w - - 0 1', ['e3g5', 'f6h7', 'h1d5']],
  ['zwischenzug', '4k3/8/8/3r4/8/8/4B3/3Q2K1 w - - 0 1', ['e2b5', 'e8f7', 'd1d5']]
]

test('six new motifs have legal concrete examples and appear in explanations and both perspectives', () => {
  for (const [type, fen, pv] of samples) {
    assert.equal(variationMoves(fen, pv).length, 3, type)
    const motif = explainedMotifs(fen, pv).find(item => item.type === type)
    assert.ok(motif, type)
    assert.ok(motif.lesson, type)
    if (!['doubleCheck', 'discoveredCheck'].includes(type)) assert.ok(motif.evidence, type)
    const candidates = describeLines(fen, [{ depth: 16, score: { type: 'cp', value: 300 }, pv }])
    assert.ok(candidates[0].why.includes(motif.lesson), type)
    const alert = positionAlerts(fen, candidates).find(item => item.type === type && !item.conditional)
    assert.ok(alert, type)
    for (const playerColor of ['w', 'b']) {
      const speech = coachingSpeechEvents({ alerts: [alert] }, { fen, playerColor })[0]
      assert.doesNotMatch(speech.text, /undefined|NaN/)
      assert.equal(speech.role, playerColor === 'w' ? 'Senin taktiğin' : 'Rakibin taktiği')
    }
  }
})

test('double check requires two actual checkers and every legal evasion moves the king', () => {
  const [, fen, pv] = samples[0]
  const game = new Chess(fen); game.move({ from: 'e2', to: 'b5' })
  assert.ok(game.moves({ verbose: true }).every(move => move.piece === 'k'))
  assert.ok(tacticalMotifs(fen, pv[0]).some(motif => motif.type === 'doubleCheck'))
  assert.equal(tacticalMotifs(fen, 'e2c4').some(motif => motif.type === 'doubleCheck'), false)
})

test('a discovered attack is not public advice when the target escapes or the continuation is missing', () => {
  const [, fen] = samples[2]
  assert.equal(explainedMotifs(fen, ['e2c4', 'e8d7', 'e1e8']).some(motif => motif.type === 'discoveredAttack'), false)
  assert.equal(explainedMotifs(fen, ['e2c4']).some(motif => motif.type === 'discoveredAttack'), false)
  assert.equal(explainedMotifs(fen, ['e2c4', 'a1a1', 'e1e8']).some(motif => motif.type === 'discoveredAttack'), false)
})

test('removing a pinned defender or failing to exploit the target does not create a false opportunity', () => {
  const pinned = '5k2/8/5n2/3r2B1/8/8/8/3Q1RK1 w - - 0 1'
  assert.equal(explainedMotifs(pinned, ['g5f6', 'f8g8', 'd1d5']).some(motif => motif.type === 'removeDefender'), false)
  const [, fen] = samples[3]
  assert.equal(explainedMotifs(fen, ['g5f6', 'h8g8', 'd1d2']).some(motif => motif.type === 'removeDefender'), false)
})

test('a quiet developing move is not an intermediate check and missing followups are not defender tactics', () => {
  const [, fen] = samples[5]
  assert.equal(explainedMotifs(fen, ['e2c4', 'e8f7', 'd1d5']).some(motif => motif.type === 'zwischenzug'), false)
  assert.equal(explainedMotifs(samples[4][1], samples[4][2].slice(0, 2)).some(motif => motif.type === 'deflection'), false)
})
