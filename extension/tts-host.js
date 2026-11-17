import { gameMode, liveAccountAllowed } from './game-mode.js'

export const speechPortName = 'kare-kare-native-speech-v1'

export function speechAccess(sender, request, extensionId, config, now = new Date()) {
  if (sender?.id !== extensionId || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id)) return 'speech-route-blocked'
  try {
    const source = new URL(sender.url)
    const page = new URL(request.path, source.origin)
    if (source.origin !== 'https://www.chess.com' || page.origin !== source.origin ||
      !gameMode(source.pathname, config) || !gameMode(page.pathname, config)) return 'speech-route-blocked'
    if (gameMode(page.pathname, config) !== 'bot' && !liveAccountAllowed(request.account, now, config)) return 'speech-account-blocked'
  } catch { return 'speech-route-blocked' }
  return null
}

export function localTurkishVoices(voices) {
  return voices.filter(voice => /^tr(?:[-_]|$)/i.test(voice.lang || '') && voice.remote !== true && !voice.extensionId)
}

export function installTtsHost(chromeApi, config, timers = {}) {
  let owner = null
  const schedule = timers.schedule || ((callback, delay) => { const timer = setTimeout(callback, delay); timer.unref?.(); return timer })
  const unschedule = timers.unschedule || clearTimeout
  chromeApi.runtime.onConnect.addListener(port => {
    if (port.name !== speechPortName) return
    let closed = false; let activeId = null; let generation = 0
    let watchdog = null
    const clearWatchdog = () => { if (watchdog !== null) unschedule(watchdog); watchdog = null }
    const send = message => { if (!closed) { try { port.postMessage(message) } catch { /* Closed document. */ } } }
    const stopOwn = () => {
      ++generation; activeId = null; clearWatchdog()
      if (owner === port) { owner = null; try { chromeApi.tts?.stop() } catch { /* Release ownership even if native stop fails. */ } }
    }
    port.onDisconnect.addListener(() => { closed = true; stopOwn() })
    port.onMessage.addListener(async request => {
      if (!request || !['voices', 'speak', 'cancel', 'resume', 'ping'].includes(request.type)) return
      const denied = speechAccess(port.sender, request, chromeApi.runtime.id, config)
      if (denied) { stopOwn(); send({ type: 'error', id: request.id, error: denied }); return }
      if (!chromeApi.tts) { send({ type: 'error', id: request.id, error: 'native-tts-unavailable' }); return }
      if (request.type === 'cancel') { stopOwn(); return }
      if (request.type === 'resume') { if (owner === port) chromeApi.tts.resume(); return }
      if (request.type === 'ping') { send({ type: 'alive', id: request.id }); return }
      const task = generation
      try {
        if (request.type === 'speak') send({ type: 'status', id: request.id, stage: 'received' })
        const voices = localTurkishVoices(await chromeApi.tts.getVoices())
        if (closed || task !== generation) return
        if (request.type === 'voices') {
          send({ type: 'voices', voices: voices.map(voice => ({ name: voice.voiceName, voiceURI: voice.voiceName, lang: voice.lang.replace('_', '-'), localService: true })) })
          return
        }
        if (!Number.isSafeInteger(request.id) || typeof request.text !== 'string' || !request.text.trim() || request.text.length > 4000) {
          send({ type: 'error', id: request.id, error: 'invalid-speech-request' }); return
        }
        if (owner || activeId !== null) {
          send({ type: 'error', id: request.id, error: owner === port ? 'speech-request-busy' : 'coach-audio-busy' }); return
        }
        if (!voices.length) { send({ type: 'error', id: request.id, error: 'no-turkish-voice' }); return }
        send({ type: 'status', id: request.id, stage: 'voices-ready', voiceCount: voices.length })
        const deniedNow = speechAccess(port.sender, request, chromeApi.runtime.id, config)
        if (deniedNow) { send({ type: 'error', id: request.id, error: deniedNow }); return }
        // isSpeaking() is system-wide on some platforms, not ownership of this
        // coach's audio. Let Chrome enqueue rather than rejecting on that flag.
        // There is no await between acquiring this slot and submitting speech.
        const voice = voices.find(item => item.voiceName === request.voiceName) || voices[0]
        owner = port; activeId = request.id
        const armWatchdog = (error, delay) => {
          clearWatchdog()
          watchdog = schedule(() => {
            if (closed || activeId !== request.id || task !== generation) return
            stopOwn(); send({ type: 'error', id: request.id, error })
          }, delay)
        }
        // The page may stop running its own timeout while backgrounded. A lost
        // native start/end must not reserve the speech service for every tab.
        armWatchdog('speech-start-timeout', 8000)
        send({ type: 'status', id: request.id, stage: 'submitted' })
        await chromeApi.tts.speak(request.text, {
          voiceName: voice.voiceName, lang: voice.lang.replace('_', '-'), volume: 1, pitch: 1,
          rate: Math.max(0.8, Math.min(1.2, Number(request.rate) || 1)), enqueue: true,
          onEvent: event => {
            if (closed || activeId !== request.id || task !== generation) return
            const terminal = ['end', 'error', 'cancelled', 'interrupted'].includes(event.type)
            if (terminal) { clearWatchdog(); activeId = null; if (owner === port) owner = null }
            else if (['start', 'word', 'sentence', 'marker', 'resume'].includes(event.type)) {
              armWatchdog('speech-completion-timeout', Math.min(600000, Math.max(30000, request.text.length * 160 + 15000)))
            }
            send({ type: 'event', id: request.id, event: event.type, voice: voice.voiceName,
              error: event.type === 'error' ? String(event.errorMessage || 'native-tts-error').slice(0, 180) : null })
          }
        })
      } catch (error) {
        if (closed || task !== generation) return
        if (activeId === request.id && owner === port) stopOwn()
        send({ type: 'error', id: request.id, error: String(error.message || 'native-tts-error').slice(0, 180) })
      }
    })
  })
}
