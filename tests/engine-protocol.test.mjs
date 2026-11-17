import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('the Stockfish bridge returns three ranked variations and replies', () => {
  const sentToWorker = []
  const sentToPage = []
  const parent = { postMessage: message => sentToPage.push(message) }
  let onPageMessage
  let worker
  class WorkerMock {
    constructor() { worker = this }
    postMessage(value) { sentToWorker.push(value) }
  }
  const source = readFileSync(new URL('../extension/engine.js', import.meta.url), 'utf8')
  runInNewContext(source, { Worker: WorkerMock, parent, window: { addEventListener: (_, handler) => { onPageMessage = handler } } })
  worker.onmessage({ data: 'readyok' })
  onPageMessage({ source: parent, origin: 'https://www.chess.com', data: { source: 'kare-kare-content', type: 'analyze', id: 12, fen: 'example fen' } })
  assert.ok(sentToWorker.includes('setoption name MultiPV value 3'))
  assert.ok(sentToWorker.includes('go depth 16 movetime 1800'))
  worker.onmessage({ data: 'info depth 11 multipv 1 score cp 34 pv e2e4 e7e5 g1f3' })
  worker.onmessage({ data: 'info depth 11 multipv 2 score cp 24 pv d2d4 d7d5 c2c4' })
  worker.onmessage({ data: 'info depth 11 multipv 3 score cp 12 pv g1f3 d7d5 d2d4' })
  worker.onmessage({ data: 'bestmove e2e4 ponder e7e5' })
  const result = sentToPage.find(message => message.type === 'analysis')
  assert.equal(result.id, 12)
  assert.equal(result.lines.length, 3)
  assert.equal(result.lines[0].pv[1], 'e7e5')
  assert.equal(result.lines[2].rank, 3)
  onPageMessage({ source: parent, origin: 'https://www.chess.com', data: { source: 'kare-kare-content', type: 'analyze', id: 13, fen: 'example fen', searchMove: 'g1f3' } })
  assert.ok(sentToWorker.includes('setoption name MultiPV value 1'))
  assert.ok(sentToWorker.includes('go depth 16 movetime 1800 searchmoves g1f3'))
  worker.onmessage({ data: 'info depth 14 multipv 1 score mate 1 lowerbound pv g1f3 g8f6' })
  worker.onmessage({ data: 'bestmove g1f3' })
  const bounded = sentToPage.find(message => message.type === 'analysis' && message.id === 13)
  assert.equal(bounded.lines[0].score, undefined)
  onPageMessage({ source: parent, origin: 'https://www.chess.com', data: { source: 'kare-kare-content', type: 'analyze', id: 14, fen: 'terminal fen' } })
  worker.onmessage({ data: 'bestmove (none)' })
  assert.deepEqual(Array.from(sentToPage.find(message => message.type === 'analysis' && message.id === 14).lines), [])
})
