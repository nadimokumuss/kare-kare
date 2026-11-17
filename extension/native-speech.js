import { speechPortName } from './tts-host.js'

export function speechErrorText(error) {
  const messages = {
    'no-turkish-voice': 'Türkçe sistem sesi bulunamadı. Bilgisayara Türkçe konuşma sesi eklenmeli.',
    'native-tts-unavailable': 'Uzantının ses hizmeti açılamadı. Güncel paketi yeniden yükle.',
    'speech-connection-lost': 'Ses bağlantısı koptu. Sesi dene düğmesine bas.',
    'speech-start-timeout': 'Chrome konuşma hizmeti yanıt vermedi. Sesi dene ile ses bağlantısını yenile. Sorun sürerse test notlarını indir.',
    'speech-completion-timeout': 'Konuşma tamamlanamadı. Sesi yeniden dene.',
    'audio-busy': 'Ses hizmeti başka bir konuşmayla meşgul. Konuşma bitince yeniden dene.',
    'coach-audio-busy': 'Başka bir Kare Kare sekmesi konuşuyor. O sekmenin sesini kapatıp yeniden dene.',
    'speech-request-busy': 'Koçun önceki ses isteği henüz bitmedi. Sesi dene düğmesiyle yeniden başlat.',
    'speech-account-blocked': 'Bu hesap için sesli koç erişimi kapalı.',
    'speech-route-blocked': 'Bu sayfada sesli koç çalışmıyor.'
  }
  return messages[error] || `Ses hizmeti hata verdi: ${String(error || 'bilinmeyen hata').slice(0, 140)}`
}

// Adapt extension-native TTS events to the existing priority/critical queue.
// No page script, remote voice engine or website speech queue is involved.
export function createNativeSynthesis(runtime, context, onVoices = () => {}, onProblem = () => {}, timers = {}) {
  let port = null; let voices = []; let nextId = 0; let active = null; let disposed = false
  let heartbeat = null
  let connections = 0
  const trace = []
  const note = (stage, details = {}) => {
    trace.push({ at: new Date().toISOString(), stage, ...details })
    if (trace.length > 40) trace.shift()
  }
  const every = timers.every || setInterval, clear = timers.clear || clearInterval
  const stopHeartbeat = () => { if (heartbeat !== null) { clear(heartbeat); heartbeat = null } }
  const detach = () => {
    const connected = port; port = null
    try { connected?.disconnect() } catch { /* A dead port is already detached. */ }
  }
  const connectionFailed = () => {
    const request = active; active = null; stopHeartbeat(); detach()
    note('connection-lost', { id: request?.id ?? null })
    request?.utterance.onerror?.({ error: 'speech-connection-lost' })
  }
  const receive = message => {
    if (disposed || !message || typeof message !== 'object') return
    if (['event', 'error', 'status', 'alive'].includes(message.type)) note(message.type, {
      id: message.id ?? null, event: message.event || message.stage || null,
      error: message.error ? String(message.error).slice(0, 180) : null,
      stale: !active || message.id !== active.id,
      ...(Number.isInteger(message.voiceCount) ? { voiceCount: message.voiceCount } : {})
    })
    if (message.type === 'voices') { voices = Array.isArray(message.voices) ? message.voices : []; note('voices', { count: voices.length }); onVoices(); return }
    if (!active || message.id !== active.id) {
      // A canceled request may report an error after its replacement started.
      // Only non-utterance/control errors can update the general UI here.
      if (message.type === 'error' && message.id === undefined) onProblem(message.error)
      return
    }
    const utterance = active.utterance
    if (message.type === 'error') { active = null; stopHeartbeat(); utterance.onerror?.({ error: message.error }); return }
    if (message.type !== 'event') return
    if (['start', 'word', 'sentence', 'marker', 'resume'].includes(message.event) && !active.started) {
      active.started = true; utterance.nativeVoice = message.voice; utterance.onstart?.()
    }
    else if (message.event === 'end') { active = null; stopHeartbeat(); utterance.onend?.() }
    else if (['error', 'cancelled', 'interrupted'].includes(message.event)) {
      active = null; stopHeartbeat(); utterance.onerror?.({ error: message.error || message.event })
    }
  }
  const connect = () => {
    if (disposed) throw new Error('speech-connection-lost')
    if (port) return port
    const connected = runtime.connect({ name: speechPortName }); port = connected
    connections++; note('connected', { connection: connections })
    connected.onMessage.addListener(message => { if (port === connected) receive(message) })
    connected.onDisconnect.addListener(() => {
      if (port !== connected) return
      connectionFailed()
    })
    return connected
  }
  const post = message => {
    try { connect().postMessage({ ...message, ...context() }) }
    catch (error) { note('post-failed', { error: String(error.message || error).slice(0, 180) }); detach(); throw new Error('speech-connection-lost') }
  }
  return {
    backend: 'chrome-tts', paused: false,
    getVoices: () => voices,
    getHealth: () => ({ connected: !!port, connections, pendingId: active?.id ?? null,
      voices: voices.map(voice => ({ name: voice.name, lang: voice.lang, localService: voice.localService })), trace: trace.map(entry => ({ ...entry })) }),
    refreshVoices() { try { post({ type: 'voices' }) } catch (error) { if (active) connectionFailed(); else onProblem(error.message) } },
    reset() {
      this.cancel(); detach(); note('reset')
      this.refreshVoices()
    },
    speak(utterance) {
      const id = ++nextId
      active = { id, utterance, started: false }
      note('request', { id, characters: utterance.text.length, voice: utterance.voice?.name || 'automatic' })
      stopHeartbeat()
      // Keep the worker alive only while an utterance is pending/playing.
      // Some OS voices report start/end but no word events during long text.
      heartbeat = every(() => {
        if (!active) return
        try { post({ type: 'ping', id: active.id }) } catch { connectionFailed() }
      }, 15000)
      heartbeat?.unref?.()
      try { post({ type: 'speak', id, text: utterance.text, rate: utterance.rate, voiceName: utterance.voice?.name || '' }) }
      catch (error) {
        if (active?.id !== id) return
        active = null; stopHeartbeat(); utterance.onerror?.({ error: error.message || 'speech-connection-lost' })
      }
    },
    cancel() {
      active = null; stopHeartbeat()
      if (port) { try { port.postMessage({ type: 'cancel', ...context() }) } catch { detach() } }
    },
    resume() { if (port) post({ type: 'resume' }) },
    dispose() { this.cancel(); disposed = true; const connected = port; port = null; connected?.disconnect() }
  }
}
