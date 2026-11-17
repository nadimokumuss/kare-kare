import { build } from 'vite'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { assertBotManifest } from './manifest-policy.mjs'
import { assertReviewManifest, reviewMatches, validateReviewConfig } from './review-policy.mjs'

const root = process.cwd()
const liveEnabled = process.env.KARE_LIVE_ENABLED === '1'
const out = resolve(root, liveEnabled ? 'extension/dist-review' : 'extension/dist')
const accounts = (process.env.KARE_LIVE_ACCOUNTS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean)
const from = process.env.KARE_LIVE_FROM || ''
const until = process.env.KARE_LIVE_UNTIL || ''
const packageVersion = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version
const manifest = JSON.parse(await readFile(resolve(root, 'extension/manifest.json'), 'utf8'))
assertBotManifest(manifest, packageVersion)
if (liveEnabled) validateReviewConfig(accounts, from, until)
const defines = {
  __KARE_LIVE_ENABLED__: JSON.stringify(liveEnabled),
  __KARE_LIVE_ACCOUNTS__: JSON.stringify(accounts),
  __KARE_LIVE_FROM__: JSON.stringify(from),
  __KARE_LIVE_UNTIL__: JSON.stringify(until)
}
await build({
  configFile: false,
  root,
  publicDir: false,
  define: defines,
  build: {
    outDir: out,
    emptyOutDir: true,
    lib: { entry: resolve(root, 'extension/content.js'), name: 'KareKareBotCoach', formats: ['iife'], fileName: () => 'content.js' }
  }
})
await build({
  configFile: false, root, publicDir: false, define: defines,
  build: { outDir: out, emptyOutDir: false,
    lib: { entry: resolve(root, 'extension/speech-worker.js'), name: 'KareKareSpeechWorker', formats: ['iife'], fileName: () => 'speech-worker.js' }
  }
})
await mkdir(out, { recursive: true })
for (const filename of ['content.css', 'engine.html', 'engine.js']) await copyFile(resolve(root, 'extension', filename), resolve(out, filename))
if (liveEnabled) {
  manifest.content_scripts[0].matches = [...reviewMatches]
  manifest.name = 'Kare Kare — Chess.com İnceleme Sürümü'
  manifest.description = 'Belirlenmiş Chess.com test hesapları ve süre içinde standart canlı ve günlük oyunları inceleyen Türkçe satranç koçu.'
  manifest.action = { default_popup: 'diagnostics.html', default_title: 'Kare Kare review diagnostics' }
  for (const filename of ['diagnostics.html', 'diagnostics.css', 'diagnostics-popup.js', 'diagnostics.js']) {
    await copyFile(resolve(root, 'extension', filename), resolve(out, filename))
  }
  assertReviewManifest(manifest, packageVersion)
}
else assertBotManifest(manifest, packageVersion)
await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
if (liveEnabled) await writeFile(resolve(out, 'review-config.json'), JSON.stringify({ accounts, from, until }, null, 2) + '\n')
for (const filename of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) await copyFile(resolve(root, 'node_modules/stockfish/bin', filename), resolve(out, filename))
