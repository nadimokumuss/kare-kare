import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { Chess } from 'chess.js'
import { captureAssessment, captureChoiceComparison, describeLines, explainedMotifs, numberedVariation, positionIntro, profitableCaptures, variationMoves } from '../extension/coach-core.js'
import { gradePlayedMove, positionAlerts, reviewReport } from '../extension/coach-insights.js'
import { spokenChessText } from '../extension/speech-coach.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/feedback-090.json', import.meta.url)))
const line = pv => ({ depth: 16, score: { type: 'cp', value: 600 }, pv })

test('a bishop looking at f2 does not imply a profitable threat against the defended pawn', () => {
  const game = new Chess()
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'd3', 'Bc5']) game.move(san)
  assert.equal(game.isAttacked('f2', 'b'), true)
  assert.equal(profitableCaptures(game, 'b').some(item => item.to === 'f2'), false)
  const copy = new Chess(game.fen()); copy.setTurn('b')
  const capture = captureAssessment(copy.fen(), 'c5f2')
  assert.equal(capture.gain, -2)
  assert.equal(capture.sequence[1].san, 'Kxf2')
  const candidates = describeLines(game.fen(), [line(['c1g5', 'g8f6', 'b1c3'])])
  const intro = positionIntro(game, 'w', game.history({ verbose: true }).at(-1), candidates)
  assert.doesNotMatch(intro.body, /f2.*tehdit|f2.*hedef|korumamız|korumalısın/)
})

test('counterplay is identified explicitly when the main candidate leaves a genuinely threatened pawn', () => {
  const game = new Chess('r5k1/8/8/8/8/4Q3/1P6/6K1 b - - 0 12')
  const last = game.move('Rb8')
  const candidates = describeLines(game.fen(), [line(['e3f4', 'b8b2', 'f4f8'])])
  const intro = positionIntro(game, 'w', last, candidates)
  assert.match(intro.body, /Rxb2.*b2/)
  assert.match(intro.body, /Qf4 bu taşı doğrudan korumuyor/)
  assert.doesNotMatch(intro.body, /piyonu koru|piyonu savun/)
  const check = describeLines(game.fen(), [line(['e3e6', 'g8g7'])])
  assert.match(positionIntro(game, 'w', last, check).body, /Qe6\+ ile önce şah çekerek/)
})

test('pinned attackers do not create fictitious profitable captures', () => {
  const game = new Chess('4k3/4b3/8/8/1P6/8/8/4R1K1 b - - 0 1')
  assert.equal(game.isAttacked('b4', 'b'), true)
  assert.equal(profitableCaptures(game, 'b', 'e7').some(move => move.to === 'b4'), false)
})

test('the submitted position distinguishes a rook sacrifice from a knight-for-pawn-and-bishop trade', () => {
  const knight = captureAssessment(fixture.exchange19Fen, 'd4e6')
  const rook = captureAssessment(fixture.exchange19Fen, 'e1e6')
  assert.equal(knight.gain, 1)
  assert.equal(rook.gain, -1)
  assert.deepEqual(knight.sequence.map(move => move.san), ['Nxe6', 'Bxe6', 'Rxe6+'])
  assert.deepEqual(rook.sequence.map(move => move.san), ['Rxe6+', 'Bxe6', 'Nxe6'])
  const comparison = captureChoiceComparison(fixture.exchange19Fen, 'd4e6')
  assert.equal(comparison.difference, 2)
  assert.match(comparison.text, /Rxe6\+ yerine Nxe6/)
  assert.match(comparison.text, /bir at verip bir piyon ve bir fil/)
  assert.match(comparison.text, /Rxe6\+/)
})

