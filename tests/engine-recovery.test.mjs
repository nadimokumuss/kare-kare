import test from 'node:test'
import assert from 'node:assert/strict'
import { withEngineRecovery } from '../extension/engine-recovery.js'

test('a failed engine search restarts once and returns the current position result', async () => {
  let calls = 0
  let restarts = 0
  const result = await withEngineRecovery(
    async () => { if (++calls === 1) throw new Error('Motor zaman aşımı'); return 'current move' },
    () => true,
    () => { restarts++ }
  )
  assert.equal(result, 'current move')
  assert.equal(calls, 2)
  assert.equal(restarts, 1)
})

test('an obsolete board position never restarts or overwrites a newer analysis', async () => {
  let current = true
  let restarts = 0
  await assert.rejects(withEngineRecovery(
    async () => { current = false; throw new Error('Motor zaman aşımı') },
    () => current,
    () => { restarts++ }
  ), /Motor zaman aşımı/)
  assert.equal(restarts, 0)
})
