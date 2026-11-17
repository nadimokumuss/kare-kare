import test from 'node:test'
import assert from 'node:assert/strict'
import { appearancePreferences, boardOrientation, coachPlacement, rectanglesOverlap } from '../extension/coach-layout.js'
const rect = (left, top, right, bottom) => ({ left, top, right, bottom })
const viewport = { width: 1920, height: 1080, scrollX: 0, scrollY: 0 }
const board = rect(300, 80, 1000, 780)

test('focus layout docks beside the board and normal layout avoids the native sidebar', () => {
  const focus = coachPlacement({ viewport, board })
  assert.equal(focus.mode, 'right'); assert.equal(focus.width, 360)
  assert.ok(focus.left >= board.right + 14)
  const native = rect(1030, 40, 1460, 900)
  const normal = coachPlacement({ viewport, board, blockers: [native] })
  assert.equal(normal.mode, 'right'); assert.ok(normal.left > native.right)
  assert.equal(rectanglesOverlap({ ...normal, right: normal.left + normal.width, bottom: normal.top + normal.maxHeight }, native), false)
})

test('left preference, limited free width and clock protection never cover the board', () => {
  const placement = coachPlacement({ viewport, board: rect(700, 80, 1300, 780), side: 'left', blockers: [rect(0, 0, 160, 1080)] })
  assert.equal(placement.mode, 'left'); assert.ok(placement.left + placement.width < 700)
  const reduced = coachPlacement({ viewport: { width: 1360, height: 1000 }, board, width: 480 })
  assert.equal(reduced.mode, 'right'); assert.ok(reduced.width >= 280 && reduced.width < 480)
  const clocks = rect(990, 20, 1080, 1000)
  const protectedClock = coachPlacement({ viewport, board, blockers: [clocks] })
  assert.ok(protectedClock.left > clocks.right)
})

test('a narrow layout uses a document-space fallback whose anchor does not drift when scrolling', () => {
  const view = { width: 800, height: 900, scrollY: 0 }
  const original = rect(40, 70, 740, 770)
  const first = coachPlacement({ viewport: view, board: original })
  assert.equal(first.mode, 'below'); assert.equal(first.position, 'absolute')
  assert.ok(first.top > original.bottom + 64)
  const scrolled = coachPlacement({ viewport: { ...view, scrollY: 400 }, board: rect(40, -330, 740, 370) })
  assert.equal(scrolled.top, first.top)
  assert.ok(first.left >= 0 && first.left + first.width <= view.width)
  const mobile = coachPlacement({ viewport: { width: 320, height: 700 }, board: rect(10, 50, 310, 350) })
  assert.ok(mobile.width <= 292); assert.equal(mobile.mode, 'below')
})

test('missing boards remain usable and corrupt appearance preferences stay bounded', () => {
  const waiting = coachPlacement({ viewport: { width: 1000, height: 700 } })
  assert.equal(waiting.mode, 'waiting'); assert.ok(waiting.top + waiting.maxHeight <= 700)
  assert.deepEqual(appearancePreferences({ panelWidth: 99999, textSize: -12, theme: 'bad', panelSide: 'bad', narrationMode: 'bad' }),
    { panelWidth: 480, textSize: 14, theme: 'auto', panelSide: 'auto', narrationMode: 'all' })
  assert.equal(appearancePreferences({ panelWidth: NaN }).panelWidth, 360)
})

test('many board sizes and blocker arrangements keep a side panel inside the viewport without overlap', () => {
  for (let index = 0; index < 700; index++) {
    const width = 900 + index % 17 * 70, height = 720 + index % 7 * 40
    const size = 360 + index % 9 * 35, left = 40 + index % 13 * 30
    const board = rect(left, 30, left + size, 30 + size)
    const blockers = index % 2 ? [rect(left + size + 30, 10, left + size + 280, height - 20)] : []
    const result = coachPlacement({ viewport: { width, height }, board, blockers, side: index % 3 === 0 ? 'left' : 'auto', width: 280 + index % 21 * 10 })
    const panel = rect(result.left, result.top, result.left + result.width, result.top + result.maxHeight)
    if (['left', 'right'].includes(result.mode)) {
      assert.ok(panel.left >= 0 && panel.right <= width && panel.top >= 0 && panel.bottom <= height)
      assert.equal(rectanglesOverlap(panel, board, 12), false)
      blockers.forEach(blocker => assert.equal(rectanglesOverlap(panel, blocker, 12), false))
    } else assert.ok(result.top > board.bottom)
  }
})

test('board orientation follows flipped classes, explicit attributes and coordinate order', () => {
  const stub = (orientation, flipped, first = 'a') => ({ getAttribute: () => orientation, classList: { contains: () => flipped }, querySelectorAll: () => [{ textContent: first }] })
  assert.equal(boardOrientation(stub(null, true)), 'b')
  assert.equal(boardOrientation(stub('black', false)), 'b')
  assert.equal(boardOrientation(stub(null, false, 'h')), 'b')
  assert.equal(boardOrientation(stub('white', false, 'h')), 'w')
  assert.equal(boardOrientation(null), 'w')
})
