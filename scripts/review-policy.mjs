import assert from 'node:assert/strict'
import { ownerAccounts } from '../extension/game-mode.js'

export const reviewMatches = Object.freeze([
  'https://www.chess.com/play/computer*',
  'https://www.chess.com/tr/play/computer*',
  ...['', '/tr'].flatMap(prefix => [
    `https://www.chess.com${prefix}/play/online*`,
    `https://www.chess.com${prefix}/play/live*`,
    `https://www.chess.com${prefix}/game/live/*`,
    // Chrome match patterns cannot express a numeric ID; gameMode checks it.
    `https://www.chess.com${prefix}/game/*`,
    `https://www.chess.com${prefix}/play/daily*`,
    `https://www.chess.com${prefix}/game/daily/*`
  ])
])

export function validateReviewConfig(accounts, from, until, now = new Date()) {
  assert.ok(Array.isArray(accounts) && accounts.length > 0 && accounts.length <= 10,
    'Reviewer build needs 1–10 designated accounts')
  assert.ok(accounts.every(account => /^[a-z0-9_-]{3,25}$/.test(account)), 'Invalid Chess.com account name')
  assert.equal(new Set(accounts).size, accounts.length, 'Reviewer accounts must be unique')
  assert.ok(accounts.every(account => !ownerAccounts.includes(account)), 'Owner accounts cannot enter a reviewer build')
  const dateFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/
  assert.ok(dateFormat.test(from) && dateFormat.test(until), 'Review dates need an explicit timezone')
  const start = Date.parse(from)
  const end = Date.parse(until)
  assert.ok(Number.isFinite(start) && Number.isFinite(end) && start < end, 'Invalid review window')
  assert.ok(end > now.getTime() && end - start <= 90 * 24 * 60 * 60 * 1000,
    'Review window must be current or future and no longer than 90 days')
  return { accounts, from, until }
}

export function assertReviewManifest(manifest, version) {
  assert.deepEqual(Object.keys(manifest).sort(), [
    'action', 'background', 'content_scripts', 'content_security_policy', 'description', 'manifest_version', 'minimum_chrome_version',
    'name', 'permissions', 'version', 'web_accessible_resources'
  ].sort())
  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.minimum_chrome_version, '101')
  assert.equal(manifest.version, version)
  assert.equal(manifest.name, 'Kare Kare — Chess.com İnceleme Sürümü')
  assert.deepEqual(manifest.action, { default_popup: 'diagnostics.html', default_title: 'Kare Kare review diagnostics' })
  assert.deepEqual(manifest.permissions, ['storage', 'tts'])
  assert.deepEqual(manifest.background, { service_worker: 'speech-worker.js', type: 'module' })
  assert.deepEqual(manifest.content_security_policy, {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  })
  assert.deepEqual(manifest.content_scripts, [{
    matches: reviewMatches,
    js: ['content.js'],
    css: ['content.css'],
    run_at: 'document_idle'
  }])
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ['engine.html', 'engine.js'],
    matches: ['https://www.chess.com/*']
  }])
}
