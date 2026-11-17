import { candidateColors } from './narration.js'

const namespace = 'http://www.w3.org/2000/svg'
const square = value => /^[a-h][1-8]$/.test(value || '')
export function squarePoint(value, orientation = 'w') {
  if (!square(value)) return null
  const file = value.charCodeAt(0) - 97, rank = Number(value[1]) - 1
  return orientation === 'w' ? [50 + file * 100, 750 - rank * 100] : [750 - file * 100, 50 + rank * 100]
}

export function overlayModel({ candidates = [], focused = null, showCandidates = false, narration = null, narrating = !!narration, playerColor = 'w' }) {
  const staticMoves = [], targets = []
  if (showCandidates && !narrating) {
    candidates.forEach((candidate, rank) => {
      if (focused !== null && focused !== rank) return
      staticMoves.push({ from: candidate.from, to: candidate.to, color: candidate.color, rank, opponent: candidate.color !== playerColor, step: 1, conditional: false })
      if (focused === rank) {
        if (candidate.answerFrom && candidate.answerTo) staticMoves.push({ from: candidate.answerFrom, to: candidate.answerTo, rank: null, color: candidate.color === 'w' ? 'b' : 'w', opponent: candidate.color === playerColor, step: 2, conditional: true })
        if (candidate.continuationFrom && candidate.continuationTo) staticMoves.push({ from: candidate.continuationFrom, to: candidate.continuationTo, rank, color: candidate.color, opponent: candidate.color !== playerColor, step: 3, conditional: true })
        targets.push(...(candidate.motifs?.[0]?.targets || []))
      }
    })
  }
  return { staticMoves: staticMoves.filter(move => square(move.from) && square(move.to)), targets: targets.filter(square),
    narratedMoves: (narration?.moves || []).filter(move => square(move.from) && square(move.to)),
    setup: (narration?.setup || []).filter(move => square(move.from) && square(move.to)),
    narratedTargets: (narration?.targets || []).filter(square), label: narration?.label || '' }
}

export function renderBoardOverlay(document, options) {
  const model = overlayModel(options)
  if (![model.staticMoves, model.targets, model.narratedMoves, model.setup, model.narratedTargets].some(items => items.length)) return null
  const node = (tag, attributes = {}, text = null) => {
    const result = document.createElementNS(namespace, tag)
    for (const [name, value] of Object.entries(attributes)) result.setAttribute(name, String(value))
    if (text !== null) result.textContent = text
    return result
  }
  const svg = node('svg', { id: 'kk-board-arrows', viewBox: '0 0 800 800', 'aria-hidden': 'true' })
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:20;pointer-events:none;overflow:visible'
  const point = value => squarePoint(value, options.orientation)
  const ring = (group, value, color) => {
    const [cx, cy] = point(value)
    group.append(node('circle', { cx, cy, r: 35, fill: 'none', stroke: '#142018', 'stroke-width': 9, opacity: .65 }),
      node('circle', { cx, cy, r: 35, fill: 'none', stroke: color, 'stroke-width': 5, opacity: .95, 'data-target': value }))
  }
  const arrow = (group, move, { faint = false, speaking = false } = {}) => {
    const [x1, y1] = point(move.from), [x2, y2] = point(move.to)
    const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy) || 1
    const width = faint ? 7 : move.step > 1 ? 10 : speaking ? 13 : 15
    const ranked = Number.isInteger(move.rank) && move.rank >= 0 && move.rank < candidateColors.length
    const color = ranked ? candidateColors[move.rank] : '#f3f5ef'
    const opacity = faint ? .3 : .86
    const attrs = { x1, y1, x2: x2 - dx / length * 27, y2: y2 - dy / length * 27,
      stroke: color, 'stroke-width': width, 'stroke-linecap': 'round', opacity,
      'data-from': move.from, 'data-to': move.to, 'data-rank': ranked ? move.rank + 1 : '', 'data-step': move.step, 'data-opponent': !!move.opponent }
    // Both actors share the same solid shaft and head. Labels identify the
    // actor; step numbers identify hypothetical continuations.
    group.append(node('line', { x1, y1, x2: attrs.x2, y2: attrs.y2, 'stroke-linecap': 'round', stroke: '#15251c', 'stroke-width': width + 5, opacity: faint ? .2 : .75, 'data-outline': 'true' }))
    group.append(node('line', attrs))
    const tipX = x2 - dx / length * 10, tipY = y2 - dy / length * 10
    const headSize = speaking || move.step > 1 ? 27 : 35, side = speaking || move.step > 1 ? 14 : 19
    const backX = tipX - dx / length * headSize, backY = tipY - dy / length * headSize
    group.append(node('polygon', { points: `${tipX},${tipY} ${backX - dy / length * side},${backY + dx / length * side} ${backX + dy / length * side},${backY - dx / length * side}`,
      fill: color, stroke: '#15251c', 'stroke-width': 2, opacity }))
    {
      const label = `${move.opponent ? 'Rakip' : 'Sen'}${move.step > 1 ? ` · ${move.step}` : ''}`
      // Twelve CSS pixels on every board size, including focus mode. Actors
      // and step numbers use exactly the same badge and typography.
      const font = 12 * 800 / Math.max(200, options.boardSize || 800), size = label.length * font * .62 + 12
      const cx = Math.max(size / 2 + 3, Math.min(797 - size / 2, (x1 + x2) / 2)), cy = Math.max(font + 5, (y1 + y2) / 2 - 20)
      group.append(node('rect', { x: cx - size / 2, y: cy - font * .8, width: size, height: font * 1.5, rx: 6, fill: '#15251c', opacity: .94 }),
        node('text', { x: cx, y: cy + font * .3, 'text-anchor': 'middle', 'font-family': 'Arial,sans-serif', 'font-size': font, 'font-weight': 600, fill: '#f3f5ef', 'data-actor': move.opponent ? 'opponent' : 'self', 'data-step': move.step }, label))
    }
  }
  const statics = node('g', { 'data-layer': 'candidates' })
  model.staticMoves.forEach(move => arrow(statics, move)); model.targets.forEach(value => ring(statics, value, candidateColors[options.focused || 0]))
  if (model.staticMoves.length || model.targets.length) svg.append(statics)
  const narration = node('g', { 'data-layer': 'narration', 'data-label': model.label })
  model.setup.forEach(move => arrow(narration, move, { faint: true, speaking: true }))
  model.narratedMoves.forEach(move => arrow(narration, move, { speaking: true }))
  model.narratedTargets.forEach(value => ring(narration, value, '#f8d987'))
  svg.append(narration)
  return svg
}
