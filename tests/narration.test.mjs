import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { briefExplanation, describeLines } from '../extension/coach-core.js'
import { candidateColors, candidateSignature, createNarrationController, narrationSegments } from '../extension/narration.js'
import { overlayModel, renderBoardOverlay, squarePoint } from '../extension/board-overlays.js'
import { positionChanges } from '../extension/position-coaching.js'
const choices = (fen, lines) => describeLines(fen, lines.map((pv, index) => ({ pv, depth: 16, score: { type: 'cp', value: 400 - index * 10 } })))
const forkFen = 'rn3Qn1/1k1q2p1/p1p1N3/1p1p4/3P4/4B2r/PP2BP1P/2KR3R w - - 1 21'
const fork = choices(forkFen, [['e6c5', 'b7c7', 'c5d7', 'b8d7']])

test('the original Nc5+ fork narrates move, actual targets, conditional reply and continuation in order', () => {
  const text = `1. aday Nc5+. ${briefExplanation(fork[0])} Rakip Kc7 oynarsa, sen Nxd7 ile devam edebilirsin.`
  const segments = narrationSegments({ text, action: 'candidate1', fen: forkFen, candidates: fork, playerColor: 'w' })
  assert.equal(segments.map(segment => segment.text).join(' '), text)
  assert.equal(segments[0].cue.moves[0].from, 'e6'); assert.equal(segments[0].cue.moves[0].to, 'c5')
  assert.deepEqual(segments[1].cue.targets, ['b7', 'd7'])
  assert.equal(segments[2].cue.moves[0].opponent, true); assert.equal(segments[2].cue.moves[0].conditional, true)
  assert.equal(segments[2].cue.moves[0].rank, null); assert.match(segments[2].cue.label, /Örnek devam 2.*Rakip/)
  assert.equal(segments[3].cue.moves[0].to, 'd7'); assert.equal(segments[3].cue.moves[0].rank, 0)
  assert.equal(segments[3].cue.setup.length, 2)
})

test('candidate rank colors stay fixed and an explicit second candidate is allowed without leaking hidden hints', () => {
  const fen = new Chess().fen(), candidates = choices(fen, [['e2e4', 'e7e5', 'g1f3'], ['d2d4', 'd7d5', 'c2c4'], ['g1f3', 'd7d5', 'd2d4']])
  assert.deepEqual(candidateColors, ['#d6f263', '#68d4e9', '#ffa96a'])
  const input = { text: '2. aday d4. Piyonunu d4 karesine ilerletir.', action: 'candidate2', fen, candidates, playerColor: 'w', hidden: true }
  assert.deepEqual(narrationSegments(input), [])
  const revealed = narrationSegments({ ...input, allowReveal: true })
  assert.equal(revealed[0].cue.moves[0].rank, 1); assert.equal(revealed[0].cue.moves[0].to, 'd4')
  assert.deepEqual(narrationSegments({ ...input, allowReveal: false, action: 'plan' }), [])
  assert.deepEqual(narrationSegments({ ...input, action: 'grades', allowReveal: true }), [])
})

test('squares in prose, stale views, insufficient depth and illegal lines do not manufacture move arrows', () => {
  const fen = new Chess().fen(), candidates = choices(fen, [['e2e4', 'e7e5']])
  const input = { text: 'e4 karesindeki piyon yapısını incele.', fen, candidates, playerColor: 'w' }
  assert.deepEqual(narrationSegments(input), [])
  assert.deepEqual(narrationSegments({ ...input, text: 'e4 ile devam.', view: { fen: 'old' } }), [])
  assert.deepEqual(narrationSegments({ ...input, text: 'e4 ile devam.', candidates: [{ ...candidates[0], depth: 9 }] }), [])
  assert.deepEqual(narrationSegments({ ...input, text: 'e4 ile devam.', candidates: [{ ...candidates[0], uci: 'a1a8', pv: ['a1a8'] }] }), [])
  assert.deepEqual(narrationSegments({ ...input, fen: 'invalid' }), [])
})

