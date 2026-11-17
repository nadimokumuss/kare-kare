import { Chess } from 'chess.js'
import { briefExplanation, profitableCaptures, scoreValue, variationMoves } from './coach-core.js'

export const candidateColors = Object.freeze(['#d6f263', '#68d4e9', '#ffa96a'])
export const candidateSignature = candidates => (candidates || []).map(candidate => `${candidate.uci}:${(candidate.pv || []).join(',')}:${(candidate.motifs || []).map(motif => `${motif.type}:${(motif.targets || []).join(',')}`).join(';')}`).join('|')
const opposite = color => color === 'w' ? 'b' : 'w'
const square = value => /^[a-h][1-8]$/.test(value || '')
const clean = text => String(text || '').trim().toLocaleLowerCase('tr-TR')
const uci = move => move.from + move.to + (move.promotion || '')

// A square in prose is not a move. Match only SAN from already-verified lines,
// and exclude the common "e4 karesindeki" / "e4'teki" coordinate usages.
function mentionsMove(text, san) {
  let from = 0
  while (san && from < text.length) {
    const at = text.indexOf(san, from)
    if (at < 0) return false
    const prefix = text.slice(Math.max(0, at - 1), at)
    const suffix = text.slice(at + san.length)
    if (!/[\p{L}\p{N}]/u.test(prefix) && !/^[\p{L}\p{N}'’]/u.test(suffix) && !/^\s+kare/iu.test(suffix)) return true
    from = at + san.length
  }
  return false
}

export function speechParts(text) {
  return String(text || '').trim().split(/(?<=[.!?])\s+(?=[A-ZÇĞİÖŞÜ])/u).filter(Boolean)
    .flatMap(sentence => sentence.split(/(?<=,)\s+(?=(?:sen|rakip|ardından)\b)/iu))
}

function verifiedLines(fen, candidates) {
  return (candidates || []).flatMap((candidate, rank) => {
    if (candidate.depth < 10 || scoreValue(candidate.score) === null) return []
    const pv = candidate.pv?.length ? candidate.pv : [candidate.uci]
    const moves = variationMoves(fen, pv, 6)
    if (!moves.length || uci(moves[0]) !== candidate.uci) return []
    return [{ candidate, rank, moves }]
  })
}

const motion = (move, rank, step, playerColor) => ({ from: move.from, to: move.to, color: move.color,
  rank: step === 1 || move.color === playerColor ? rank : null, step, opponent: move.color !== playerColor,
  conditional: step > 1 || move.color !== playerColor })
const evidence = (line, index = 0, motif = null) => ({ rank: line.rank, uci: line.candidate.uci,
  pv: line.moves.slice(0, index + 1).map(uci), motif: motif ? { type: motif.type, targets: motif.targets || [] } : null })
function moveCue(fen, line, index, playerColor, tactical = false) {
  const move = line.moves[index]
  const step = index + 1, enemy = move.color !== playerColor
  return { fen, kind: 'move', tactical, source: 'candidate', evidence: [evidence(line, index)], label: `${step > 1 ? `Örnek devam ${step} · ` : ''}${enemy ? `Rakip${step === 1 ? ` · ${line.rank + 1}. aday` : ''}` : `${line.rank + 1}. aday`}`,
    moves: [motion(move, line.rank, step, playerColor)], setup: line.moves.slice(0, index).map((previous, n) => motion(previous, line.rank, n + 1, playerColor)), targets: [] }
}

export function narrationSegments({ text, action = 'comment', fen, candidates = [], playerColor, view = null, alert = null, alerts = [], hidden = false, allowReveal = false }) {
  if (!text || !fen || (hidden && !allowReveal) || ['grades', 'repeat'].includes(action)) return []
  let game, lines
  try { game = new Chess(fen); lines = verifiedLines(fen, candidates) } catch { return [] }
  if (!lines.length || (view && view.fen !== fen)) return []
  const specific = /^candidate[123]$/.test(action) ? Number(action.at(-1)) - 1 : null
  if (specific !== null) lines = lines.filter(line => line.rank === specific)
  const threats = profitableCaptures(game, opposite(playerColor))
  const allAlerts = alert ? [alert] : alerts
  const tacticalContext = !!alert || action === 'tactics'
  const cueFor = (part, partIndex) => {
    const normalized = clean(part)
    if (game.isCheck() && /şahın tehdit altında|şahının güvenliğini|şah savunmasını/iu.test(part)) {
      const king = game.board().flat().find(piece => piece?.type === 'k' && piece.color === game.turn())
      if (king) return { fen, kind: 'targets', source: 'check', tactical: true, label: 'Şah savunması', moves: [], setup: [], targets: [king.square] }
    }
    // Position-change targets come from the actual before/after comparison.
    const change = view?.changes?.find(item => clean(item.text) === normalized)
    if (change) {
      let targets = (change.targets || []).filter(square)
      if (change.type === 'open-file') targets = '12345678'.split('').map(rank => change.targets[0] + rank).filter(square)
      const known = change.move && lines.find(line => line.moves[0].from === change.move.from && line.moves[0].to === change.move.to)
      const moves = change.move && square(change.move.from) && square(change.move.to) ? [{ ...change.move, opponent: change.actor !== playerColor, rank: known?.rank ?? null, step: 1, conditional: change.actor !== game.turn() }] : []
      return { fen, kind: 'change', source: 'change', tactical: change.type !== 'open-file', label: change.actor && change.actor !== playerColor ? 'Rakip · Konumdaki değişim' : 'Konumdaki değişim', moves, setup: [], targets }
    }
    const threat = threats.find(item => mentionsMove(part, item.san))
    if (threat && /rakip/i.test(part) && /yanıt vermezsen|önlem almazsan|alışıyla|kazanç sağlayabilir|tehdit/i.test(part)) return {
      fen, kind: 'threat', tactical: true, source: 'profitable-capture', label: 'Rakip · Önlem alınmazsa',
      moves: [{ from: threat.from, to: threat.to, color: opposite(playerColor), opponent: true, rank: null, step: 1, conditional: game.turn() === playerColor }], setup: [], targets: [threat.to] }
    const mate = allAlerts.find(item => item.channel === 'mate' && normalized.includes(`${item.mateIn} hamlede`) && /mat/.test(normalized))
    if (mate) {
      const first = lines[0], index = first.moves.findIndex(move => move.color === mate.color)
      if (index >= 0) return { ...moveCue(fen, first, index, playerColor, true), label: `${mate.color === playerColor ? 'Mat yolu' : 'Rakibin mat yolu'} · Örnek devam ${index + 1}` }
    }
    const namesMove = lines.some(line => line.moves.some(move => mentionsMove(part, move.san)))
    for (const line of lines) {
      const motif = line.candidate.motifs?.find(item => item.type !== 'capture' && ((item.label && normalized.includes(clean(item.label))) ||
        (item.targets?.some(target => normalized.includes(target)) && /çatal|açmaz|şiş|hedef|saldır|şah|vezir/iu.test(part))))
      if (motif && !namesMove) return { fen, kind: 'targets', tactical: true, source: 'motif', evidence: [evidence(line, 0, motif)],
        label: `${line.candidate.color === playerColor ? '' : 'Rakip · '}${motif.label}`, moves: [], setup: [], targets: (motif.targets || []).filter(target => square(target) && (normalized.includes(clean(motif.label)) || normalized.includes(target))) }
    }
    let matches = lines.flatMap(line => line.moves.flatMap((move, index) => mentionsMove(part, move.san) ? [{ line, index }] : []))
    if (action === 'comparison') {
      const firstMoves = matches.filter(item => item.index === 0)
      if (firstMoves.length > 1) return { fen, kind: 'comparison', source: 'candidate', tactical: false, evidence: firstMoves.slice(0, 2).map(({ line }) => evidence(line)), label: 'Aday karşılaştırması',
        moves: firstMoves.slice(0, 2).map(({ line }) => motion(line.moves[0], line.rank, 1, playerColor)), setup: [], targets: [] }
    }
    // The same SAN can describe opposite sides of an exchange (Nxd7 Nxd7).
    // Without an explicit actor, do not guess which recapture is being read.
    if (new Set(matches.map(({ line, index }) => line.moves[index].san)).size > 1) return null
    const ownHint = /^(?:sen |senin |ardından sen |güncel ilk adım |ilk adım )/u.test(normalized)
    const enemyHint = /^(?:rakip |ardından rakip |rakibin hesaplanan |rakibin \d+\. adayı )/u.test(normalized)
    if (ownHint || enemyHint) matches = matches.filter(({ line, index }) => (line.moves[index].color === playerColor) === ownHint)
    const root = matches.find(({ line, index }) => index === 0 && ((specific !== null && partIndex === 0) || normalized.startsWith(`${clean(line.moves[0].san)}:`)))
    if (root) matches = [root]
    if (new Set(matches.map(({ line, index }) => line.moves[index].color)).size > 1) return null
    if (matches.length) {
      const { line, index } = matches[0]
      const cue = moveCue(fen, line, index, playerColor, tacticalContext || !!line.candidate.motifs?.some(item => item.type !== 'capture') || !!line.moves[index].captured || line.moves[index].san.includes('#'))
      const namedMotif = index === 0 && line.candidate.motifs?.find(item => item.type !== 'capture' && item.label &&
        (normalized.includes(clean(item.label)) || (item.targets?.length > 1 && item.targets.every(target => normalized.includes(target)))))
      if (namedMotif) { cue.targets = (namedMotif.targets || []).filter(square); cue.evidence = [evidence(line, index, namedMotif)] }
      return cue
    }
    for (const line of lines) {
      const description = clean(briefExplanation(line.candidate, line.moves[0].color === playerColor))
      if ((description.length > 24 && normalized.includes(description)) || (specific !== null && partIndex === 0)) return moveCue(fen, line, 0, playerColor,
        tacticalContext || !!line.candidate.motifs?.some(item => item.type !== 'capture') || !!line.moves[0].captured)
    }
    return null
  }
  const segments = speechParts(text).map((part, index) => ({ text: part, cue: cueFor(part, index) }))
  if (!segments.some(segment => segment.cue)) return []
  // Keep natural phrasing when adjacent sentences describe the same visual.
  const grouped = []
  for (const segment of segments) {
    const previous = grouped.at(-1)
    if (previous && JSON.stringify(previous.cue) === JSON.stringify(segment.cue)) previous.text += ` ${segment.text}`
    else grouped.push({ ...segment })
  }
  return grouped
}

export function createNarrationController(preferences, onChange = () => {}) {
  let active = null, session = false, paused = false, position = ''
  const clear = () => { if (active || session) { active = null; session = false; onChange() } }
  return {
    start(item, segment, { fen, verified, hidden, signature, candidates }) {
      const cue = segment?.cue, mode = preferences().narrationMode
      const allowed = value => value?.fen === fen && (mode !== 'tactics' || value.tactical)
      if (paused || mode === 'off' || !verified || item.historical || item.fen !== fen || (hidden && !item.allowReveal) ||
          !allowed(cue) && !item.segments?.some(part => allowed(part.cue))) { clear(); return false }
      position = fen; session = true
      active = allowed(cue) && cueIsCurrent(cue, item, { signature, candidates }) ? cue : null
      onChange(); return !!active
    },
    // A gap or a sentence without drawable evidence still belongs to the same
    // explanation. Never flash the idle candidates between speech segments.
    nextSegment() { if (active) { active = null; onChange() } },
    refresh(candidates) { if (active && !cueIsCurrent(active, null, { candidates })) { active = null; onChange() } },
    positionChanged(fen) { if (position !== fen) { position = fen; clear() } },
    clear,
    mute() { paused = true; clear() },
    resume() { paused = false },
    get cue() { return active },
    get playing() { return session },
    get paused() { return paused }
  }
}

// Only evidence used by this sentence matters. Extra search results or a new
// unrelated PV must not erase an unchanged spoken move. Changed ranks, paths
// and tactical targets are suppressed until the next current explanation.
function cueIsCurrent(cue, item, { signature, candidates }) {
  if (cue.evidence?.length && candidates) return cue.evidence.every(proof => {
    const candidate = candidates[proof.rank]
    const pv = candidate?.pv?.length ? candidate.pv : [candidate?.uci]
    return candidate?.uci === proof.uci && candidate.depth >= 10 && scoreValue(candidate.score) !== null &&
      proof.pv.every((move, index) => pv[index] === move) && (!proof.motif || candidate.motifs?.some(motif =>
        motif.type === proof.motif.type && proof.motif.targets.every(target => motif.targets?.includes(target))))
  })
  if (['change', 'profitable-capture', 'check'].includes(cue.source)) return true
  return !item?.visualSignature || signature === undefined || item.visualSignature === signature
}
