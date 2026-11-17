export const shortcutActions = Object.freeze({ arrows: 'Okları aç/kapat', comment: 'Konum yorumu', plan: 'Plan ve hedef',
  opponent: 'Rakibin tehdidi / cevabı', candidate1: '1. adayın gerekçesi', candidate2: '2. adayın gerekçesi',
  candidate3: '3. adayın gerekçesi', tactics: 'Taktik uyarıları', repeat: 'Son açıklamayı tekrarla', stop: 'Konuşmayı durdur', hint: 'Sonraki ipucu düzeyi',
  comparison: 'İki adayı karşılaştır', details: 'Tam açıklama', grades: 'Son hamle dereceleri', change: 'Tahtadaki değişim' })
// Chess.com documents X as flip and Z as focus. Leave those native actions alone.
export const defaultShortcuts = Object.freeze({ arrows: ' ', comment: 'q', plan: 'w', opponent: 'e', candidate1: 'a',
  candidate2: 's', candidate3: 'd', tactics: 'r', repeat: 'v', stop: 'c', hint: 'h', comparison: 'f', details: 'g', grades: 't', change: 'b' })
const reserved = new Set(['x', 'z', '.'])
export const normalizeKey = key => key === 'Space' || key === 'Spacebar' ? ' ' : String(key || '').toLowerCase().replace(/\u0307/g, '')
export const keyLabel = key => key === ' ' ? 'Boşluk' : String(key).toLocaleUpperCase('tr-TR')

export function validateShortcuts(bindings) {
  const seen = new Set()
  const clean = {}
  for (const action of Object.keys(shortcutActions)) {
    const key = normalizeKey(bindings?.[action])
    if (!key) { clean[action] = ''; continue }
    if (!(key === ' ' || /^[\p{L}\p{N}]$/u.test(key))) return { error: 'Her görev için tek harf, rakam veya Boşluk seç.' }
    if (reserved.has(key)) return { error: 'X ve Z Chess.com işlevlerine ayrıldı; başka bir tuş seç.' }
    if (seen.has(key)) return { error: `${keyLabel(key)} birden fazla göreve atanmış.` }
    seen.add(key); clean[action] = key
  }
  return { bindings: clean, error: null }
}

export function interactiveKeyTarget(event) {
  const path = event.composedPath?.() || [event.target]
  return path.some(node => node?.isContentEditable || node?.closest?.('input, textarea, select, button, summary, a[href], [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="slider"], [role="button"], [role="dialog"]'))
}
export function shortcutAction(event, bindings = defaultShortcuts, enabled = true) {
  if (!enabled || event.repeat || event.isComposing || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || interactiveKeyTarget(event)) return null
  const key = normalizeKey(event.key)
  if (!key) return null
  return Object.keys(shortcutActions).find(action => bindings[action] === key) || null
}
