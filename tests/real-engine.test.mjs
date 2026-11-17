import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { spawn } from 'node:child_process'
import { describeLines, scoreValue } from '../extension/coach-core.js'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const createEngine = require('stockfish')
const enginePath = createEngine.findEngine('lite-single')
const forkFen = 'rn3Qn1/1k1q2p1/p1p1N3/1p1p4/3P4/4B2r/PP2BP1P/2KR3R w - - 1 21'

function analyze(searchMove, fen = forkFen, depth = 14) {
  return new Promise((resolve, reject) => {
    let latest = ''
    let buffer = ''
    let settled = false
    const engine = spawn(process.execPath, [enginePath], { stdio: ['pipe', 'pipe', 'pipe'] })
    const timer = setTimeout(() => { engine.kill(); reject(new Error('Engine timeout')) }, 10000)
    engine.stdout.on('data', chunk => {
      buffer += chunk.toString()
      const lines = buffer.split(/\r?\n/)
      buffer = lines.pop()
      for (const line of lines) {
        if (line.startsWith('info ') && line.includes(' pv ')) latest = line
        if (!/\bbestmove /.test(line) || settled) continue
        settled = true
        clearTimeout(timer)
        engine.kill()
        const score = latest.match(/\bscore (cp|mate) (-?\d+)/)
        const pv = latest.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+)/)?.[1]?.trim().split(/\s+/)
        if (!score || !pv?.length) reject(new Error('No engine variation'))
        else resolve({ rank: 1, depth: Number(latest.match(/\bdepth (\d+)/)?.[1] || 0), score: { type: score[1], value: Number(score[2]) }, pv })
      }
    })
    engine.once('error', error => { clearTimeout(timer); reject(error) })
    engine.stdin.write(`uci\nisready\nsetoption name MultiPV value 1\nposition fen ${fen}\ngo depth ${depth} movetime 2500 searchmoves ${searchMove}\n`)
  })
}

test('a real engine confirms 21.Nc5+ and rejects the tempting 21.Qc8+ fork', async () => {
  const good = describeLines(forkFen, [await analyze('e6c5')])[0]
  const bad = describeLines(forkFen, [await analyze('f8c8')])[0]
  assert.equal(good.san, 'Nc5+')
  assert.equal(good.kind, 'Şah–vezir çatalı')
  assert.equal(good.continuation, 'Nxd7')
  assert.equal(bad.san, 'Qc8+')
  assert.ok(scoreValue(good.score) - scoreValue(bad.score) > 500)
})

test('a real engine prefers the knight capture over the rook sacrifice in the newly submitted game', async () => {
  const { exchange19Fen: fen } = JSON.parse(readFileSync(new URL('./fixtures/feedback-090.json', import.meta.url)))
  const knight = describeLines(fen, [await analyze('d4e6', fen, 16)])[0]
  const rook = describeLines(fen, [await analyze('e1e6', fen, 16)])[0]
  assert.equal(knight.san, 'Nxe6')
  assert.equal(rook.san, 'Rxe6+')
  assert.ok(scoreValue(knight.score) - scoreValue(rook.score) > 200)
  assert.match(knight.captureComparison.text, /Rxe6\+ yerine Nxe6/)
})

test('a real engine confirms the checking removal of a defender and its profitable followup', async () => {
  const fen = '7k/8/5n2/3r2B1/8/8/8/3Q2K1 w - - 0 1'
  const line = await analyze('g5f6', fen, 16)
  const candidate = describeLines(fen, [line])[0]
  assert.equal(candidate.san, 'Bxf6+')
  assert.ok(scoreValue(candidate.score) > 200)
  assert.ok(candidate.motifs.some(motif => motif.type === 'removeDefender' && motif.evidence.san.startsWith('Qxd5')))
})
