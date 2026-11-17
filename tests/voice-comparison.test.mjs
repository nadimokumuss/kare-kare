import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Script } from 'node:vm'

const builder = resolve('scripts/build-voice-comparison.mjs')
async function fixture(run) {
  const folder = await mkdtemp(resolve(tmpdir(), 'kare-voice-'))
  try {
    await mkdir(resolve(folder, 'diagnostics')); await mkdir(resolve(folder, 'release'))
    await writeFile(resolve(folder, 'diagnostics/voice-samples.json'), '[{"id":"grade","text":"İyi hamle."}]')
    await run(folder)
  } finally { await rm(folder, { recursive: true, force: true }) }
}

test('the standalone comparison embeds local WAVs, escapes reports and compiles without an external voice service', async () => {
  await fixture(async folder => {
    const wav = Buffer.alloc(46)
    wav.write('RIFF', 0); wav.writeUInt32LE(38, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(22050, 24); wav.writeUInt32LE(44100, 28)
    wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(2, 40); wav.writeInt16LE(5000, 44)
    await writeFile(resolve(folder, 'system-grade.wav'), wav)
    await writeFile(resolve(folder, 'report.json'), JSON.stringify({ backend: 'system', error: '</script><script>bad()</script>',
      rows: [{ id: 'grade', text: 'İyi hamle.', status: 'generated', file: 'system-grade.wav', generation_seconds: 0.1, audio_seconds: 1 }] }))
    execFileSync(process.execPath, [builder, 'report.json'], { cwd: folder })
    const html = await readFile(resolve(folder, 'release/kare-kare-ses-karsilastirma.html'), 'utf8')
    assert.match(html, /data:audio\/wav;base64/)
    assert.doesNotMatch(html, /<script>bad\(\)/)
    assert.doesNotMatch(html, /fetch\(|XMLHttpRequest|src="https?:/)
    assert.doesNotThrow(() => new Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]))
  })
})

test('a report cannot make the builder embed an arbitrary file outside its audio folder', async () => {
  await fixture(async folder => {
    await writeFile(resolve(folder, 'report.json'), JSON.stringify({ backend: 'system', rows: [
      { id: 'grade', text: 'İyi hamle.', status: 'generated', file: '../private.wav' }
    ] }))
    assert.throws(() => execFileSync(process.execPath, [builder, 'report.json'], { cwd: folder, stdio: 'pipe' }), /Invalid audio filename/)
  })
})