test('profitable opponent threats get a separate conditional cue while a defended f2 pawn does not', () => {
  const game = new Chess('r5k1/8/8/8/8/4Q3/1P6/6K1 b - - 0 12'); game.move('Rb8')
  const candidates = choices(game.fen(), [['e3f4', 'b8b2', 'f4f8']])
  const threat = narrationSegments({ text: 'Yanıt vermezsen rakip Rxb2 alışıyla maddi kazanç sağlayabilir.', action: 'opponent', fen: game.fen(), candidates, playerColor: 'w' })
  assert.equal(threat[0].cue.kind, 'threat'); assert.equal(threat[0].cue.moves[0].opponent, true)
  assert.equal(threat[0].cue.moves[0].rank, null); assert.equal(threat[0].cue.moves[0].conditional, true)
  const defended = new Chess(); ['e4','e5','Nf3','Nc6','d3','Bc5'].forEach(san => defended.move(san))
  assert.deepEqual(narrationSegments({ text: 'Yanıt vermezsen rakip Bxf2+ alışıyla maddi kazanç sağlayabilir.', action: 'opponent', fen: defended.fen(),
    candidates: choices(defended.fen(), [['b1c3', 'g8f6']]), playerColor: 'w' }), [])
})

test('position-change highlights use the real before/after record rather than another candidate', () => {
  const game = new Chess('6k1/8/8/8/3p4/8/3B4/3R2K1 w - - 0 10'), move = game.move('Be3')
  const changes = positionChanges(game.fen(), move, 'w')
  const candidates = choices(game.fen(), [['d4e3', 'd1d8']])
  const text = changes[0].text
  const segments = narrationSegments({ text, action: 'change', fen: game.fen(), candidates, playerColor: 'w', view: { fen: game.fen(), changes } })
  assert.equal(segments[0].cue.source, 'change'); assert.equal(segments[0].cue.moves[0].from, 'd4')
  assert.deepEqual(segments[0].cue.targets, ['e3'])
})

test('black plans preserve the same rank for their own continuation and distinguish white’s reply', () => {
  const game = new Chess(); game.move('e4')
  const candidates = choices(game.fen(), [['e7e5', 'g1f3', 'b8c6']])
  const segments = narrationSegments({ text: 'e5: Piyonunu geliştir. Rakip Nf3 oynarsa, sen Nc6 ile devam edebilirsin.', action: 'plan', fen: game.fen(), candidates, playerColor: 'b' })
  assert.equal(segments[0].cue.moves[0].rank, 0)
  assert.equal(segments[1].cue.moves[0].opponent, true)
  assert.equal(segments[2].cue.moves[0].rank, 0)
})

test('the narration controller honors mode, verified FEN, hidden moves, historical context, stop and manual mute', () => {
  const prefs = { narrationMode: 'all' }; let draws = 0
  const controller = createNarrationController(() => prefs, () => draws++)
  const cue = { fen: forkFen, tactical: true, targets: ['b7','d7'], moves: [] }
  const context = { fen: forkFen, verified: true, hidden: false }, item = { fen: forkFen }
  assert.equal(controller.start(item, { cue }, context), true); assert.equal(controller.cue, cue)
  controller.positionChanged('new'); assert.equal(controller.cue, null)
  assert.equal(controller.start({ ...item, historical: true }, { cue }, context), false)
  assert.equal(controller.start(item, { cue }, { ...context, verified: false }), false)
  assert.equal(controller.start(item, { cue }, { ...context, fen: 'new' }), false)
  assert.equal(controller.start(item, { cue }, { ...context, hidden: true }), false)
  assert.equal(controller.start({ ...item, allowReveal: true }, { cue }, { ...context, hidden: true }), true)
  controller.mute(); controller.positionChanged('next')
  assert.equal(controller.start(item, { cue }, context), false)
  controller.resume(); assert.equal(controller.start(item, { cue }, context), true)
  prefs.narrationMode = 'off'; assert.equal(controller.start(item, { cue }, context), false)
  prefs.narrationMode = 'tactics'
  assert.equal(controller.start(item, { cue: { ...cue, tactical: false } }, context), false)
  assert.equal(controller.start(item, { cue }, context), true)
  controller.clear(); assert.equal(controller.cue, null); assert.ok(draws > 0)
})

