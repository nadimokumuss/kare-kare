import { cp, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { basename, resolve } from 'node:path'
import { assertBotManifest } from './manifest-policy.mjs'
import { assertReviewManifest, validateReviewConfig } from './review-policy.mjs'

const root = process.cwd()
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version
const sourceManifest = JSON.parse(await readFile(resolve(root, 'extension/manifest.json'), 'utf8'))
const built = resolve(root, 'extension/dist-review')
const manifest = JSON.parse(await readFile(resolve(built, 'manifest.json'), 'utf8'))
const config = JSON.parse(await readFile(resolve(built, 'review-config.json'), 'utf8'))
assertBotManifest(sourceManifest, version)
assertReviewManifest(manifest, version)
validateReviewConfig(config.accounts, config.from, config.until)

const base = `kare-kare-chesscom-review-v${version}`
const release = resolve(root, 'release')
const folder = resolve(release, base)
await mkdir(release, { recursive: true })
await rm(folder, { recursive: true, force: true })
await cp(built, folder, { recursive: true })
await copyFile(resolve(root, 'extension/REVIEW.md'), resolve(folder, 'README.md'))
await copyFile(resolve(root, 'extension/REVIEW-GUIDE.md'), resolve(folder, 'INSTALLATION-AND-TEST-GUIDE.md'))
await copyFile(resolve(root, 'extension/RELEASE-NOTES.md'), resolve(folder, 'RELEASE-NOTES.md'))
await copyFile(resolve(root, 'LICENSE'), resolve(folder, 'LICENSE'))
await copyFile(resolve(root, 'extension/ARAYUZ-VE-ANLATIM-PLANI.md'), resolve(folder, 'ARAYUZ-VE-ANLATIM-PLANI.md'))
await copyFile(resolve(root, 'extension/ACCEPTANCE-CHECKLIST.md'), resolve(folder, 'ACCEPTANCE-CHECKLIST.md'))
await copyFile(resolve(root, 'extension/GELISTIRME-PLANI.md'), resolve(folder, 'GELISTIRME-PLANI.md'))
await copyFile(resolve(root, 'diagnostics/NATURAL-VOICE-EXPERIMENT.md'), resolve(folder, 'NATURAL-VOICE-EXPERIMENT.md'))
const source = resolve(folder, 'source')
await mkdir(source)
await mkdir(resolve(source, 'extension'))
for (const name of ['content.js', 'content.css', 'coach-core.js', 'coach-layout.js', 'narration.js', 'board-overlays.js', 'keyboard-controls.js', 'match-journal.js', 'position-coaching.js', 'coach-insights.js', 'speech-coach.js', 'speech-editor.js', 'sound-effects.js', 'move-grades.js', 'native-speech.js', 'tts-host.js', 'speech-worker.js', 'game-checkpoint.js', 'board-sync.js', 'game-mode.js', 'engine-recovery.js', 'account-identity.js', 'engine.js', 'engine.html', 'diagnostics.js', 'diagnostics.html', 'diagnostics.css', 'diagnostics-popup.js', 'manifest.json', 'README.md', 'REVIEW.md', 'REVIEW-GUIDE.md', 'RELEASE-NOTES.md', 'GELISTIRME-PLANI.md', 'ACCEPTANCE-CHECKLIST.md', 'ARAYUZ-VE-ANLATIM-PLANI.md']) {
  await copyFile(resolve(root, 'extension', name), resolve(source, 'extension', name))
}
await copyFile(resolve(root, 'LICENSE'), resolve(source, 'LICENSE'))
for (const name of ['package.json', 'package-lock.json']) await copyFile(resolve(root, name), resolve(source, name))
await cp(resolve(root, 'scripts'), resolve(source, 'scripts'), { recursive: true })
await cp(resolve(root, 'tests'), resolve(source, 'tests'), { recursive: true, filter: path => basename(path) !== '__pycache__' && !path.endsWith('.pyc') })
await cp(resolve(root, 'diagnostics'), resolve(source, 'diagnostics'), { recursive: true, filter: path => basename(path) !== '__pycache__' && !path.endsWith('.pyc') })
await copyFile(resolve(root, 'node_modules/chess.js/LICENSE'), resolve(source, 'CHESSJS-LICENSE.txt'))
await writeFile(resolve(source, 'STOCKFISH-SOURCE.txt'),
  'Bundled Stockfish.js 19.0.1 lite single-threaded engine corresponding source:\nhttps://github.com/nmrugg/stockfish.js/tree/19.0.1\nLicense: GPL-3.0, included as LICENSE.\n')
const zip = resolve(release, `${base}.zip`)
await rm(zip, { force: true })
execFileSync('zip', ['-q', '-r', zip, '.'], { cwd: folder })
console.log(folder)
console.log(zip)
