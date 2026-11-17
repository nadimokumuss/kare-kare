import test from 'node:test'
import assert from 'node:assert/strict'
import { createNativeSynthesis, speechErrorText } from '../extension/native-speech.js'
import { installTtsHost, localTurkishVoices, speechAccess } from '../extension/tts-host.js'
import { createSpeechCoach } from '../extension/speech-coach.js'

const event = () => {
  const listeners = []
  return { addListener: listener => listeners.push(listener), emit: value => Promise.all(listeners.map(listener => listener(value))) }
}
const tick = () => new Promise(resolve => setImmediate(resolve))
const settle = async () => { await tick(); await tick() }
const sender = { id: 'extension-id', url: 'https://www.chess.com/play/computer', frameId: 0, tab: { id: 1 } }

function fixture(voices = [{ voiceName: 'Yelda', lang: 'tr-TR', remote: false }], timers = {}) {
  const spoken = [], ports = [], errors = []
  let stopped = 0, busy = false
  const runtime = { id: sender.id, onConnect: event(), connect() {
    const client = { onMessage: event(), onDisconnect: event() }
    const host = { name: 'kare-kare-native-speech-v1', sender: { ...sender, tab: { id: ports.length + 1 } }, onMessage: event(), onDisconnect: event() }
    client.postMessage = request => { Promise.resolve().then(() => host.onMessage.emit(structuredClone(request))).catch(error => errors.push(error)) }
    host.postMessage = response => { Promise.resolve().then(() => client.onMessage.emit(structuredClone(response))).catch(error => errors.push(error)) }
    client.disconnect = () => { host.onDisconnect.emit(); client.onDisconnect.emit() }
    ports.push(client); runtime.onConnect.emit(host)
    return client
  } }
  const tts = { getVoices: async () => voices, isSpeaking: async () => busy,
    speak: async (text, options) => { spoken.push({ text, options }) }, stop: () => { stopped++ }, resume() {} }
  installTtsHost({ runtime, tts }, { enabled: false }, timers)
  return { runtime, tts, spoken, errors, ports, stopped: () => stopped, setBusy: value => { busy = value } }
}

test('the native adapter stops obsolete speech, ignores its late end, and reads a clearly historical replacement', async () => {
  const f = fixture(), states = []
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer', account: null }))
  native.refreshVoices(); await settle()
  assert.equal(native.getVoices()[0].name, 'Yelda')
  const coach = createSpeechCoach(native, text => ({ text }), () => ({ voiceRate: 1, voiceName: '' }), assert.fail,
    { onState: state => states.push(state.state) })
  coach.positionChanged('A')
  coach.enqueue({ key: 'mate', fen: 'A', text: 'İki hamlede mat.', critical: true, historicalText: 'Önceki konumda mat hesaplanmıştı.' })
  await settle()
  assert.equal(f.spoken.length, 1)
  assert.equal(f.spoken[0].options.voiceName, 'Yelda')
  assert.equal(f.spoken[0].options.lang, 'tr-TR')
  assert.match(f.spoken[0].text, /şah matı/)
  f.spoken[0].options.onEvent({ type: 'start' }); await settle()
  coach.positionChanged('B')
  await settle()
  assert.equal(f.stopped(), 1)
  assert.equal(coach.getState().state, 'ready')
  f.spoken[0].options.onEvent({ type: 'end' }); await settle()
  await new Promise(resolve => setTimeout(resolve, 80))
  assert.equal(f.spoken.length, 2)
  assert.match(f.spoken[1].text, /^Geçmiş konum\./)
  assert.match(f.spoken[1].text, /hesaplanmıştı/)
  f.spoken[1].options.onEvent({ type: 'start' }); await settle()
  assert.equal(coach.getState().historical, true)
  f.spoken[1].options.onEvent({ type: 'end' }); await settle()
  assert.equal(coach.getState().state, 'ready')
  assert.deepEqual(states, ['starting', 'speaking', 'ready', 'starting', 'speaking', 'ready'])
  assert.deepEqual(f.errors, [])
  coach.stop(); native.dispose()
})

test('a missing local Turkish voice is explicit and never falls back to a remote/third-party voice', async () => {
  const voices = [{ voiceName: 'English', lang: 'en-US' }, { voiceName: 'Cloud', lang: 'tr-TR', remote: true },
    { voiceName: 'External', lang: 'tr-TR', extensionId: 'another-extension' }]
  assert.deepEqual(localTurkishVoices(voices), [])
  const f = fixture(voices), problems = []
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  native.speak({ text: 'Ses denemesi.', rate: 1, onerror: event => problems.push(event.error) }); await settle()
  assert.deepEqual(problems, ['no-turkish-voice'])
  assert.match(speechErrorText(problems[0]), /Türkçe sistem sesi bulunamadı/)
  assert.equal(f.spoken.length, 0)
  native.dispose()
})