test('a delayed recapture through a clearance is explained using the whole calculated capture sequence', () => {
  const pv = ['d4e6', 'd7e6', 'e5f6', 'g8f6', 'e1e6', 'e8d8']
  const candidate = describeLines(fixture.exchange18Fen, [line(pv)])[0]
  assert.equal(candidate.lineText, '18. Nxe6 Bxe6 19. exf6 Nxf6 20. Rxe6+ Kd8')
  assert.equal(candidate.lineExchange.balance, 1)
  assert.match(candidate.why, /Nxe6 Bxe6 exf6 Nxf6 Rxe6\+/)
  assert.match(candidate.why, /1 piyon lehine/)
  assert.doesNotMatch(candidate.why, /2 piyon aleyhine/)
  const game = new Chess(fixture.exchange18Fen)
  assert.throws(() => game.move('Rxe6+')) // e5 blocks the rook in the earlier position.
})

test('a geometrical pin without a demonstrated exploitation stays out of coaching and alerts', () => {
  const fen = '4k3/p3n3/3P4/8/8/8/R7/6K1 w - - 0 1'
  const quiet = describeLines(fen, [line(['a2e2', 'a7a6', 'g1h2'])])[0]
  assert.equal(quiet.motifs.some(item => item.type === 'pin'), false)
  assert.notEqual(quiet.kind, 'Açmaz')
  assert.equal(positionAlerts(fen, [quiet]).some(item => item.channel === 'pin'), false)
  const useful = describeLines(fen, [line(['a2e2', 'a7a6', 'd6e7'])])[0]
  assert.equal(useful.motifs.find(item => item.type === 'pin').evidence.san, 'dxe7')
  assert.match(useful.why, /dxe7/)
  assert.ok(positionAlerts(fen, [useful]).some(item => item.channel === 'pin'))
  assert.equal(explainedMotifs(fen, ['a2e2', 'e8d8', 'd6e7']).some(item => item.type === 'pin'), false)
})

test('the report anchors the alternative to its original move and retains an instructive exchange example', () => {
  const before = describeLines(fixture.exchange18Fen, [line(['d4e6', 'd7e6', 'e5f6', 'g8f6', 'e1e6'])])
  const game = new Chess(fixture.exchange18Fen); const actual = game.move('exf6')
  const grade = gradePlayedMove({ san: actual.san, uci: 'e5f6', color: 'w', number: 18, ply: 35, beforeFen: actual.before, afterFen: actual.after }, before,
    { san: 'Nxf6', depth: 16, score: { type: 'cp', value: -400 } }, 'w')
  assert.match(grade.explanation, /18\. hamlesinden önceki konum/)
  assert.match(grade.explanation, /18\. Nxe6 Bxe6 19\. exf6 Nxf6 20\. Rxe6\+/)
  const candidate = describeLines(fixture.exchange19Fen, [line(['d4e6', 'd7e6', 'e1e6'])])[0]
  const good = gradePlayedMove({ san: 'Nxe6', uci: 'd4e6', color: 'w', number: 19, ply: 37, beforeFen: fixture.exchange19Fen, afterFen: 'later' }, [candidate], null, 'w')
  assert.ok(good.captureComparison)
  assert.ok(reviewReport([grade, good], 'w', 40, true).moments.some(item => item.captureComparison))
})

test('both submitted games replay and numbered explanations stop before any illegal engine suffix', () => {
  for (const pgn of fixture.pgns) {
    const game = new Chess(); game.loadPgn(pgn)
    assert.ok(game.isCheckmate())
    for (const move of game.history({ verbose: true })) {
      const uci = move.from + move.to + (move.promotion || '')
      assert.equal(variationMoves(move.before, [uci, 'a1a1']).length, 1)
      assert.ok(numberedVariation(move.before, [uci, 'a1a1']).includes(move.san))
    }
  }
})

test('spoken mate announcements use chess context and avoid the isolated abbreviation', () => {
  assert.equal(spokenChessText('Siyah için 2 hamlede mat.'), 'Siyah için 2 hamlede şah matı.')
  assert.equal(spokenChessText('Mat eder.'), 'şah matı yapar.')
  assert.equal(spokenChessText('Matı tamamladın.'), 'Matı tamamladın.')
  assert.match(spokenChessText('Qb8#'), /şah matı$/)
})
