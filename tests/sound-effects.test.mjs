import test from 'node:test'
import assert from 'node:assert/strict'
import { createSoundEffects, effectEvents, effectPatterns } from '../extension/sound-effects.js'

function fixture() {
  const preferences = { effects: true, effectMate: true, effectTactic: true, effectBlunder: true, effectConnection: true, effectVolume: 0.25 }
  let time = 0; let speaking = false; let stopped = 0
  const tones = []; const states = []
  const timers = new Map(); let timerId = 0
  const context = { state: 'suspended', currentTime: 2, destination: {}, resume: async () => { context.state = 'running' }, close: async () => { context.state = 'closed' },
    createOscillator() {
      const tone = { frequency: { setValueAtTime(value, at) { tone.frequencyValue = value; tone.at = at } },
        connect(gain) { tone.gain = gain }, disconnect() {}, start(at) { tone.startAt = at; tones.push(tone) }, stop() { stopped++ } }
      return tone
    },
    createGain() { const peaks = []; return { peaks, connect() {}, disconnect() {}, gain: { setValueAtTime() {}, linearRampToValueAtTime: value => peaks.push(value) } } }
  }
  const effects = createSoundEffects(() => preferences, { createContext: () => context, now: () => time,
    isSpeaking: () => speaking, onState: state => states.push(state),
    schedule: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, at: time + delay }); return id },
    unschedule: id => timers.delete(id) })
  const tick = until => { time = until; for (const [id, timer] of timers) if (timer.at <= time) { timers.delete(id); timer.callback() } }
  return { effects, tones, states, context, preferences, tick, setTime: value => { time = value }, setSpeaking: value => { speaking = value }, stopped: () => stopped }
}

test('effects require explicit unlock and independent preferences; batches choose only the most important cue', async () => {
  const f = fixture()
  const events = [{ key: 'fork', type: 'tactic' }, { key: 'mate', type: 'mate' }]
  assert.equal(f.effects.notify(events), false)
  assert.equal(await f.effects.unlock(), true)
  assert.equal(f.effects.notify(events), true)
  assert.equal(f.tones.length, effectPatterns.mate.length)
  assert.equal(f.tones[0].frequencyValue, effectPatterns.mate[0][0])
  f.setTime(5000)
  assert.equal(f.effects.notify(events), false)
  f.preferences.effectTactic = false
  assert.equal(f.effects.notify([{ key: 'other', type: 'tactic' }]), false)
  f.preferences.effects = false
  assert.equal(f.effects.notify([{ key: 'other', type: 'blunder' }]), false)
  f.effects.dispose()
})

test('cooldowns prevent bursts, speech reduces volume, zero volume is silent, and stop closes active tones', async () => {
  const f = fixture(); await f.effects.unlock()
  f.setSpeaking(true)
  assert.equal(f.effects.notify([{ key: 'a', type: 'tactic' }]), true)
  assert.ok(f.tones.every(tone => tone.gain.peaks[0] < 0.02))
  f.setTime(100)
  assert.equal(f.effects.notify([{ key: 'b', type: 'mate' }]), false)
  f.setTime(400)
  assert.equal(f.effects.notify([{ key: 'b', type: 'mate' }]), true)
  f.setTime(2200)
  assert.equal(f.effects.notify([{ key: 'c', type: 'mate' }]), false)
  f.setTime(5000); f.preferences.effectVolume = 0
  assert.equal(f.effects.notify([{ key: 'd', type: 'blunder' }]), false)
  const before = f.stopped(); f.effects.stop()
  assert.ok(f.stopped() > before)
  f.effects.dispose()
})

test('past positions, conditional ideas and routine grades never create current-position warning effects', () => {
  const items = [
    { key: 'past', fen: 'old', gradeCode: 'blunder', channel: 'grades' },
    { key: 'routine', fen: 'new', gradeCode: 'best', channel: 'grades' },
    { key: 'conditional', fen: 'new', channel: 'fork', critical: true, conditional: true },
    { key: 'danger', fen: 'new', channel: 'mate', color: 'b', critical: true }
  ]
  assert.deepEqual(effectEvents(items, 'new', 'w'), [{ key: 'danger', type: 'mate' }])
})

test('manual previews work with automatic effects off and startup failures are visible without throwing', async () => {
  const f = fixture(); f.preferences.effects = false
  assert.equal(await f.effects.preview('connection'), true)
  assert.equal(f.tones.length, 2)
  f.effects.dispose()
  const bad = createSoundEffects(() => ({}), { createContext: () => { throw new Error('unavailable') } })
  assert.equal(await bad.unlock(), false)
  assert.equal(bad.getState().state, 'error')
  assert.equal(bad.getState().error, 'unavailable')
  bad.dispose()
})

test('a capture animation that recovers quickly makes no connection beep, while a sustained loss does', async () => {
  const f = fixture(); await f.effects.unlock()
  f.effects.connection(true, 'transient')
  f.tick(1500); f.effects.connection(false); f.tick(2500)
  assert.equal(f.tones.length, 0)
  f.effects.connection(true, 'sustained'); f.tick(4500)
  assert.equal(f.tones.length, effectPatterns.connection.length)
  f.effects.connection(true, 'pending'); f.effects.dispose(); f.tick(7000)
  assert.equal(f.tones.length, effectPatterns.connection.length)
})