test('native speech retains account, route, origin, frame and date restrictions', () => {
  const config = { enabled: true, accounts: ['hisaycheese'], from: '2026-10-24T18:00:00+03:00', until: '2026-11-23T18:00:00+03:00' }
  const now = new Date('2026-10-26T12:00:00+03:00'), live = { ...sender, url: 'https://www.chess.com/game/12345' }
  const request = { path: '/game/12345', account: 'hisaycheese' }
  assert.equal(speechAccess(live, request, sender.id, config, now), null)
  assert.equal(speechAccess(live, { ...request, account: 'ivanofchess' }, sender.id, config, now), 'speech-account-blocked')
  assert.equal(speechAccess(live, request, sender.id, config, new Date('2026-12-01')), 'speech-account-blocked')
  assert.equal(speechAccess({ ...live, frameId: 1 }, request, sender.id, config, now), 'speech-route-blocked')
  assert.equal(speechAccess({ ...live, id: 'other' }, request, sender.id, config, now), 'speech-route-blocked')
  assert.equal(speechAccess({ ...live, url: 'https://example.com/' }, request, sender.id, config, now), 'speech-route-blocked')
  assert.equal(speechAccess(sender, { path: '/analysis' }, sender.id, config, now), 'speech-route-blocked')
  assert.equal(speechAccess(sender, { path: '//example.com/play/computer' }, sender.id, config, now), 'speech-route-blocked')
  assert.equal(speechAccess(live, request, sender.id, { enabled: false }, now), 'speech-route-blocked')
})

test('another tab cannot interrupt an active coach', async () => {
  const f = fixture(), problems = []
  const first = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  const second = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  first.speak({ text: 'İlk koç.', rate: 1 }); await settle()
  second.speak({ text: 'İkinci koç.', rate: 1, onerror: event => problems.push(event.error) }); await settle()
  assert.deepEqual(problems, ['coach-audio-busy'])
  second.cancel(); await settle(); assert.equal(f.stopped(), 0)
  first.dispose(); assert.equal(f.stopped(), 1); second.dispose()
})

test('a system-wide busy flag does not reject coach speech; Chrome receives an enqueued request', async () => {
  const other = fixture(); other.setBusy(true)
  const problems = []
  const native = createNativeSynthesis(other.runtime, () => ({ path: '/play/computer' }))
  native.speak({ text: 'Deneme.', onerror: event => problems.push(event.error) }); await settle()
  assert.equal(other.spoken.length, 1)
  assert.equal(other.spoken[0].options.enqueue, true)
  assert.deepEqual(problems, [])
  assert.equal(other.stopped(), 0)
  native.dispose()
})

test('late errors from an older utterance cannot mark a new speech request as failed', async () => {
  const f = fixture(), problems = []
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }), () => {}, error => problems.push(error))
  native.speak({ text: 'İlk deneme.', onerror: event => problems.push(event.error) }); await settle()
  f.spoken[0].options.onEvent({ type: 'end' }); await settle()
  native.speak({ text: 'İkinci deneme.', onerror: event => problems.push(event.error) }); await settle()
  await f.ports[0].onMessage.emit({ type: 'error', id: 1, error: 'audio-busy' })
  assert.deepEqual(problems, [])
  await f.ports[0].onMessage.emit({ type: 'error', error: 'native-tts-unavailable' })
  assert.deepEqual(problems, ['native-tts-unavailable'])
  native.dispose()
  await f.ports[0].onMessage.emit({ type: 'error', error: 'speech-connection-lost' })
  assert.deepEqual(problems, ['native-tts-unavailable'])
})

test('lost native connection reports a cause and a new explicit request can reconnect', async () => {
  const f = fixture(), problems = []
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  native.speak({ text: 'Deneme.', rate: 1, onerror: event => problems.push(event.error) }); await settle()
  f.ports[0].disconnect(); await settle()
  assert.deepEqual(problems, ['speech-connection-lost'])
  native.speak({ text: 'Yeni deneme.', rate: 1 }); await settle()
  assert.equal(f.spoken.length, 2)
  assert.deepEqual(f.errors, [])
  native.dispose()
})

test('a speech-only heartbeat stops on completion rather than keeping an idle worker alive', async () => {
  const f = fixture(); let pending = null; let cleared = 0
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }), () => {}, assert.fail,
    { every: callback => { pending = callback; return 1 }, clear: () => { pending = null; cleared++ } })
  native.speak({ text: 'Uzun açıklama.', rate: 1 }); await settle()
  assert.ok(pending)
  pending(); await settle()
  assert.equal(f.spoken.length, 1)
  f.spoken[0].options.onEvent({ type: 'end' }); await settle()
  assert.equal(pending, null)
  assert.equal(cleared, 1)
  native.dispose()
})

