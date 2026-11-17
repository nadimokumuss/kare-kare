import test from 'node:test'
import assert from 'node:assert/strict'
import { Chess } from 'chess.js'
import { compactMatch, createMatchStore, developmentReport, journalKey, journalSession, stableMatchId } from '../extension/match-journal.js'

function storage() {
  const data = {}
  return { data, async get(key) { await Promise.resolve(); return structuredClone({ [key]: data[key] }) },
    async set(value) { await Promise.resolve(); Object.assign(data, structuredClone(value)) } }
}
function gameInput(id = 'bot:one', code = 'good', extra = {}) {
  const game = new Chess(), history = []
  for (const san of ['f3', 'e5', 'g4', 'Qh4#']) history.push(game.move(san))
  const grades = history.filter(move => move.color === 'w').map(move => ({ san: move.san, color: move.color,
    beforeFen: move.before, afterFen: move.after, ply: history.indexOf(move) + 1, depth: 16, code, loss: code === 'blunder' ? 300 : 0,
    assessedAt: 10, legalCount: 20, best: { motifs: [{ type: 'fork', prize: 'e8' }], score: { type: 'cp', value: 200 } } }))
  return { id, profile: 'alice', color: 'w', mode: 'bot', moves: game.history(), result: '0-1', grades,
    metadata: { opponent: 'Test', opponentRating: 1000, timeControl: '600+5' }, assistance: { settings: ['same-settings'] }, ...extra }
}

test('stable IDs cover whole numeric games; bot sessions survive refresh and distinguish new games', () => {
  assert.equal(stableMatchId('/tr/game/123'), 'live:123')
  assert.equal(stableMatchId('/game/daily/45'), 'daily:45')
  assert.equal(stableMatchId('/play/computer'), null)
  let serial = 0
  const makeId = () => `session-${++serial}`
  const first = journalSession(null, { path: '/play/computer', profile: 'Alice', moves: ['e4'] }, makeId)
  assert.equal(first.id, journalSession(first, { path: '/play/computer', profile: 'alice', moves: ['e4', 'e5'] }, makeId).id)
  assert.notEqual(first.id, journalSession(first, { path: '/play/computer', profile: 'alice', moves: [] }, makeId).id)
  assert.notEqual(first.id, journalSession(first, { path: '/play/computer', profile: 'alice', moves: ['d4'] }, makeId).id)
  assert.notEqual(first.id, journalSession(first, { path: '/play/computer', profile: 'bob', moves: ['e4'] }, makeId).id)
  assert.equal(journalSession(first, { path: '/game/456', profile: 'alice', moves: ['e4'] }, makeId).id, 'live:456')
})

test('refresh/late grades cannot count one completed game twice or replace a complete history with an old partial snapshot', async () => {
  const disk = storage(), store = createMatchStore(disk)
  await store.save(gameInput('bot:one', 'blunder'))
  await store.save(gameInput('bot:one', 'good', { moves: ['f3', 'e5'], grades: gameInput().grades.slice(0, 1), result: '*' }))
  const saved = await store.list('alice')
  assert.equal(saved.total, 1)
  assert.equal(saved.matches[0].moves.length, 4)
  assert.equal(saved.matches[0].result, '0-1')
  assert.equal(saved.matches[0].grades[0].code, 'blunder')
  const later = gameInput('bot:one', 'correction')
  await store.save(later); await store.save(gameInput())
  assert.ok((await store.list('alice')).matches[0].grades.every(grade => grade.code === 'correction'))
  assert.equal((await store.list('alice')).total, 1)
})

test('last-ten rolling windows and nonoverlapping milestones compare exactly 1–10, 11–20, then 21–30', async () => {
  const store = createMatchStore(storage())
  let milestone = []
  assert.equal(developmentReport(await store.list('alice')).rolling.strongPercent, null)
  for (let index = 1; index <= 31; index++) {
    const saved = await store.save(gameInput(`bot:${index}`, index <= 10 ? 'blunder' : 'good'))
    if (saved.newMilestone) milestone.push(index)
    if (index === 10) { const report = developmentReport(await store.list('alice')); assert.equal(report.ready, false); assert.deepEqual(report.currentRange, [1, 10]) }
    if (index === 20) {
      const report = developmentReport(await store.list('alice'))
      assert.equal(report.ready, true); assert.equal(report.reliable, true)
      assert.deepEqual(report.currentRange, [11, 20]); assert.deepEqual(report.previousRange, [1, 10])
      assert.equal(report.current.errorsPer100, 0); assert.equal(report.previous.errorsPer100, 100)
      assert.match(report.interpretation, /azaldı/)
    }
  }
  const report = developmentReport(await store.list('alice'))
  assert.deepEqual(milestone, [10, 20, 30])
  assert.deepEqual(report.currentRange, [21, 30]); assert.deepEqual(report.previousRange, [11, 20])
  assert.equal(report.rolling.games, 10); assert.equal(report.nextMilestone, 40)
  assert.equal((await store.save(gameInput('bot:30'))).newMilestone, false)
})