test('static arrow models preserve ranks, show numbered branches and rotate square coordinates without undefined values', () => {
  const fen = new Chess().fen(), candidates = choices(fen, [['e2e4','e7e5','g1f3'],['d2d4','d7d5','c2c4'],['g1f3','d7d5','d2d4']])
  const model = overlayModel({ candidates, showCandidates: true, playerColor: 'w' })
  assert.deepEqual(model.staticMoves.map(move => move.rank), [0,1,2])
  const focus = overlayModel({ candidates, focused: 1, showCandidates: true, playerColor: 'w' })
  assert.deepEqual(focus.staticMoves.map(move => move.rank), [1,null,1])
  assert.deepEqual(focus.staticMoves.map(move => move.step), [1,2,3])
  assert.equal(focus.staticMoves[1].opponent, true)
  const empty = overlayModel({ candidates, narration: { moves: [{ from: undefined, to: 'e4' }], targets: ['x9'] } })
  assert.deepEqual(empty.narratedMoves, []); assert.deepEqual(empty.narratedTargets, [])
  assert.deepEqual(squarePoint('e6'), [450,250]); assert.deepEqual(squarePoint('e6','b'), [350,550])
  assert.equal(squarePoint(undefined), null)
})

test('quiet sentences sharing a visual stay together instead of making speech unnecessarily choppy', () => {
  const fen = new Chess().fen(), candidates = choices(fen, [['e2e4','e7e5','g1f3']])
  const text = `1. aday e4. ${briefExplanation(candidates[0])}`
  const segments = narrationSegments({ text, action: 'candidate1', fen, candidates, playerColor: 'w' })
  assert.equal(segments.length, 1); assert.equal(segments[0].text, text)
})

test('reordered candidates invalidate an older spoken rank even if the FEN is unchanged', () => {
  const controller = createNarrationController(() => ({ narrationMode: 'all' }))
  const item = { fen: forkFen, visualSignature: 'e6c5,e6f4' }, segment = { cue: { fen: forkFen, tactical: true } }
  assert.equal(controller.start(item, segment, { fen: forkFen, verified: true, hidden: false, signature: 'e6f4,e6c5' }), false)
})

test('identical SAN for a capture and its recapture is not assigned to a guessed player', () => {
  const input = { action:'details',fen:forkFen,candidates:fork,playerColor:'w' }
  assert.deepEqual(narrationSegments({...input,text:'Hesaplanan alış dizisi: Nxd7 Nxd7.'}),[])
  const own=narrationSegments({...input,text:'Sen Nxd7 ile veziri alabilirsin.'})
  assert.equal(own[0].cue.moves[0].from,'c5');assert.equal(own[0].cue.moves[0].step,3)
  const enemy=narrationSegments({...input,text:'Rakip Nxd7 ile atını alabilir.'})
  assert.equal(enemy[0].cue.moves[0].from,'b8');assert.equal(enemy[0].cue.moves[0].step,4)
})

test('two unsplit move references do not keep the first arrow visible over the second move', () => {
  const fen=new Chess().fen(),candidates=choices(fen,[['e2e4','e7e5','g1f3']])
  assert.deepEqual(narrationSegments({text:'Örneğin e4 ardından e5 oynanır.',action:'details',fen,candidates,playerColor:'w'}),[])
})

test('narration exclusively owns the overlay, including speech gaps and sentences with no drawable cue', () => {
  const controller = createNarrationController(() => ({ narrationMode: 'all' }))
  const segments = narrationSegments({ text: 'Nc5+ ile devam. Konumu yeniden değerlendir.', fen: forkFen, candidates: fork, playerColor: 'w' })
  const item = { fen: forkFen, segments }, context = { fen: forkFen, verified: true, candidates: fork }
  controller.start(item, segments[0], context)
  const model = () => overlayModel({ candidates: fork, showCandidates: true, narration: controller.cue, narrating: controller.playing })
  assert.deepEqual(model().staticMoves, []); assert.equal(model().narratedMoves.length, 1)
  controller.nextSegment()
  assert.equal(controller.playing, true); assert.deepEqual(model().staticMoves, []); assert.deepEqual(model().narratedMoves, [])
  controller.start(item, segments[1], context)
  assert.equal(controller.playing, true); assert.equal(controller.cue, null); assert.deepEqual(model().staticMoves, [])
  controller.clear(); assert.equal(model().staticMoves.length, 1)
})

