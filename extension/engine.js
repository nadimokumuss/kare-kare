let worker
const jobs = []
let ready = false
let busy = false
let lines = new Map()

function send(type, extra = {}) {
  parent.postMessage({ source: 'kare-kare-engine', type, ...extra }, 'https://www.chess.com')
}

try { worker = new Worker('stockfish-19-lite-single.js') }
catch (error) { send('error', { message: error.message }); throw error }

function pump() {
  if (!ready || busy || !jobs.length) return
  busy = true
  lines = new Map()
  worker.postMessage(`setoption name MultiPV value ${jobs[0].searchMove ? 1 : 3}`)
  worker.postMessage(`position fen ${jobs[0].fen}`)
  worker.postMessage(`go depth 16 movetime 1800${jobs[0].searchMove ? ` searchmoves ${jobs[0].searchMove}` : ''}`)
}

worker.onmessage = event => {
  const line = String(event.data)
  if (line.includes('readyok')) { ready = true; send('ready'); pump(); return }
  if (!busy) return
  if (line.startsWith('info ') && line.includes(' pv ')) {
    const depth = Number(line.match(/\bdepth (\d+)/)?.[1])
    const rank = Number(line.match(/\bmultipv (\d+)/)?.[1] || 1)
    const score = line.match(/\bscore (cp|mate) (-?\d+)/)
    const pv = line.match(/\bpv ((?:[a-h][1-8][a-h][1-8][qrbn]?\s*)+)/)?.[1]?.trim().split(/\s+/)
    if (depth && rank <= (jobs[0].searchMove ? 1 : 3) && score && pv?.length && !/\b(?:upperbound|lowerbound)\b/.test(line) && depth >= (lines.get(rank)?.depth || 0)) {
      lines.set(rank, { rank, depth, score: { type: score[1], value: Number(score[2]) }, pv })
    }
  }
  const match = line.match(/\bbestmove ([a-h][1-8][a-h][1-8][qrbn]?)/)
  if (match || /^bestmove (?:\(none\)|0000)/.test(line)) {
    const job = jobs.shift()
    busy = false
    const analysis = [...lines.values()].sort((a, b) => a.rank - b.rank)
    if (!analysis.length && match) analysis.push({ rank: 1, depth: 0, pv: [match[1]] })
    send('analysis', { id: job.id, lines: analysis })
    pump()
  }
}
worker.onerror = event => send('error', { message: event.message || 'Stockfish işçisi yüklenemedi' })
worker.onmessageerror = () => send('error', { message: 'Stockfish mesajı okunamadı' })

window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== 'https://www.chess.com') return
  if (event.data?.source !== 'kare-kare-content' || event.data.type !== 'analyze') return
  if (typeof event.data.fen !== 'string') return
  const searchMove = /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(event.data.searchMove || '') ? event.data.searchMove : null
  jobs.splice(busy ? 1 : 0)
  jobs.push({ id: event.data.id, fen: event.data.fen, searchMove })
  pump()
})

worker.postMessage('uci')
worker.postMessage('isready')