test('incomplete games and low/contradictory grade coverage never manufacture an improvement score', async () => {
  const store = createMatchStore(storage())
  const first = gameInput('bot:active', 'good', { moves: ['f3', 'e5'], result: '*', grades: [] })
  await store.save(first)
  assert.equal((await store.list('alice')).total, 0)
  const incorrect = gameInput('bot:invalid')
  incorrect.grades[0].afterFen = new Chess().fen()
  incorrect.grades[1].depth = 5
  assert.equal(compactMatch(incorrect).grades.length, 0)
  for (let index = 0; index < 20; index++) await store.save(gameInput(`bot:weak-${index}`, 'good', { grades: [] }))
  const report = developmentReport(await store.list('alice'))
  assert.equal(report.total, 20); assert.equal(report.ready, true); assert.equal(report.reliable, false)
  assert.equal(report.current.coverage, 0); assert.equal(report.current.strongPercent, null)
  assert.match(report.interpretation, /yeterli değil/)
  const correction = compactMatch(gameInput('bot:corrected', 'correction'))
  const only = developmentReport({ matches: [{ ...correction, ordinal: 1 }], total: 1, profile: 'alice' }).rolling
  assert.equal(only.counts.correction, 2); assert.equal(only.graded, 0); assert.equal(only.coverage, 100)
  assert.equal(only.errorsPer100, null)
})

test('method, opponent, time, mode and assistance changes are disclosed and method changes prevent confident comparison', async () => {
  const store = createMatchStore(storage())
  for (let index = 1; index <= 20; index++) await store.save(gameInput(`bot:context-${index}`, 'good', index > 10 ? {
    metadata: { opponentRating: 1800, timeControl: '180+0' }, mode: 'live', assistance: { settings: ['different-settings'] }
  } : {}))
  const saved = await store.list('alice')
  const report = developmentReport(saved)
  assert.match(report.warnings.join(' '), /seviyesi.*yardım ayarları/)
  assert.ok(report.warnings.some(text => text.includes('süreleri')))
  saved.matches[0].method = 'older-method'
  assert.equal(developmentReport(saved).reliable, false)
})

test('profiles, deletion and unusual but valid usernames stay isolated; storage failures remain observable', async () => {
  const disk = storage(), store = createMatchStore(disk)
  await store.save(gameInput('bot:alice'))
  await store.save(gameInput('bot:bob', 'good', { profile: 'constructor' }))
  assert.equal((await store.list('constructor')).total, 1)
  await store.clear('alice')
  assert.equal((await store.list('alice')).total, 0)
  assert.equal((await store.list('constructor')).total, 1)
  const failed = createMatchStore({ get: async () => ({}), set: async () => { throw new Error('quota') } })
  await assert.rejects(failed.save(gameInput()), /quota/)
  assert.equal(disk.data[journalKey].schema, 1)
  assert.throws(() => compactMatch(gameInput('bot:x', 'good', { moves: ['e4', 'Qh4#'] })))
})

test('one shared lock prevents lost games across two tab stores; retention does not reset lifetime milestones', async () => {
  const disk = storage()
  let lock = Promise.resolve()
  const withLock = work => { const result = lock.then(work); lock = result.catch(() => {}); return result }
  const first = createMatchStore(disk, { withLock }), second = createMatchStore(disk, { withLock })
  await Promise.all(Array.from({ length: 24 }, (_, index) => (index % 2 ? first : second).save(gameInput(`bot:parallel-${index}`))))
  const saved = await first.list('alice')
  assert.equal(saved.total, 24); assert.equal(new Set(saved.matches.map(match => match.ordinal)).size, 24)
  for (let index = 24; index < 105; index++) await first.save(gameInput(`bot:parallel-${index}`))
  const report = developmentReport(await first.list('alice'))
  assert.equal(report.total, 105); assert.equal(report.retained, 100); assert.equal(report.rolling.games, 10)
  assert.deepEqual(report.currentRange, [91, 100]); assert.deepEqual(report.previousRange, [81, 90])
  assert.equal(report.ready, true)
})
