const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
export const appearanceDefaults = Object.freeze({ panelWidth: 360, textSize: 15, theme: 'auto', panelSide: 'auto', narrationMode: 'all' })

export function appearancePreferences(value = {}) {
  value ||= {}
  return { panelWidth: Number.isFinite(value.panelWidth) ? clamp(value.panelWidth, 280, 480) : 360,
    textSize: Number.isFinite(value.textSize) ? clamp(value.textSize, 14, 20) : 15,
    theme: ['auto', 'light', 'dark'].includes(value.theme) ? value.theme : 'auto',
    panelSide: ['auto', 'right', 'left'].includes(value.panelSide) ? value.panelSide : 'auto',
    narrationMode: ['off', 'tactics', 'all'].includes(value.narrationMode) ? value.narrationMode : 'all' }
}
const validRect = value => value && ['left', 'right', 'top', 'bottom'].every(key => Number.isFinite(value[key])) && value.right > value.left && value.bottom > value.top
export const rectanglesOverlap = (a, b, gap = 0) => a.left < b.right + gap && a.right > b.left - gap && a.top < b.bottom + gap && a.bottom > b.top - gap

export function coachPlacement({ viewport, board, blockers = [], width = 360, side = 'auto' }) {
  const margin = 14, gap = 16
  const target = clamp(width, 280, 480)
  const fitWidth = Math.max(160, Math.min(target, viewport.width - margin * 2))
  const top = clamp(board?.top || margin, margin, Math.max(margin, viewport.height - 240))
  const height = Math.max(140, viewport.height - top - margin)
  if (!validRect(board)) return { mode: 'waiting', position: 'fixed', left: Math.max(margin, viewport.width - fitWidth - margin), top: margin, width: fitWidth, maxHeight: Math.max(140, viewport.height - margin * 2) }
  const protectedBoard = { left: board.left - 14, right: board.right + 14, top: board.top - 60, bottom: board.bottom + 64 }
  const obstacles = [protectedBoard, ...blockers.filter(validRect)]
  const intervals = obstacles.filter(rect => rect.top < top + height && rect.bottom > top)
    .map(rect => [Math.max(margin, rect.left - gap), Math.min(viewport.width - margin, rect.right + gap)])
    .filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0])
  const free = []; let cursor = margin
  for (const [start, end] of intervals) { if (start > cursor) free.push([cursor, start]); cursor = Math.max(cursor, end) }
  if (cursor < viewport.width - margin) free.push([cursor, viewport.width - margin])
  const sides = side === 'left' ? ['left', 'right'] : ['right', 'left']
  for (const direction of sides) {
    const spaces = free.filter(([a, b]) => b - a >= Math.min(280, fitWidth) && (direction === 'right' ? a >= protectedBoard.right : b <= protectedBoard.left))
      .sort((a, b) => direction === 'right' ? a[0] - b[0] : b[1] - a[1])
    if (!spaces.length) continue
    const [a, b] = spaces[0], actualWidth = Math.min(fitWidth, b - a)
    return { mode: direction, position: 'fixed', left: direction === 'right' ? a : b - actualWidth, top, width: actualWidth, maxHeight: height }
  }
  const left = clamp(board.left, margin, Math.max(margin, viewport.width - fitWidth - margin))
  const below = Math.max(protectedBoard.bottom, ...blockers.filter(rect => validRect(rect) && rect.left < left + fitWidth && rect.right > left).map(rect => rect.bottom))
  return { mode: 'below', position: 'absolute', left: left + (viewport.scrollX || 0), top: Math.max(below + (viewport.scrollY || 0) + gap, viewport.height + gap), width: fitWidth, maxHeight: Math.max(300, viewport.height - margin * 2) }
}

export function boardOrientation(board) {
  const orientation = board?.getAttribute?.('orientation') || board?.dataset?.orientation
  if (['black', 'b'].includes(orientation) || board?.classList?.contains('flipped')) return 'b'
  if (['white', 'w'].includes(orientation)) return 'w'
  const letters = [...(board?.querySelectorAll?.('svg.coordinates text, .coordinates text') || [])].map(node => node.textContent.trim()).filter(text => /^[a-h]$/.test(text))
  return letters[0] === 'h' ? 'b' : 'w'
}
