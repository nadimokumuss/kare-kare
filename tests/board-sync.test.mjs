import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { moveNodeSan, normalizeSan, piecesFromGame, readBoardPieces, reconstructPosition, visibleGameResult } from '../extension/board-sync.js'

export const screenshotTwoMoves = 'e4 Nf6 d3 d5 e5 Ng4 Nf3 Nc6 d4 Be6 h3 Nh6 Bxh6 gxh6 Bb5 Qd7 Qd2 a6 Bxc6 Qxc6 Nc3 Bg7 O-O-O a5 Rhe1 h5 h4 Bg4 Qg5 Bh6 Qd2 Bxd2+ Rxd2 Bxf3 gxf3 O-O-O e6 fxe6'.split(' ')

test('the second screenshot position reconstructs legally and rejects an incomplete move list', () => {
  const game = new Chess()
  for (const san of screenshotTwoMoves) game.move(san)
  assert.equal(game.get('e6').type, 'p')
  assert.equal(game.get('c1').type, 'k')
  const pieces = piecesFromGame(game)
  assert.equal(reconstructPosition([{ source: 'fixture', sans: screenshotTwoMoves }], pieces).position.fen(), game.fen())
  assert.equal(reconstructPosition([{ source: 'partial', sans: screenshotTwoMoves.slice(20) }], pieces).position, null)
})

test('figurine icons and Turkish SAN are parsed without confusing an English king with a Turkish rook', () => {
  const icon = { getAttribute: name => name === 'data-figurine' ? 'n' : '' }
  const node = { textContent: 'f3', getAttribute: () => null,
    querySelector: selector => selector.includes('data-figurine') ? icon : null,
    cloneNode: () => ({ textContent: 'f3', querySelectorAll: () => [] }) }
  assert.equal(moveNodeSan(node, true), 'Nf3')
  assert.equal(normalizeSan('Kg8'), 'Kg8')
  assert.equal(normalizeSan('Şg8', true), 'Kg8')
  assert.equal(normalizeSan('Kd7+', true), 'Rd7+')
  assert.equal(normalizeSan('♚g8'), 'Kg8')
  assert.equal(normalizeSan('21. 0-0-0!?'), 'O-O-O')
})

test('capture animation duplicates and missing kings are not accepted as a board position', () => {
  const piece = (code, square) => ({ classList: [code, `square-${square}`], getAttribute: () => null })
  const board = pieces => ({ querySelectorAll: () => pieces })
  assert.equal(readBoardPieces(board([piece('wk', '51'), piece('bk', '58'), piece('wp', '54'), piece('bp', '54')])), null)
  assert.equal(readBoardPieces(board([piece('wk', '51')])), null)
  assert.equal(readBoardPieces(board([piece('wk', '51'), piece('bk', '58')])).size, 2)
  const hiddenCapture = { ...piece('bp', '51'), getClientRects: () => [] }
  assert.equal(readBoardPieces(board([piece('wk', '51'), piece('bk', '58'), hiddenCapture])).size, 2)
})

test('explicit king/rook metadata overrides mixed SAN language after a midgame refresh', () => {
  const node = (text, piece) => ({
    textContent: text, getAttribute: () => null,
    querySelector: selector => selector.includes('data-figurine') ? { getAttribute: key => key === 'data-figurine' ? piece : null } : null,
    cloneNode: () => ({ textContent: text, querySelectorAll: () => [] })
  })
  assert.equal(moveNodeSan(node('Kg8', 'k'), true), 'Kg8')
  assert.equal(moveNodeSan(node('Şg8', 'k'), false), 'Kg8')
  assert.equal(moveNodeSan(node('Kd7+', 'r'), true), 'Rd7+')
  assert.equal(moveNodeSan(node('Rxd7+', 'r'), true), 'Rxd7+')
  assert.equal(moveNodeSan(node('Nbd2', 'n'), true), 'Nbd2')
  assert.equal(moveNodeSan(node('Ab1d2', 'n'), false), 'Nb1d2')
  assert.equal(moveNodeSan(node('R1e2', 'r'), true), 'R1e2')
  const game = new Chess()
  const sans = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'd6', 'h3', 'Nf6', 'Kh2']
  for (const san of sans) game.move(san)
  const snapshots = [{ source: 'mixed-language', sans: sans.map(san => moveNodeSan(node(san, san === 'Kh2' ? 'k' : null), true)) }]
  assert.equal(reconstructPosition(snapshots, piecesFromGame(game)).position?.fen(), game.fen())
})

test('a visible explicit game result ends the report, but a hidden result from an older game does not', () => {
  const doc = nodes => ({ querySelectorAll: () => nodes })
  assert.equal(visibleGameResult(doc([{ textContent: '1-0', getClientRects: () => [{}] }])), '1-0')
  assert.equal(visibleGameResult(doc([{ textContent: '1-0', getClientRects: () => [] }])), null)
  assert.equal(visibleGameResult(doc([{ textContent: 'Oyun devam ediyor', getClientRects: () => [{}] }])), null)
})

test('piece metadata on the move element itself preserves kings and rooks in mixed-language histories', () => {
  const node = (text, code) => ({ textContent: text, getAttribute: name => name === 'data-piece' ? code : null,
    querySelector: () => null, cloneNode: () => ({ textContent: text, querySelectorAll: () => [] }) })
  assert.equal(moveNodeSan(node('Kb7', 'bk'), true), 'Kb7')
  assert.equal(moveNodeSan(node('Kd7+', 'wr'), true), 'Rd7+')
  assert.equal(moveNodeSan(node('Şh2', 'wk'), false), 'Kh2')
  assert.equal(moveNodeSan(node('O-O-O', 'wk'), true), 'O-O-O')
  const content = node('Kb7', null)
  const wrapper = { getAttribute: name => name === 'data-piece' ? 'bk' : null, querySelector: () => content }
  assert.equal(moveNodeSan(wrapper, true), 'Kb7')
})
