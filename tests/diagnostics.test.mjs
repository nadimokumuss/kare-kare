import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiagnosticReporter, diagnosticKey } from '../extension/diagnostics.js'

test('review diagnostics stay local, omit URL query strings, and cap history', async () => {
  const data = {}
  const storage = {
    async get(key) { return { [key]: data[key] } },
    async set(value) { Object.assign(data, value) }
  }
  const report = createDiagnosticReporter(true, storage, '/game/live/123')
  for (let index = 0; index < 45; index++) await report({ stage: `stage_${index}`, pieceCount: index })
  assert.equal(data[diagnosticKey].length, 40)
  assert.equal(data[diagnosticKey].at(-1).route, '/game/live/123')
  assert.equal(data[diagnosticKey].at(-1).pieceCount, 44)
  await report({ stage: 'stage_44', pieceCount: 44 })
  assert.equal(data[diagnosticKey].length, 40)
  const disabled = createDiagnosticReporter(false, storage, '/game/live/999')
  await disabled({ stage: 'should_not_exist' })
  assert.equal(data[diagnosticKey].length, 40)
})

test('diagnostics use the current route after a single-page transition', async () => {
  const data = {}
  const storage = { async get(key) { return { [key]: data[key] } }, async set(value) { Object.assign(data, value) } }
  let route = '/play/online'
  const report = createDiagnosticReporter(true, storage, () => route)
  await report({ stage: 'coach_mounted' })
  route = '/new-game-route/123'
  await report({ stage: 'unsupported_route' })
  assert.equal(data[diagnosticKey].at(-1).route, '/new-game-route/123')
})
