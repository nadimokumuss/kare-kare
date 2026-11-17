export const effectPatterns = Object.freeze({
  mate: [[620, 0, 0.09], [620, 0.14, 0.09], [440, 0.28, 0.14]],
  tactic: [[660, 0, 0.1], [880, 0.12, 0.13]],
  blunder: [[430, 0, 0.13], [310, 0.16, 0.17]],
  connection: [[300, 0, 0.11], [300, 0.22, 0.11]]
})
const preferenceFor = { mate: 'effectMate', tactic: 'effectTactic', blunder: 'effectBlunder', connection: 'effectConnection' }
const priority = { mate: 4, blunder: 3, tactic: 2, connection: 1 }

export function effectEvents(items, currentFen, playerColor) {
  return items.filter(item => item.fen === currentFen).flatMap(item => {
    const type = item.channel === 'mate' && item.color !== playerColor ? 'mate'
      : item.gradeCode === 'blunder' ? 'blunder'
        : item.channel !== 'grades' && item.channel !== 'suggestions' && item.critical && !item.conditional ? 'tactic' : null
    return type ? [{ key: item.key, type }] : []
  })
}

export function createSoundEffects(getPreferences, options = {}) {
  const createContext = options.createContext || (() => new AudioContext())
  const now = options.now || Date.now
  const onState = options.onState || (() => {})
  const schedule = options.schedule || setTimeout
  const unschedule = options.unschedule || clearTimeout
  let connectionTimer = null
  let context = null
  let generation = 0
  let lastAt = -Infinity
  let lastPriority = 0
  let state = { state: 'idle', error: null }
  const seen = new Set()
  const nodes = new Set()
  const perType = new Map()
  const emit = (value, error = null) => { state = { state: value, error }; onState(state) }
  const stop = () => {
    ++generation
    for (const node of nodes) { try { node.stop() } catch { /* already stopped */ } }
    nodes.clear()
    emit('idle')
  }
  const play = (type, preview = false) => {
    if (!context || context.state !== 'running') return false
    const preferences = getPreferences()
    const volume = Math.max(0, Math.min(1, Number(preferences.effectVolume) || 0))
    if (!volume) return false
    const duck = options.isSpeaking?.() ? 0.3 : 1
    try {
      for (const [frequency, offset, duration] of effectPatterns[type]) {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const start = context.currentTime + offset
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, start)
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(volume * 0.16 * duck, start + 0.008)
        gain.gain.linearRampToValueAtTime(0, start + duration)
        oscillator.connect(gain); gain.connect(context.destination)
        nodes.add(oscillator)
        oscillator.onended = () => { nodes.delete(oscillator); oscillator.disconnect(); gain.disconnect() }
        oscillator.start(start); oscillator.stop(start + duration + 0.01)
      }
      emit(preview ? 'preview' : 'ready')
      return true
    } catch (error) { emit('error', error.message || 'effect-failed'); return false }
  }
  const unlock = async () => {
    const token = ++generation
    let timer
    try {
      if (!context || context.state === 'closed') context = createContext()
      emit('starting')
      await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('effect-start-timeout')), 1500) })])
      if (token !== generation) return false
      if (context.state !== 'running') throw new Error('effect-suspended')
      emit('ready'); return true
    } catch (error) { if (token === generation) emit('error', error.message || 'effect-unavailable'); return false }
    finally { clearTimeout(timer) }
  }
  const notify = events => {
      const preferences = getPreferences()
      if (!preferences.effects || !context || context.state !== 'running') return false
      const event = events.filter(item => effectPatterns[item.type] && preferences[preferenceFor[item.type]] && !seen.has(item.key))
        .sort((a, b) => priority[b.type] - priority[a.type])[0]
      if (!event || (now() - lastAt < 1600 && !(priority[event.type] > lastPriority && now() - lastAt >= 350)) ||
        now() - (perType.get(event.type) ?? -Infinity) < 4000) return false
      if (!play(event.type)) return false
      // Lower-priority events from this same batch do not become a second beep.
      for (const item of events) seen.add(item.key)
      if (seen.size > 250) for (const key of [...seen].slice(0, seen.size - 250)) seen.delete(key)
      lastAt = now(); lastPriority = priority[event.type]; perType.set(event.type, lastAt)
      return true
  }
  const clearConnection = () => { if (connectionTimer !== null) unschedule(connectionTimer); connectionTimer = null }
  return {
    unlock,
    async preview(type = 'tactic') { return effectPatterns[type] && await unlock() ? play(type, true) : false },
    notify,
    connection(lost, key) {
      if (!lost) { clearConnection(); return }
      if (connectionTimer !== null) return
      connectionTimer = schedule(() => { connectionTimer = null; notify([{ key, type: 'connection' }]) }, 2000)
    },
    stop,
    reset() { stop(); clearConnection(); seen.clear(); perType.clear(); lastAt = -Infinity; lastPriority = 0 },
    getState() { return { ...state, context: context?.state || 'not-created' } },
    dispose() { stop(); clearConnection(); if (context && context.state !== 'closed') context.close().catch(() => {}); context = null }
  }
}
