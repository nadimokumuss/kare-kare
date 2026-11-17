import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { describeLines } from '../extension/coach-core.js'
import { compareCandidates, createHintController, createPlanTracker, hintContent, opponentComment, positionChanges, sectionSpeech } from '../extension/position-coaching.js'
const candidates = (fen, lines) => describeLines(fen, lines.map((pv, index) => ({ pv, depth: 16, score: { type: 'cp', value: 100 - index * 10 } })))

test('the change narration distinguishes a hanging piece, a new conditional threat, an ended threat and an opened file', () => {
  const hanging = new Chess('6k1/8/8/8/3p4/8/3B4/3R2K1 w - - 0 10')
  const bishop = hanging.move('Be3')
  assert.ok(positionChanges(hanging.fen(), bishop, 'w').some(item => item.type === 'new-profitable-capture' && item.targets[0] === 'e3'))
  const threat = new Chess('r5k1/8/8/8/8/4Q3/1P6/6K1 b - - 0 12')
  const rook = threat.move('Rb8')
  assert.match(positionChanges(threat.fen(), rook, 'w').find(item => item.type === 'new-threat').text, /Önlem almazsan rakip Rxb2/)
  const saved = new Chess('1r4k1/8/8/8/8/4Q3/1P6/6K1 w - - 0 12')
  const queen = saved.move('Qf2')
  assert.ok(positionChanges(saved.fen(), queen, 'w').some(item => item.type === 'threat-ended' && item.targets[0] === 'b2'))
  const file = new Chess('7k/8/8/8/8/1p6/P7/R5K1 w - - 0 20')
  const pawn = file.move('axb3')
  assert.ok(positionChanges(file.fen(), pawn, 'w').some(item => item.type === 'open-file' && item.targets[0] === 'a'))
})

test('a defended f2 pawn is not a profitable bishop threat and ordinary opening moves do not force delta filler', () => {
  const game = new Chess(); const first = game.move('e4')
  assert.deepEqual(positionChanges(game.fen(), first, 'w'), [])
  for (const san of ['e5', 'Nf3', 'Nc6', 'd3', 'Bc5']) game.move(san)
  const last = game.history({ verbose: true }).at(-1)
  assert.doesNotMatch(positionChanges(game.fen(), last, 'w').map(item => item.text).join(' '), /Bxf2/)
  assert.doesNotMatch(opponentComment(game.fen(), candidates(game.fen(), [['c1g5', 'g8f6', 'b1c3']]), 'w'), /Bxf2/)
  assert.deepEqual(positionChanges(game.fen(), first, 'w'), [])
})

test('opponent narration keeps the conditional branch and the primary counterplay policy coherent', () => {
  const game = new Chess('r5k1/8/8/8/8/4Q3/1P6/6K1 b - - 0 12'); game.move('Rb8')
  const choices = candidates(game.fen(), [['e3f4', 'b8b2', 'f4f8']])
  const text = opponentComment(game.fen(), choices, 'w')
  assert.match(text, /Rxb2/); assert.match(text, /doğrudan kapatmıyor/); assert.match(text, /Sen Qf4 oynarsan, rakip Rxb2/)
  assert.doesNotMatch(opponentComment(game.fen(), choices, 'w', false), /Qf4|Rxb2/)
  assert.match(opponentComment(game.fen(), choices, 'b'), /Rakibin hesaplanan güçlü cevabı Qf4/)
})

test('candidate comparisons use legal strong lines and identify check versus quiet play without inventing a second option', () => {
  const fen = '6k1/8/8/8/8/8/8/3R2K1 w - - 0 12'
  const choices = candidates(fen, [['d1d8', 'g8f7', 'd8d7'], ['d1d2', 'g8f7', 'd2d7']])
  assert.match(compareCandidates(fen, choices, 'w').text, /Rd8\+ doğrudan şah/)
  assert.deepEqual(compareCandidates(fen, choices, 'w').candidates, choices.map(item => item.uci))
  assert.match(compareCandidates(fen, [choices[0]], 'w').text, /tek seçenek/)
  assert.deepEqual(compareCandidates(fen, [choices[0], { ...choices[1], score: { type: 'cp', value: -200 } }], 'w').candidates, [])
})

test('the plan remembers its first step, survives a verified reload, and completes after the actual continuation', () => {
  const game = new Chess(), tracker = createPlanTracker()
  const first = candidates(game.fen(), [['e2e4', 'e7e5', 'g1f3']])
  assert.equal(tracker.observe(game.fen(), first, [], 'w').status, 'new')
  game.move('e4')
  assert.equal(tracker.observe(game.fen(), candidates(game.fen(), [['e7e5', 'g1f3', 'b8c6']]), game.history({ verbose: true }), 'w').status, 'partial')
  const restored = createPlanTracker()
  assert.equal(restored.restore(tracker.snapshot(), game.history({ verbose: true }), 'w'), true)
  assert.equal(createPlanTracker().restore(tracker.snapshot(), game.history({ verbose: true }), 'b'), false)
  game.move('e5')
  const continued = restored.observe(game.fen(), candidates(game.fen(), [['g1f3', 'b8c6', 'f1c4']]), game.history({ verbose: true }), 'w')
  assert.equal(continued.status, 'partial'); assert.match(continued.text, /Güncel ilk adım Nf3/)
  game.move('Nf3')
  assert.equal(restored.observe(game.fen(), candidates(game.fen(), [['b8c6', 'f1c4', 'g8f6']]), game.history({ verbose: true }), 'w').status, 'completed')
  const bad = structuredClone(tracker.snapshot()); bad.active.sourcePly = 999
  assert.equal(createPlanTracker().restore(bad, game.history({ verbose: true }), 'w'), false)
})

