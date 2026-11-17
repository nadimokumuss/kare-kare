import { Chess } from 'chess.js'

const figurines = { '♔': 'K', '♚': 'K', '♕': 'Q', '♛': 'Q', '♖': 'R', '♜': 'R', '♗': 'B', '♝': 'B', '♘': 'N', '♞': 'N', '♙': '', '♟': '' }
const turkish = { V: 'Q', A: 'N', F: 'B', K: 'R', Ş: 'K' }

export function normalizeSan(raw, localized = false) {
  let san = String(raw || '').replace(/\u200b|\u200e|\u200f/g, '').trim().replace(/^\d+\.(?:\.\.)?\s*/, '')
  if (localized) san = san.replace(/^([VAFKŞ])/, piece => turkish[piece]).replace(/=([VAFKŞ])/, (_, piece) => `=${turkish[piece]}`)
  return san.replace(/[♔♚♕♛♖♜♗♝♘♞♙♟]/g, piece => figurines[piece])
    .replace(/0/g, 'O').replace(/×|:/g, 'x').replace(/[!?]+/g, '').replace(/\s*e\.?p\.?$/i, '').replace(/\s+/g, '')
}

export function moveNodeSan(node, localized = false) {
  const content = node.querySelector?.('.node-highlight-content, .move-text, .san') || node
  const clean = content.cloneNode?.(true) || content
  clean.querySelectorAll?.('.time, .clock, .move-time, .node-time, .time-indicator, [data-cy="move-time"]').forEach(item => item.remove())
  const raw = clean.textContent
  let san = normalizeSan(raw, localized)
  const icon = content.querySelector?.('[data-figurine], [data-piece], [class*="icon-font-chess"], [class*="knight"], [class*="bishop"], [class*="rook"], [class*="queen"], [class*="king"]')
  const code = [content.getAttribute?.('data-figurine'), content.getAttribute?.('data-piece'), node.getAttribute?.('data-figurine'), node.getAttribute?.('data-piece'),
    icon?.getAttribute('data-figurine'), icon?.getAttribute('data-piece')].find(value => /^(?:[pnbrqk]|[wb][pnbrqk])$/i.test(value || ''))
  let prefix = /^[pnbrqk]$/i.test(code || '') ? code.toUpperCase() : /^[wb][pnbrqk]$/i.test(code || '') ? code[1].toUpperCase() : null
  if (!prefix && icon) {
    const label = String(icon.getAttribute('class') || '')
    prefix = [['knight', 'N'], ['bishop', 'B'], ['rook', 'R'], ['queen', 'Q'], ['king', 'K']].find(([name]) => label.includes(name))?.[1]
  }
  if (prefix && prefix !== 'P') {
    // Explicit piece metadata is stronger evidence than the page language.
    // A Turkish document can still contain English SAN (K = king), whereas
    // Turkish K denotes a rook. Normalize the suffix before restoring the
    // known piece so Kg8 cannot silently become Rg8 on a midgame reload.
    const suffix = normalizeSan(raw, false).replace(/^[KQRBNVAFŞ]/, '')
    if (/^[a-h]?[1-8]?x?[a-h][1-8][+#]?$/.test(suffix)) san = prefix + suffix
  }
  return san
}

export function piecesFromGame(position) {
  return new Map(position.board().flat().filter(Boolean).map(piece => [piece.square, piece.color + piece.type]))
}

export function samePieces(a, b) {
  return !!a && !!b && a.size === b.size && [...a].every(([square, piece]) => b.get(square) === piece)
}

export function readBoardPieces(board) {
  if (!board) return null
  const pieces = new Map()
  for (const element of board.querySelectorAll('.piece')) {
    if (element.getClientRects && !element.getClientRects().length) continue
    const classes = [...element.classList]
    const code = classes.find(name => /^[wb][pnbrqk]$/.test(name)) || element.getAttribute('data-piece')
    const position = classes.find(name => /^square-[1-8][1-8]$/.test(name))
    const square = position ? 'abcdefgh'[Number(position[7]) - 1] + position[8] : element.getAttribute('data-square')
    if (!/^[wb][pnbrqk]$/.test(code || '') || !/^[a-h][1-8]$/.test(square || '')) return null
    if (pieces.has(square)) return null // Wait for a capture/drag animation to settle.
    pieces.set(square, code)
  }
  if (pieces.size > 32 || [...pieces.values()].filter(piece => piece === 'wk').length !== 1 || [...pieces.values()].filter(piece => piece === 'bk').length !== 1) return null
  return pieces
}

export function moveListSnapshots(doc, boardId) {
  const snapshots = []
  const explorer = doc.querySelector('a[href*="/analysis/explorer"][href*="moveList="]')
  if (explorer) {
    try {
      const text = new URL(explorer.href).searchParams.get('moveList')
      if (text) snapshots.push({ source: 'explorer', sans: text.split(/\s+/).filter(Boolean).map(san => normalizeSan(san)) })
    } catch { /* Try the visible move list instead. */ }
  }
  const localized = doc.documentElement.lang?.toLowerCase().startsWith('tr') || false
  const roots = ['wc-simple-move-list', 'wc-move-list', 'vertical-move-list', '.vertical-move-list', '.move-list', '[data-cy="move-list"]']
  if (boardId && /^[\w-]+$/.test(boardId)) roots.unshift(`wc-simple-move-list[board-id="${boardId}"]`)
  const seenRoots = new Set()
  for (const selector of roots) for (const root of doc.querySelectorAll(selector)) {
    if (seenRoots.has(root)) continue
    seenRoots.add(root)
    for (const nodes of ['.main-line-ply .node-highlight-content', '.node-highlight-content', '.move-text', '.white.node, .black.node', '.node[data-ply]', '.node']) {
      const elements = [...root.querySelectorAll(nodes)]
      const sans = elements.map(node => moveNodeSan(node, localized)).filter(san => san && !/^(?:1-O|O-1|½-½|1\/2-1\/2|\*)$/.test(san))
      if (sans.length) snapshots.push({ source: `${selector} ${nodes}`, sans })
    }
  }
  return snapshots
}

export function reconstructPosition(snapshots, pieces) {
  let reason = 'move_list_missing'
  let source = null
  let count = 0
  for (const snapshot of snapshots) {
    source = snapshot.source; count = snapshot.sans.length
    const position = new Chess()
    let valid = true
    for (const san of snapshot.sans) {
      try { position.move(san) } catch { reason = 'invalid_or_incomplete_moves'; valid = false; break }
    }
    if (!valid) continue
    if (samePieces(piecesFromGame(position), pieces)) return { position, source, count, reason: 'matched' }
    reason = 'moves_do_not_match_board'
  }
  return { position: null, source, count, reason }
}

export function visibleGameResult(doc) {
  for (const node of doc.querySelectorAll('.game-result, .game-result-component, .game-over-modal, [data-cy="game-result"]')) {
    if (node.getClientRects && !node.getClientRects().length) continue
    const match = String(node.textContent || '').match(/(?:^|\s)(1-0|0-1|1\/2-1\/2|½-½)(?:\s|$)/)
    if (match) return match[1].replace('½-½', '1/2-1/2')
  }
  return null
}