test('a port that throws without a disconnect event is discarded before the next request', async () => {
  const f = fixture(), problems = []
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  native.refreshVoices(); await settle()
  f.ports[0].postMessage = () => { throw new Error('Attempting to use a disconnected port object') }
  native.speak({ text: 'İlk istek.', onerror: event => problems.push(event.error) }); await settle()
  assert.deepEqual(problems, ['speech-connection-lost'])
  assert.equal(native.getHealth().connected, false)
  native.speak({ text: 'Yeni bağlantı.', onerror: event => problems.push(event.error) }); await settle()
  assert.equal(f.ports.length, 2); assert.equal(f.spoken.length, 1)
  assert.equal(native.getHealth().connections, 2)
  assert.deepEqual(f.errors, [])
  native.dispose()
})

test('a broken heartbeat reports the loss immediately and a fresh connection can speak', async () => {
  const f = fixture(), problems = []; let heartbeat
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }), () => {}, assert.fail,
    { every: callback => { heartbeat = callback; return 1 }, clear: () => { heartbeat = null } })
  native.speak({ text: 'Devam eden açıklama.', onerror: event => problems.push(event.error) }); await settle()
  f.spoken[0].options.onEvent({ type: 'start' }); await settle()
  f.ports[0].postMessage = () => { throw new Error('Port lost') }
  heartbeat(); await settle()
  assert.equal(heartbeat, null)
  assert.deepEqual(problems, ['speech-connection-lost'])
  native.speak({ text: 'Yeni açıklama.' }); await settle()
  assert.equal(f.spoken.length, 2)
  native.dispose()
})

test('word progress without a start event starts the logical utterance only once and diagnostics exclude text', async () => {
  const f = fixture(); let starts = 0, ends = 0
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  native.speak({ text: 'Özel açıklama metni.', onstart: () => starts++, onend: () => ends++ }); await settle()
  f.spoken[0].options.onEvent({ type: 'word', charIndex: 0 }); await settle()
  f.spoken[0].options.onEvent({ type: 'start' }); await settle()
  f.spoken[0].options.onEvent({ type: 'word', charIndex: 4 }); await settle()
  f.spoken[0].options.onEvent({ type: 'end' }); await settle()
  assert.equal(starts, 1); assert.equal(ends, 1)
  const health = native.getHealth()
  assert.ok(health.trace.some(entry => entry.stage === 'status' && entry.event === 'submitted'))
  assert.ok(health.trace.some(entry => entry.event === 'end'))
  assert.doesNotMatch(JSON.stringify(health), /Özel açıklama metni/)
  native.dispose()
})

test('an explicit reset replaces the connection and ignores old callbacks without failing the new request', async () => {
  const f = fixture(), problems = []
  const native = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  native.speak({ text: 'Önceki açıklama.', onerror: event => problems.push(event.error) }); await settle()
  native.reset(); await settle()
  native.speak({ text: 'Ses denemesi.', onerror: event => problems.push(event.error) }); await settle()
  f.spoken[0].options.onEvent({ type: 'error', errorMessage: 'Late error' }); await settle()
  assert.equal(f.ports.length, 2); assert.equal(f.spoken.length, 2)
  assert.deepEqual(problems, [])
  assert.equal(native.getHealth().pendingId, 2)
  native.dispose()
})

test('a native request with no start event cannot retain ownership forever after the page stops responding', async () => {
  const pending = new Map(); let serial = 0
  const f = fixture(undefined, { schedule: (callback, delay) => { const id = ++serial; pending.set(id, { callback, delay }); return id }, unschedule: id => pending.delete(id) })
  const problems = [], first = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  first.speak({ text: 'Başlamayan açıklama.', onerror: event => problems.push(event.error) }); await settle()
  const timer = [...pending.values()].find(value => value.delay === 8000)
  assert.ok(timer); timer.callback(); await settle()
  assert.deepEqual(problems, ['speech-start-timeout'])
  assert.equal(f.stopped(), 1)
  const second = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  second.speak({ text: 'İkinci sekmenin açıklaması.', onerror: assert.fail }); await settle()
  assert.equal(f.spoken.length, 2)
  f.spoken[1].options.onEvent({ type: 'start' }); await settle()
  assert.ok([...pending.values()].some(value => value.delay >= 30000))
  f.spoken[1].options.onEvent({ type: 'end' }); await settle()
  first.dispose(); second.dispose()
})

test('a failed voice refresh during speech does not release another request’s ownership', async () => {
  const f = fixture(), problems = []
  const first = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }), () => {}, error => problems.push(error))
  first.speak({ text: 'Sürmekte olan açıklama.' }); await settle()
  const getVoices = f.tts.getVoices
  f.tts.getVoices = async () => { throw new Error('voice refresh failed') }
  first.refreshVoices(); await settle()
  f.tts.getVoices = getVoices
  const second = createNativeSynthesis(f.runtime, () => ({ path: '/play/computer' }))
  second.speak({ text: 'Diğer sekme.', onerror: event => problems.push(event.error) }); await settle()
  assert.deepEqual(problems, ['voice refresh failed', 'coach-audio-busy'])
  assert.equal(f.spoken.length, 1)
  first.dispose(); second.dispose()
})