test('an opponent block makes the old continuation illegal and produces a concrete plan change', () => {
  const game = new Chess(); for (const san of ['e4', 'e5', 'Qh5', 'Nc6']) game.move(san)
  const tracker = createPlanTracker()
  tracker.observe(game.fen(), candidates(game.fen(), [['f1c4', 'g8f6', 'h5f7']]), game.history({ verbose: true }), 'w')
  game.move('Bc4'); game.move('g6')
  const result = tracker.observe(game.fen(), candidates(game.fen(), [['h5f3', 'g8f6']]), game.history({ verbose: true }), 'w')
  assert.equal(result.status, 'blocked'); assert.match(result.update, /artık yasal değil/)
  assert.equal(result.nextStep, 'Qf3')
})

test('guided hints reset on a new position and never leak coordinates through other spoken sections before explicit reveal', () => {
  const fen = new Chess().fen(), choices = candidates(fen, [['e2e4', 'e7e5', 'g1f3'], ['d2d4', 'd7d5', 'c2c4']])
  const hints = createHintController()
  assert.equal(hints.sync(fen, true), 0); assert.equal(hints.advance(), 1); assert.equal(hints.sync(fen, true), 1)
  const view = { fen, comment: 'e4 ile devam.', full: 'e4 ardından e5.', changes: [{ type: 'new-profitable-capture', text: 'Qxe4 alışı var.' }], plan: { text: 'e4 e5 Nf3' }, opponent: 'e5', comparison: { text: 'e4 veya d4' } }
  for (const action of ['comment', 'plan', 'opponent', 'comparison', 'details', 'change', 'hint']) {
    const text = sectionSpeech(action, { fen, view, hidden: true, hintLevel: 1, candidates: choices, playerColor: 'w' }).text
    assert.doesNotMatch(text, /\b[a-h][1-8]\b|Nf3|Qxe4/, action)
  }
  assert.match(sectionSpeech('candidate1', { fen, view, hidden: true, hintLevel: 1, candidates: choices, playerColor: 'w' }).text, /e4/)
  assert.equal(hints.advance(), 2); assert.equal(hints.hidden, false)
  const game = new Chess(); game.move('e4')
  assert.equal(hints.sync(game.fen(), true), 0)
  assert.equal(hints.sync(game.fen(), false), 2)
  assert.doesNotMatch(hintContent(fen, choices[0]).target, /e4/)
})

test('manual sections handle missing candidates, old positions, replay and opponent identity predictably', () => {
  const game = new Chess(); game.move('e4'); const fen = game.fen()
  const choices = candidates(fen, [['e7e5', 'g1f3', 'b8c6']]), view = { fen }
  assert.match(sectionSpeech('candidate1', { fen, view, candidates: choices, playerColor: 'w' }).text, /^Rakibin 1\. adayı/)
  assert.match(sectionSpeech('candidate3', { fen, view, candidates: choices, playerColor: 'w' }).text, /3\. güçlü aday bulunmuyor/)
  assert.match(sectionSpeech('comment', { fen, view: { fen: 'old' }, playerColor: 'w' }).text, /henüz hazır değil/)
  assert.match(sectionSpeech('candidate1', { fen, view: { fen: 'old' }, candidates: choices, playerColor: 'w' }).text, /henüz hazır değil/)
  const old = { text: 'Atını geliştir.', fen: 'old' }
  const repeat = sectionSpeech('repeat', { fen, lastHeard: old })
  assert.match(repeat.text, /^Geçmiş konuma/); assert.equal(repeat.canonical, old)
  assert.match(sectionSpeech('grades', { fen, grades: [{ ply: 1, color: 'w', label: 'İyi', afterFen: 'old', number: 1 }], playerColor: 'w' }).text, /Geçmiş hamle/)
})

test('black plan progress and completion retain the same actor after both replies', () => {
  const game = new Chess(), tracker = createPlanTracker(); game.move('e4')
  const initial = tracker.observe(game.fen(), candidates(game.fen(), [['e7e5', 'g1f3', 'b8c6']]), game.history({ verbose: true }), 'b')
  assert.equal(initial.status, 'new'); assert.match(initial.text, /Güncel ilk adım e5/)
  game.move('e5')
  assert.equal(tracker.observe(game.fen(), candidates(game.fen(), [['g1f3', 'b8c6']]), game.history({ verbose: true }), 'b').status, 'partial')
  game.move('Nf3')
  const next = tracker.observe(game.fen(), candidates(game.fen(), [['b8c6', 'f1c4', 'g8f6']]), game.history({ verbose: true }), 'b')
  assert.equal(next.status, 'partial'); assert.equal(next.nextStep, 'Nc6')
  game.move('Nc6')
  assert.equal(tracker.observe(game.fen(), candidates(game.fen(), [['f1c4', 'g8f6']]), game.history({ verbose: true }), 'b').status, 'completed')
})

test('a spoken candidate keeps the reply and next step when only the brief reason is read', () => {
  const fen='rn3Qn1/1k1q2p1/p1p1N3/1p1p4/3P4/4B2r/PP2BP1P/2KR3R w - - 1 21'
  const choices=candidates(fen,[['e6c5','b7c7','c5d7','b8d7']])
  const part=sectionSpeech('candidate1',{fen,view:{fen},candidates:choices,playerColor:'w'})
  assert.match(part.text,/Rakip Kc7 oynarsa, sen Nxd7/)
})
