const files = { a: 'a', b: 'be', c: 'ce', d: 'de', e: 'e', f: 'fe', g: 'ge', h: 'ha' }
const ranks = { 1: 'bir', 2: 'iki', 3: 'üç', 4: 'dört', 5: 'beş', 6: 'altı', 7: 'yedi', 8: 'sekiz' }
const pieces = { K: 'şah', Q: 'vezir', R: 'kale', B: 'fil', N: 'at' }

export function spokenChessText(text) {
  const expanded = String(text).replace(/\b(?:O-O-O|O-O|[KQRBN](?:[a-h1-8])?x?[a-h][1-8](?:=[QRBN])?|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?)[+#]?/g, san => {
    if (san.startsWith('O-O-O')) return 'uzun rok'
    if (san.startsWith('O-O')) return 'kısa rok'
    const square = san.match(/([a-h])([1-8])(?:=([QRBN]))?[+#]?$/)
    if (!square) return san
    const piece = pieces[san[0]] || ''
    const target = `${files[square[1]]} ${ranks[square[2]]}`
    return [piece, san.includes('x') ? 'alır' : '', target, square[3] ? `${pieces[square[3]]} terfisi` : '', san.endsWith('#') ? 'mat' : san.endsWith('+') ? 'şah' : ''].filter(Boolean).join(' ')
  })
  // Some system voices interpret the isolated word "mat" as an abbreviation
  // for mathematics. Give it an inflected chess context in speech only.
  return expanded.replace(/(?<![\p{L}])mat eder(?![\p{L}])/giu, 'şah matı yapar')
    .replace(/(?<![\p{L}])mat edebilirsin(?![\p{L}])/giu, 'şah matı yapabilirsin')
    .replace(/(?<![\p{L}])mat(?![\p{L}])/giu, 'şah matı')
}

export function preferredVoice(voices, name = '') {
  const named = voices.find(voice => (voice.voiceURI || voice.name) === name)
  if (named) return named
  const rank = voice => (/^tr(?:-|$)/i.test(voice.lang) ? 100 : 0) + (/premium|enhanced|natural|neural/i.test(voice.name) ? 20 : 0) + (voice.default ? 1 : 0)
  return voices.filter(voice => /^tr(?:-|$)/i.test(voice.lang)).sort((a, b) => rank(b) - rank(a))[0] || null
}

// Own the queue instead of putting every utterance into the browser queue:
// canceling an obsolete suggestion must not discard a critical alert behind it.
export function createSpeechCoach(synthesis, makeUtterance, getPreferences, onError = () => {}, options = {}) {
  const schedule = options.schedule || ((callback, delay) => { const timer = setTimeout(callback, delay); timer.unref?.(); return timer })
  const unschedule = options.unschedule || clearTimeout
  const onState = options.onState || (() => {})
  const now = options.now || Date.now
  let current = null
  let queue = []
  let activeFen = ''
  let generation = 0
  let blocked = false
  let recoverAfter = null
  let recoveryDelay = 3000
  const recoverable = new Set(['speech-connection-lost', 'speech-start-timeout', 'speech-completion-timeout',
    'speech-request-busy', 'coach-audio-busy', 'audio-busy', 'native-tts-error', 'synthesis-failed', 'interrupted', 'cancelled'])
  let deferred = null
  let status = { state: 'idle', error: null }
  const emit = (state, extra = {}) => { status = { state, error: null,
    ...(current ? { context: current.context, role: current.role, channel: current.channel, historical: current.historical, ply: current.ply } : {}), ...extra }; onState(status) }
  const clearTimers = item => { if (!item) return; unschedule(item.startTimer); unschedule(item.endTimer) }
  const cancel = () => { try { synthesis?.cancel() } catch { /* A failed cancel must not lock our queue. */ } }
  const resetTransport = () => { try { synthesis?.reset?.() } catch { /* The next speak reports a failed reconnect. */ } }
  const deferPump = () => {
    if (deferred !== null) unschedule(deferred)
    deferred = schedule(() => { deferred = null; pump() }, 60)
  }
  const positionPly = fen => {
    const fields = String(fen).split(' ')
    return /^[wb]$/.test(fields[1]) && Number(fields[5]) > 0 ? (Number(fields[5]) - 1) * 2 + (fields[1] === 'b' ? 1 : 0) : null
  }
  const isStale = item => !!item.fen && item.fen !== activeFen
  const asHistorical = item => {
    if (!item.critical || !item.historicalText || item.kind === 'manual') return null
    const ply = item.ply ?? positionPly(item.fen)
    const activePly = positionPly(activeFen)
    // Late background grading must not fill speech with distant game history.
    if (ply !== null && activePly !== null && (activePly - ply > 2 || activePly < ply)) return null
    if (now() - item.createdAt > 12000) return null
    return { ...item, historical: true }
  }
  const rank = item => !item.historical && item.channel === 'mate' ? 4 : item.kind === 'manual' ? 3 : item.historical ? 1 : item.critical ? 2 : 0
  const tidy = () => {
    queue = queue.flatMap(item => {
      if (activeFen === 'unverified' && item.fen) return []
      if (!isStale(item)) return [item]
      const historical = asHistorical(item)
      return historical ? [historical] : []
    })
    const history = queue.filter(item => item.historical)
      .sort((a, b) => (b.ply ?? 0) - (a.ply ?? 0) || (b.priority || 0) - (a.priority || 0)).slice(0, 2)
    queue = queue.filter(item => !item.historical || history.includes(item))
      .sort((a, b) => rank(b) - rank(a) || (a.historical && b.historical ? (b.ply ?? 0) - (a.ply ?? 0) : 0) || (b.priority || 0) - (a.priority || 0)).slice(0, 20)
  }
  const interrupt = () => {
    const previous = current
    clearTimers(current); current = null; ++generation; cancel(); emit('ready'); deferPump()
    return previous
  }
  const pump = () => {
    if (current || blocked || deferred !== null || !queue.length || !synthesis) return
    tidy()
    if (!queue.length) return
    const pending = queue.shift()
    const prepared = options.prepare ? options.prepare(pending) : pending
    if (!prepared) { pump(); return }
    const item = { ...prepared }
    const prefix = item.historical ? `Geçmiş konum. ${item.context ? `${item.context}. ` : ''}` : ''
    const normalize = text => String(text || '').trim().replace(/\s+/g, ' ')
    const provided = Array.isArray(item.segments) ? item.segments.filter(segment => typeof segment?.text === 'string' && segment.text.trim()) : []
    const segments = !item.historical && provided.length && normalize(provided.map(segment => segment.text).join(' ')) === normalize(item.text)
      ? provided : [{ text: prefix + (item.historical ? item.historicalText : item.text), cue: null }]
    const id = ++generation
    // Keep the utterance alive until completion, and watch both missing start
    // and missing completion events instead of allowing an endless silent queue.
    current = { ...item, id, utterance: null, started: false, segmentIndex: 0 }
    const finish = () => {
      if (current?.id !== id) return
      clearTimers(current); current = null; recoveryDelay = 3000; emit('ready'); pump()
    }
    const fail = error => {
      if (current?.id !== id) return
      const resumeSegment = current.segmentIndex
      clearTimers(current); current = null; ++generation; cancel()
      if ((item.attempt || 0) < 1 && !['not-allowed', 'audio-busy', 'coach-audio-busy', 'speech-request-busy', 'audio-hardware', 'no-turkish-voice', 'native-tts-unavailable', 'speech-route-blocked', 'speech-account-blocked'].includes(error)) {
        queue.unshift({ ...item, attempt: 1, fallback: true, resumeSegment })
        resetTransport(); emit('recovering', { error }); deferPump(); return
      }
      blocked = true
      recoverAfter = recoverable.has(error) ? now() + recoveryDelay : null
      if (recoverAfter !== null) recoveryDelay = Math.min(30000, recoveryDelay * 2)
      emit('error', { error }); onError(error)
    }
    const playSegment = index => {
      if (current?.id !== id) return
      current.segmentIndex = index; current.started = false
      const segment = segments[index]
      try {
      const utterance = makeUtterance(spokenChessText(segment.text))
      const preferences = getPreferences()
      const voices = synthesis.getVoices?.() || []
      const local = voices.filter(voice => /^tr(?:-|$)/i.test(voice.lang) && voice.localService !== false)
      const voice = item.fallback ? preferredVoice(local) : preferredVoice(voices, preferences.voiceName)
      utterance.lang = 'tr-TR'; utterance.rate = preferences.voiceRate || 1; utterance.pitch = 1
      if (voice) utterance.voice = voice
      current.utterance = utterance
      const stillCurrent = () => current?.id === id && current.segmentIndex === index && current.utterance === utterance
      utterance.onstart = () => {
        if (!stillCurrent() || current.started) return
        current.started = true; unschedule(current.startTimer)
        if (!item.alreadyStarted) { item.alreadyStarted = true; options.onStarted?.(item) }
        options.onSegment?.(item, segment)
        emit('speaking', { voice: utterance.nativeVoice || voice?.name || 'browser-default' })
        const duration = Math.min(600000, Math.max(15000, utterance.text.length * 160 / utterance.rate + 8000))
        current.endTimer = schedule(() => fail('speech-completion-timeout'), duration)
      }
      utterance.onend = () => {
        if (!stillCurrent()) return
        clearTimers(current)
        if (index + 1 < segments.length) playSegment(index + 1)
        else finish()
      }
      utterance.onerror = event => { if (stillCurrent()) fail(event.error || 'synthesis-failed') }
      current.startTimer = schedule(() => fail('speech-start-timeout'), 5000)
      emit('starting', { voiceCount: voices.length, voice: voice?.name || 'browser-default' })
      if (synthesis.paused) synthesis.resume?.()
      synthesis.speak(utterance)
      } catch (error) { fail(error.message || 'synthesis-failed') }
    }
    playSegment(Number.isInteger(item.resumeSegment) && item.resumeSegment >= 0 && item.resumeSegment < segments.length ? item.resumeSegment : 0)
  }
  const cancelOrdinary = () => {
    queue = queue.filter(item => item.critical)
    if (current && !current.critical) interrupt()
  }
  const enqueueMany = items => {
    // A temporary native-service failure must not mute every later move for
    // the rest of the match. Only fresh incoming information retries after a
    // bounded backoff; an empty/idle queue never restarts itself in a loop.
    if (blocked && recoverAfter !== null && now() >= recoverAfter && items.some(item => item.text && (!item.fen || item.fen === activeFen))) {
      blocked = false; recoverAfter = null; resetTransport(); emit('recovering')
    }
    for (const source of items) {
      if (!source.text || queue.some(entry => entry.key === source.key) || current?.key === source.key) continue
      queue.push({ ...source, createdAt: now(), historical: false })
    }
    tidy()
    // Fresh critical information takes precedence over a historical summary.
    const freshCritical = queue.some(item => !item.historical && item.critical)
    const urgentMate = queue.some(item => !item.historical && item.channel === 'mate')
    if (freshCritical && current && (!current.critical || current.historical || (urgentMate && current.channel !== 'mate'))) {
      const previous = interrupt()
      if (previous.critical && previous.kind !== 'manual') queue.push(previous)
      tidy()
    }
    pump()
  }
  return {
    enqueue(item) { enqueueMany([item]) },
    enqueueMany,
    request(item) {
      if (!item.text || (item.fen && activeFen === 'unverified')) return
      if (blocked) resetTransport()
      blocked = false; recoverAfter = null
      try { if (synthesis?.paused) synthesis.resume?.() } catch (error) { emit('error', { error: error.message }); onError(error.message); return }
      queue = queue.filter(entry => entry.critical && entry.kind !== 'manual')
      if (current && !(current.channel === 'mate' && !current.historical)) {
        const previous = interrupt()
        if (previous.critical && previous.kind !== 'manual') queue.push(previous)
      }
      queue.push({ ...item, kind: 'manual', critical: true, createdAt: now(), historical: false })
      tidy(); pump()
    },
    unlock() {
      if (blocked) resetTransport()
      blocked = false; recoverAfter = null
      try { if (synthesis?.paused) synthesis.resume?.() } catch (error) { emit('error', { error: error.message }); onError(error.message) }
      pump()
    },
    positionChanged(fen) {
      activeFen = fen
      if (current && (fen === 'unverified' || (isStale(current) && (!current.historical || !asHistorical(current))))) {
        const previous = interrupt()
        if (fen !== 'unverified' && isStale(previous)) {
          const historical = asHistorical(previous)
          if (historical) queue.push(historical)
        }
      }
      tidy()
      pump()
    },
    clearOrdinary() { cancelOrdinary(); pump() },
    getState() { return { ...status, queued: queue.length, blocked, recoverAfter } },
    stop() {
      queue = []; clearTimers(current); current = null; blocked = false; recoverAfter = null; recoveryDelay = 3000; ++generation
      if (deferred !== null) { unschedule(deferred); deferred = null }
      cancel(); emit('idle')
    }
  }
}
