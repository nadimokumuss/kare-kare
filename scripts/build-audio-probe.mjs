import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const samplePath = process.argv[2]
if (!samplePath) throw new Error('Pass a verified, non-silent WAV sample path')
const source = await readFile(resolve('diagnostics/audio-probe.html'), 'utf8')
const sample = await readFile(samplePath)
if (sample.toString('ascii', 0, 4) !== 'RIFF' || sample.toString('ascii', 8, 12) !== 'WAVE' || sample.length < 5000) throw new Error('Expected a non-empty WAV sample')
const target = resolve('release/kare-kare-bagimsiz-ses-denemesi-v2.html')
await writeFile(target, source.replace('__SAMPLE_AUDIO__', sample.toString('base64')))
console.log(target)
