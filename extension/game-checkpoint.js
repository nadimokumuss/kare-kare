import { Chess } from 'chess.js'
import { piecesFromGame, samePieces } from './board-sync.js'

export const checkpointKey = 'kareKareGameCheckpointsV1'
const maxAge = 12 * 60 * 60 * 1000

// Lobby/bot URLs do not identify a particular game and cannot safely key a
// restore. Account restrictions are still checked by the content controller.
export function checkpointScope(pathname, account) {
  if (!account) return null
  const path = String(pathname).replace(/^\/tr(?=\/)/, '')
  const match = path.match(/^\/game\/(?:(live|daily)\/)?(\d+)\/?$/)
  return match ? `${String(account).toLowerCase()}:${match[1] === 'daily' ? 'daily' : 'live'}:${match[2]}` : null
}

export function makeCheckpoint(position, scope, now = Date.now()) {
  const moves = position.history()
  if (!scope || !moves.length || moves.length > 800) return null
  return { version: 1, scope, at: now, moves, fen: position.fen() }
}

function agreesWithHistory(position, snapshots) {
  if (!snapshots.length) return true
  const history = position.history()
  return snapshots.some(({ sans }) => sans.length && sans.length <= history.length &&
    (sans.every((san, index) => san === history[index]) || sans.every((san, index) => san === history[history.length - sans.length + index])))
}

export function restoreCheckpoint(record, scope, pieces, snapshots = [], now = Date.now()) {
  if (!scope || record?.version !== 1 || record.scope !== scope || !Number.isFinite(record.at) ||
    now - record.at > maxAge || record.at > now + 5000 || !Array.isArray(record.moves) ||
    !record.moves.length || record.moves.length > 800) return null
  const position = new Chess()
  try { for (const san of record.moves) { if (typeof san !== 'string' || san === '--') return null; position.move(san) } }
  catch { return null }
  if (position.fen() !== record.fen) return null
  if (samePieces(piecesFromGame(position), pieces) && agreesWithHistory(position, snapshots)) return position
  // A move/quick reply can arrive during reload. Continue only from the known
  // legal history, and only if the resulting full FEN is unambiguous.
  const found = new Map()
  const inspect = () => {
    if (samePieces(piecesFromGame(position), pieces) && agreesWithHistory(position, snapshots)) found.set(position.fen(), position.history())
  }
  for (const first of position.moves({ verbose: true })) {
    position.move(first); inspect()
    for (const second of position.moves({ verbose: true })) { position.move(second); inspect(); position.undo() }
    position.undo()
    if (found.size > 1) return null
  }
  if (found.size !== 1) return null
  const restored = new Chess()
  for (const san of [...found.values()][0]) restored.move(san)
  return restored
}

export function createCheckpointStore(storage) {
  let pending = Promise.resolve()
  return {
    async load(scope) { await pending; const saved = await storage.get(checkpointKey); return saved[checkpointKey]?.[scope] || null },
    save(record) {
      if (!record) return pending
      pending = pending.then(async () => {
        const saved = await storage.get(checkpointKey)
        const records = Object.values(saved[checkpointKey] || {}).filter(item => item?.scope && Number.isFinite(item.at) && item.scope !== record.scope && record.at - item.at <= maxAge)
        records.push(record)
        records.sort((a, b) => b.at - a.at)
        await storage.set({ [checkpointKey]: Object.fromEntries(records.slice(0, 8).map(item => [item.scope, item])) })
      }).catch(() => {})
      return pending
    }
  }
}
