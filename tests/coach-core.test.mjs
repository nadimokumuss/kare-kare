import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { assessPlayedMove, compareAlternative, describeLines, loosePieces, positionIntro, scanTactics, summary, tacticalSearchQueue } from '../extension/coach-core.js'

test('the coach names the concrete queen threat and shows the reply', () => {
  const game = new Chess()
  for (const san of ['e4', 'c5', 'd4', 'cxd4', 'Qxd4', 'Nc6']) game.move(san)
  const candidates = describeLines(game.fen(), [{ rank: 1, depth: 11, pv: ['d4d3', 'g8f6', 'b1c3'] }])
  assert.equal(loosePieces(game, 'w')[0].square, 'd4')
  assert.equal(candidates[0].san, 'Qd3')
  assert.equal(candidates[0].answer, 'Nf6')
  assert.equal(candidates[0].continuation, 'Nc3')
  assert.match(positionIntro(game, 'w', null, candidates).body, /d4/)
})

test('the coach distinguishes opponent replies from player candidates', () => {
  const game = new Chess()
  game.move('e4')
  const candidates = describeLines(game.fen(), [{ rank: 1, depth: 11, pv: ['e7e5', 'g1f3', 'b8c6'] }])
  assert.equal(candidates[0].san, 'e5')
  assert.equal(candidates[0].answer, 'Nf3')
  assert.match(positionIntro(game, 'w', null, candidates).title, /Rakibin/)
})

test('Turkish explanations use correct piece endings', () => {
  const game = new Chess()
  const candidate = describeLines(game.fen(), [{ rank: 1, depth: 11, pv: ['g1f3', 'g8f6'] }])[0]
  assert.match(candidate.why, /Atı f3 karesine geliştirir.*d4.*e5/)
})

test('the end note reports observed patterns without inventing errors', () => {
  assert.deepEqual(summary([]).lessons, [])
  assert.deepEqual(summary([{ loss: 220, kind: 'missedTactic', text: '21. hamlede çatal fırsatı' }]).lessons, ['21. hamlede çatal fırsatı'])
})

test('the coach explains the actual 21.Nc5+ king–queen fork, reply and payoff', () => {
  const fen = 'rn3Qn1/1k1q2p1/p1p1N3/1p1p4/3P4/4B2r/PP2BP1P/2KR3R w - - 1 21'
  const candidates = describeLines(fen, [{ rank: 1, depth: 11, score: { type: 'cp', value: 800 }, pv: ['e6c5', 'b7c7', 'c5d7'] }])
  assert.equal(candidates[0].kind, 'Şah–vezir çatalı')
  assert.match(candidates[0].why, /b7.*şaha.*d7.*vezire/)
  assert.match(candidates[0].why, /Kc7.*Nxd7/)
  assert.match(positionIntro(new Chess(fen), 'w', null, candidates).title, /Şah–vezir çatalı/)
  assert.ok(scanTactics(fen).some(item => item.uci === 'e6c5'))
  assert.equal(tacticalSearchQueue(fen, [], 2)[0].uci, 'e6c5')
  assert.ok(tacticalSearchQueue(fen, [{ uci: 'e6c5' }], 2).every(item => item.uci !== 'e6c5'))
})

test('a tempting alternative is compared with the stronger move and defensive reply', () => {
  const best = { uci: 'e6c5', san: 'Nc5+', score: { type: 'cp', value: 800 }, why: 'Şah–vezir çatalı.' }
  const alternative = { uci: 'f8c8', san: 'Qc8+', score: { type: 'cp', value: 570 }, why: 'Şah çeker.', answer: 'Kxc8' }
  assert.match(compareAlternative(best, alternative), /Qc8.*Kxc8.*Nc5/)
})

test('a postgame lesson requires a confirmed substantial loss', () => {
  const pending = { move: 'Qe8', number: 21, best: { san: 'Nc5+', score: { type: 'cp', value: 800 }, why: 'Şah–vezir çatalı.', motifs: [{ type: 'royalFork' }] } }
  assert.equal(assessPlayedMove(pending, { score: { type: 'cp', value: -730 } }), null)
  assert.match(assessPlayedMove(pending, { score: { type: 'cp', value: -400 } }).text, /21.*Qe8.*Nc5/)
  assert.equal(assessPlayedMove({ ...pending, move: 'Nc5+' }, { score: { type: 'cp', value: -400 } }), null)
})
