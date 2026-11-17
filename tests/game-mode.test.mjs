import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { boardSelectors, gameMode, liveAccountAllowed, liveConfig, ownerAccounts, reviewAccess } from '../extension/game-mode.js'
import { assertBotManifest } from '../scripts/manifest-policy.mjs'
import { assertReviewManifest, reviewMatches, validateReviewConfig } from '../scripts/review-policy.mjs'

test('the standard package cannot run on human games', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
  const packageVersion = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  assert.doesNotThrow(() => assertBotManifest(manifest, packageVersion))
  assert.equal(liveConfig.enabled, false)
  assert.deepEqual(manifest.content_scripts[0].matches, ['https://www.chess.com/play/computer*', 'https://www.chess.com/tr/play/computer*'])
  assert.equal(gameMode('/play/computer'), 'bot')
  assert.equal(gameMode('/tr/play/computer'), 'bot')
  for (const path of ['/play/online', '/game/live/123', '/play/daily', '/game/daily/456']) assert.equal(gameMode(path), null)
})

test('a release with wider page access or missing style/engine settings is rejected', () => {
  const manifest = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
  const version = manifest.version
  const altered = change => {
    const copy = structuredClone(manifest)
    change(copy)
    assert.throws(() => assertBotManifest(copy, version))
  }
  altered(copy => { copy.content_scripts[0].matches = ['https://www.chess.com/play/*'] })
  altered(copy => { copy.host_permissions = ['https://*.chess.com/*'] })
  altered(copy => { delete copy.content_scripts[0].css })
  altered(copy => { delete copy.content_security_policy })
  altered(copy => { copy.web_accessible_resources[0].resources.push('dist/*') })
  altered(copy => { copy.permissions.push('ttsEngine') })
  altered(copy => { copy.background.service_worker = 'unrecognized-worker.js' })
})

test('the future live adapter needs the right account and a valid time window', () => {
  const config = { enabled: true, accounts: ['chesscomreviewer'], from: '2026-10-23T00:00:00+03:00', until: '2026-11-30T23:59:59+03:00' }
  assert.equal(gameMode('/play/online', config), 'live')
  assert.equal(gameMode('/game/live/123', config), 'live')
  assert.equal(gameMode('/game/185883631442', config), 'live')
  assert.equal(gameMode('/tr/game/185883631442', config), 'live')
  assert.equal(gameMode('/game/analysis', config), null)
  assert.equal(gameMode('/game/185883631442/analysis', config), null)
  assert.equal(gameMode('/play/live.html', config), 'live')
  assert.equal(gameMode('/tr/game/daily/456', config), 'daily')
  assert.equal(gameMode('/play/daily.html', config), 'daily')
  assert.equal(gameMode('/analysis', config), null)
  assert.equal(liveAccountAllowed('chesscomreviewer', new Date('2026-10-24T12:00:00+03:00'), config), true)
  assert.equal(liveAccountAllowed('chesscomreviewer', new Date('2026-10-22T23:59:59+03:00'), config), false)
  assert.equal(liveAccountAllowed('chessofmakekek', new Date('2026-10-24T12:00:00+03:00'), config), false)
  assert.equal(liveAccountAllowed('chesscomreviewer', new Date('2026-12-01T00:00:00+03:00'), config), false)
  for (const account of ownerAccounts) assert.equal(liveAccountAllowed(account, new Date('2026-10-24T12:00:00+03:00'), { ...config, accounts: [account] }), false)
  assert.ok(boardSelectors('live').length > 0)
})

test('review builds stay within designated accounts, dates and game pages', () => {
  const valid = ['chesscomreviewer']
  assert.deepEqual(validateReviewConfig(valid, '2026-10-25T00:00:00+03:00', '2026-11-15T00:00:00+03:00', new Date('2026-10-24T12:00:00+03:00')).accounts, valid)
  assert.throws(() => validateReviewConfig(['ivanofchess'], '2026-10-25T00:00:00+03:00', '2026-11-15T00:00:00+03:00', new Date('2026-10-24T12:00:00+03:00')))
  assert.throws(() => validateReviewConfig(valid, '2026-10-25', '2026-11-15', new Date('2026-10-24T12:00:00+03:00')))
  const bot = JSON.parse(readFileSync(new URL('../extension/manifest.json', import.meta.url), 'utf8'))
  const review = structuredClone(bot)
  review.name = 'Kare Kare — Chess.com İnceleme Sürümü'
  review.action = { default_popup: 'diagnostics.html', default_title: 'Kare Kare review diagnostics' }
  review.content_scripts[0].matches = [...reviewMatches]
  assert.doesNotThrow(() => assertReviewManifest(review, bot.version))
  review.content_scripts[0].matches.push('https://www.chess.com/*')
  assert.throws(() => assertReviewManifest(review, bot.version))
})

test('a verified reviewer survives a missing header during game start, but an observed account switch closes access', () => {
  const config = { enabled: true, accounts: ['hisaycheese'], from: '2026-10-24T18:00:00+03:00', until: '2026-11-23T18:00:00+03:00' }
  const now = new Date('2026-10-25T12:00:00+03:00')
  const lobby = reviewAccess('hisaycheese', null, now, config)
  assert.equal(lobby.allowed, true)
  assert.equal(reviewAccess(null, lobby.verifiedAccount, now, config).allowed, true)
  assert.equal(reviewAccess('ivanofchess', lobby.verifiedAccount, now, config).allowed, false)
  assert.equal(reviewAccess(null, null, now, config).allowed, false)
  assert.equal(reviewAccess(null, lobby.verifiedAccount, new Date('2026-11-24T00:00:00+03:00'), config).allowed, false)
})