test('unrelated same-FEN search updates preserve verified narration; changed ranks, paths or motifs suppress stale cues', () => {
  const fen = new Chess().fen(), candidates = choices(fen, [['e2e4','e7e5','g1f3'],['d2d4','d7d5','c2c4']])
  const segments = narrationSegments({ text: 'e4 ile devam. Rakip e5 oynarsa, sen Nf3 ile devam edebilirsin.', fen, candidates, playerColor: 'w' })
  const controller = createNarrationController(() => ({ narrationMode:'all' }))
  const item = { fen, segments, visualSignature: candidateSignature(candidates) }
  const updated = choices(fen, [['e2e4','e7e5','g1f3'],['g1f3','d7d5','d2d4'],['d2d4','d7d5','c2c4']])
  const context = { fen, verified:true, candidates: updated, signature: candidateSignature(updated) }
  assert.equal(controller.start(item, segments[0], context), true)
  controller.refresh(updated); assert.ok(controller.cue)
  const reordered = [updated[1],updated[0],updated[2]]
  controller.refresh(reordered); assert.equal(controller.cue,null); assert.equal(controller.playing,true)
  assert.equal(controller.start(item,segments[0],{...context,candidates:reordered}),false)
  const newReply = choices(fen,[['e2e4','c7c5','g1f3']])
  assert.equal(controller.start(item,segments[0],{...context,candidates:newReply}),true, 'unchanged root still valid')
  assert.equal(controller.start(item,segments[1],{...context,candidates:newReply}),false, 'obsolete reply suppressed')
  const tactical = narrationSegments({text:briefExplanation(fork[0]),fen:forkFen,candidates:fork,playerColor:'w'})
  assert.equal(controller.start({fen:forkFen,segments:tactical},tactical[0],{fen:forkFen,verified:true,candidates:[{...fork[0],motifs:[]}]}),false)
})

test('renderer uses identical solid geometry and consistent twelve-pixel actor/step badges for both players', () => {
  class Node {
    constructor(tag) { this.tag=tag;this.attrs={};this.children=[];this.style={};this.textContent='' }
    setAttribute(key,value) { this.attrs[key]=value }
    append(...nodes) { this.children.push(...nodes) }
  }
  const document = {createElementNS:(_,tag)=>new Node(tag)}
  const all = node => [node,...node.children.flatMap(all)]
  const candidates = [{from:'e2',to:'e4',color:'w'},{from:'e7',to:'e5',color:'b'}]
  const svg=renderBoardOverlay(document,{candidates,showCandidates:true,boardSize:640,playerColor:'w'})
  const nodes=all(svg),lines=nodes.filter(node=>node.tag==='line'&&node.attrs['data-from'])
  assert.deepEqual(lines.map(node=>node.attrs['stroke-width']),['15','15'])
  assert.ok(lines.every(node=>!node.attrs['stroke-dasharray']))
  assert.deepEqual(nodes.filter(node=>node.tag==='text').map(node=>node.textContent),['Sen','Rakip'])
  const cue={moves:[{from:'e7',to:'e5',opponent:true,rank:null,step:2},{from:'g1',to:'f3',opponent:false,rank:0,step:3}]}
  const speech=all(renderBoardOverlay(document,{boardSize:640,narration:cue}))
  const badges=speech.filter(node=>node.tag==='text')
  assert.deepEqual(badges.map(node=>node.textContent),['Rakip · 2','Sen · 3'])
  assert.ok(badges.every(node=>node.attrs['font-size']==='15'&&node.attrs.fill==='#f3f5ef'&&node.attrs['font-weight']==='600'))
  assert.ok(speech.filter(node=>node.tag==='line').every(node=>!node.attrs['stroke-dasharray']))
})
