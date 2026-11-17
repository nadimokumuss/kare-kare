import assert from 'node:assert/strict'

const botMatches = ['https://www.chess.com/play/computer*', 'https://www.chess.com/tr/play/computer*']

export function assertBotManifest(manifest, packageVersion) {
  assert.deepEqual(Object.keys(manifest).sort(), [
    'background', 'content_scripts', 'content_security_policy', 'description', 'manifest_version', 'minimum_chrome_version',
    'name', 'permissions', 'version', 'web_accessible_resources'
  ].sort(), 'Bot manifest has unexpected or missing permissions/settings')
  assert.equal(manifest.manifest_version, 3)
  assert.equal(manifest.minimum_chrome_version, '101')
  assert.equal(manifest.version, packageVersion)
  assert.equal(manifest.name, 'Kare Kare — Chess.com Bot Koçu')
  assert.deepEqual(manifest.permissions, ['storage', 'tts'])
  assert.deepEqual(manifest.background, { service_worker: 'speech-worker.js', type: 'module' })
  assert.deepEqual(manifest.content_security_policy, {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';"
  })
  assert.deepEqual(manifest.content_scripts, [{
    matches: botMatches,
    js: ['content.js'],
    css: ['content.css'],
    run_at: 'document_idle'
  }])
  assert.deepEqual(manifest.web_accessible_resources, [{
    resources: ['engine.html', 'engine.js'],
    matches: ['https://www.chess.com/*']
  }])
}
