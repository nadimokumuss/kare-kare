import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { describeLines, tacticalMotifs, continuationText, scanTactics } from '../extension/coach-core.js'
import { gradePlayedMove, strongCandidates } from '../extension/coach-insights.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/feedback-070.json', import.meta.url)))

test('the reported Be2+ is not called a fork when the king can simply capture the bishop', () => {
  const game = new Chess(fixture.bishopForkFen)
  game.move('Be2+')
  assert.ok(game.moves().includes('Kxe2'))
  assert.equal(tacticalMotifs(fixture.bishopForkFen, 'g4e2').some(item => ['fork', 'royalFork'].includes(item.type)), false)
})

test('a pin already present does not become a new opportunity just because the attacker slides on the same line', () => {
  assert.equal(tacticalMotifs('4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1', 'e1e2').some(item => item.type === 'pin'), false)
})

test('the supplied game retains its useful knight fork and absolute pin', () => {
  const game = new Chess()
  game.loadPgn(fixture.pgn)
  const moves = game.history({ verbose: true })
  const fork = moves.find(move => move.san === 'Nc7+' && move.before.split(' ')[5] === '16')
  assert.ok(tacticalMotifs(fork.before, fork.from + fork.to).some(item => item.type === 'fork'))
  const queenPosition = moves.find(move => move.san === 'Qb4').before
  assert.ok(scanTactics(queenPosition).some(item => item.san === 'Qa5' && item.motifs.some(motif => motif.type === 'pin')))
})

test('the recorded 18...Kd7 retains the best-move grade instead of being penalized for later score drift', () => {
  const { record, best, actualScore } = fixture.kd7
  const after = { depth: 16, score: { type: actualScore.type, value: -actualScore.value } }
  assert.equal(gradePlayedMove(record, [best], after, 'w').code, 'best')
  const shown = { ...record, shownCandidates: [best] }
  assert.equal(gradePlayedMove(shown, [best], after, 'w').code, 'best')
})

test('a later refutation of a published recommendation is a coach correction, not player blame', () => {
  const { record, best } = fixture.kd7
  const result = gradePlayedMove({ ...record, shownCandidates: [best] }, [best], { depth: 16, san: 'Qh4#', score: { type: 'mate', value: 1 } }, 'b')
  assert.equal(result.code, 'correction')
  assert.match(result.explanation, /oyuncu hatası olarak sayılmadı/)
})

test('only moves within the grading tolerance are published as strong candidates', () => {
  const moves = [100, 65, 20].map((value, index) => ({ uci: String(index), score: { type: 'cp', value } }))
  assert.equal(strongCandidates(moves).length, 2)
})

test('capture warnings name a real recapture and stay absent if no recapture exists', () => {
  const clear = describeLines('6k1/8/8/8/3p4/8/8/3R2K1 w - - 0 1', [{ pv: ['d1d4', 'g8f7'] }])[0]
  assert.doesNotMatch(clear.why, /karşı|dikkat et/)
  const defended = describeLines('6k1/8/4p3/3p4/8/8/8/3R2K1 w - - 0 1', [{ pv: ['d1d5', 'e6d5'] }])[0]
  assert.match(defended.why, /Rxd5 exd5/)
  assert.match(defended.why, /bir kale verip bir piyon/)
})

test('continuation language identifies both players and never merges their plans', () => {
  const candidate = { answer: 'Nc3', continuation: 'd6', continuationWhy: 'Piyonu d6 karesine ilerletir.' }
  assert.match(continuationText(candidate, 'b', 'b'), /Rakip Nc3 oynarsa, sen d6/)
  assert.match(continuationText(candidate, 'w', 'b'), /Sen Nc3.*rakip d6/)
})
