import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { checkpointKey, checkpointScope, createCheckpointStore, makeCheckpoint, restoreCheckpoint } from '../extension/game-checkpoint.js'
import { piecesFromGame } from '../extension/board-sync.js'

const now = 1_800_000_000_000
const scope = checkpointScope('/game/12345', 'reviewer')
function game() {
  const position = new Chess()
  for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O', 'd6']) position.move(san)
  return position
}

test('focus-view reload restores verified legal history including turn and castling rights', () => {
  const position = game()
  const result = restoreCheckpoint(makeCheckpoint(position, scope, now), scope, piecesFromGame(position), [], now + 1000)
  assert.equal(result.fen(), position.fen())
  assert.deepEqual(result.history(), position.history())
  assert.equal(result.getCastlingRights('w').k, false)
})

test('a unique quick move and reply during refresh can extend the checkpoint', () => {
  const position = game(); const record = makeCheckpoint(position, scope, now)
  position.move('d3'); position.move('Nf6')
  const restored = restoreCheckpoint(record, scope, piecesFromGame(position), [], now + 3000)
  assert.equal(restored?.fen(), position.fen())
})

test('expired, tampered, another-game and conflicting-history checkpoints cannot restore', () => {
  const position = game(), pieces = piecesFromGame(position), record = makeCheckpoint(position, scope, now)
  assert.equal(restoreCheckpoint(record, scope + '9', pieces, [], now), null)
  assert.equal(restoreCheckpoint(record, scope, pieces, [], now + 13 * 3600000), null)
  assert.equal(restoreCheckpoint({ ...record, fen: record.fen.replace(' w ', ' b ') }, scope, pieces, [], now), null)
  assert.equal(restoreCheckpoint({ ...record, moves: ['e4', 'a1a8'] }, scope, pieces, [], now), null)
  assert.equal(restoreCheckpoint(record, scope, pieces, [{ sans: ['d4', 'd5'] }], now), null)
  assert.equal(restoreCheckpoint(record, scope, piecesFromGame(new Chess()), [], now), null)
})

test('game identity excludes generic lobby and bot routes and keeps daily IDs separate', () => {
  assert.equal(checkpointScope('/play/online', 'reviewer'), null)
  assert.equal(checkpointScope('/play/computer', 'reviewer'), null)
  assert.equal(checkpointScope('/game/12345', null), null)
  assert.equal(checkpointScope('/tr/game/live/12345', 'Reviewer'), scope)
  assert.notEqual(checkpointScope('/game/daily/12345', 'reviewer'), scope)
})

test('checkpoint storage keeps only eight recent games locally', async () => {
  let data = {}
  const store = createCheckpointStore({ get: async () => data, set: async value => { data = { ...data, ...value } } })
  for (let index = 0; index < 10; index++) await store.save(makeCheckpoint(game(), `reviewer:live:${index}`, now + index))
  assert.equal(Object.keys(data[checkpointKey]).length, 8)
  assert.equal(await store.load('reviewer:live:0'), null)
  assert.ok(await store.load('reviewer:live:9'))
})
