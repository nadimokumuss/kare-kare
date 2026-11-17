import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { briefExplanation, describeLines, positionIntro } from '../extension/coach-core.js'

test('the main capture explanation is brief, names the piece, and retains details separately', () => {
  const fen = 'r3k2r/3b2pp/p1p1pn2/q1Bp4/3N4/8/P4PPP/2RQR1K1 w kq - 0 19'
  const candidates = describeLines(fen, [{ depth: 16, score: { type: 'cp', value: 500 }, pv: ['d4e6', 'd7e6', 'e1e6'] }])
  const intro = positionIntro(new Chess(fen), 'w', null, candidates)
  assert.match(intro.brief, /piyonu atınla alabilirsin/)
  assert.match(intro.brief, /Rakip Bxe6 oynarsa, Rxe6\+ ile devam edebilirsin/)
  assert.ok(intro.brief.length < intro.body.length)
  assert.match(intro.body, /bir at verip bir piyon ve bir fil/)
  assert.match(briefExplanation(candidates[0], false), /atıyla alabilir/)
  assert.doesNotMatch(briefExplanation(candidates[0], false), /atınla|alabilirsin/)
})

test('the brief mode retains a real threat and the fact that the primary move chooses counterplay', () => {
  const game = new Chess('r5k1/8/8/8/8/4Q3/1P6/6K1 b - - 0 12')
  const last = game.move('Rb8')
  const candidates = describeLines(game.fen(), [{ pv: ['e3f4', 'b8b2', 'f4f8'], depth: 16, score: { type: 'cp', value: 100 } }])
  const intro = positionIntro(game, 'w', last, candidates)
  assert.match(intro.brief, /Rakip Rxb2 ile taş alabilir/)
  assert.match(intro.brief, /savunma yerine karşı oyun/)
  assert.match(intro.brief, /Qf4/)
})
