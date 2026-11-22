/**
 * Game sounds, synthesized with the Web Audio API (no audio files to load).
 *
 *   play('timeUp')     // the alarm when a countdown reaches zero
 *   play('fanfare')    // trumpets for a big win
 *
 * Browsers only allow sound after the person has interacted with the page,
 * so the audio context is created (or resumed) lazily on the first play.
 * The mute switch is remembered per browser.
 */
const MUTE_KEY = 'cerquita:muted'
let ctx = null
let master = null
const listeners = new Set()

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // private mode: the switch just won't be remembered
  }
  if (master) master.gain.value = muted ? 0 : 0.8
  listeners.forEach((fn) => fn(muted))
}

export function onMuteChange(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function audio() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = isMuted() ? 0 : 0.8
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

/** One note with an envelope. `type` is the oscillator wave. */
function note(ac, { freq, start, dur, type = 'sine', gain = 0.3, attack = 0.01, release = 0.12, vibrato = 0, to = null, out = master }) {
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  if (vibrato) {
    const lfo = ac.createOscillator()
    const depth = ac.createGain()
    lfo.frequency.value = 5.5
    depth.gain.value = vibrato
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(start)
    lfo.stop(start + dur + release)
  }
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + attack)
  g.gain.setValueAtTime(gain, start + Math.max(attack, dur - release))
  g.gain.linearRampToValueAtTime(0, start + dur + release)
  osc.connect(g).connect(out)
  osc.start(start)
  osc.stop(start + dur + release + 0.05)
}

/** A brassy voice: a few detuned sawtooths through a low-pass filter. */
function brass(ac, freq, start, dur, gain = 0.12) {
  const filter = ac.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(900, start)
  filter.frequency.linearRampToValueAtTime(2600, start + 0.06)
  filter.frequency.linearRampToValueAtTime(1600, start + dur)
  filter.connect(master)
  for (const detune of [-6, 0, 6]) {
    note(ac, { freq: freq * 2 ** (detune / 1200), start, dur, type: 'sawtooth', gain, attack: 0.03, release: 0.15, vibrato: dur > 0.4 ? 4 : 0, out: filter })
  }
}

/** A burst of filtered noise (swooshes, rattles, rumbles). */
let noiseBuffer = null
function noise(ac, { start, dur, gain = 0.25, type = 'bandpass', freq = 1200, to = null, q = 1, attack = 0.005 }) {
  if (!noiseBuffer) {
    noiseBuffer = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer
  src.loop = true
  const filter = ac.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, start)
  if (to) filter.frequency.exponentialRampToValueAtTime(to, start + dur)
  const g = ac.createGain()
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(gain, start + attack)
  g.gain.exponentialRampToValueAtTime(0.001, start + dur)
  src.connect(filter).connect(g).connect(master)
  src.start(start)
  src.stop(start + dur + 0.05)
}

/** Notes of a little melody: [frequency, start offset, duration]. */
function melody(ac, t, seq, opts = {}) {
  for (const [freq, at, dur] of seq) note(ac, { freq, start: t + at, dur, ...opts })
}

const SOUNDS = {
  // time's up: two descending "buzz" beeps and a low final tone
  timeUp(ac, t) {
    note(ac, { freq: 880, start: t, dur: 0.14, type: 'square', gain: 0.16 })
    note(ac, { freq: 880, start: t + 0.2, dur: 0.14, type: 'square', gain: 0.16 })
    note(ac, { freq: 660, start: t + 0.42, dur: 0.5, type: 'square', gain: 0.18, to: 440, release: 0.25 })
  },
  // the last seconds of a countdown
  tick(ac, t) {
    note(ac, { freq: 1200, start: t, dur: 0.03, type: 'triangle', gain: 0.12, release: 0.04 })
  },
  // trumpet fanfare: ta-ta-ta-taaa, then the chord
  fanfare(ac, t) {
    const G4 = 392
    const C5 = 523.25
    const E5 = 659.25
    const G5 = 783.99
    const seq = [
      [G4, 0, 0.14],
      [G4, 0.16, 0.14],
      [G4, 0.32, 0.14],
      [C5, 0.48, 0.5],
      [G4, 1.02, 0.18],
      [C5, 1.22, 0.16],
      [E5, 1.4, 0.16],
      [G5, 1.58, 1.1],
    ]
    for (const [f, at, d] of seq) brass(ac, f, t + at, d)
    // the second trumpet joins on the final chord
    brass(ac, E5, t + 1.58, 1.1, 0.09)
    brass(ac, C5, t + 1.58, 1.1, 0.08)
    // a timpani roll underneath
    for (let i = 0; i < 10; i++) note(ac, { freq: 98, start: t + 1.5 + i * 0.07, dur: 0.06, type: 'sine', gain: 0.18, to: 70 })
  },

  /* -- Mazmorras ------------------------------------------------------------ */
  // a d20 rattling on the table
  dice(ac, t) {
    for (let i = 0; i < 7; i++) {
      const at = t + i * 0.06 + i * i * 0.006
      noise(ac, { start: at, dur: 0.04, gain: 0.22 - i * 0.025, freq: 2600 + (i % 3) * 600, q: 6 })
      note(ac, { freq: 900 + (i % 2) * 300, start: at, dur: 0.015, type: 'triangle', gain: 0.05, release: 0.02 })
    }
  },
  // a blade: swoosh, then the clang
  sword(ac, t) {
    noise(ac, { start: t, dur: 0.18, gain: 0.3, freq: 600, to: 3200, q: 2, attack: 0.04 })
    for (const f of [1870, 2490, 3320]) note(ac, { freq: f, start: t + 0.15, dur: 0.05, type: 'sine', gain: 0.07, release: 0.35 })
  },
  // a sparkling spell going out
  spell(ac, t) {
    note(ac, { freq: 300, start: t, dur: 0.35, type: 'sawtooth', gain: 0.06, to: 1400 })
    for (let i = 0; i < 6; i++) note(ac, { freq: 1400 + i * 260, start: t + 0.12 + i * 0.04, dur: 0.05, type: 'sine', gain: 0.06, release: 0.2 })
  },
  thunder(ac, t) {
    noise(ac, { start: t, dur: 1.2, gain: 0.5, type: 'lowpass', freq: 900, to: 90, attack: 0.01 })
    note(ac, { freq: 70, start: t, dur: 0.6, type: 'sine', gain: 0.3, to: 40, release: 0.4 })
  },
  // warm rising arpeggio
  heal(ac, t) {
    melody(ac, t, [[523.25, 0, 0.12], [659.25, 0.09, 0.12], [783.99, 0.18, 0.12], [1046.5, 0.27, 0.3]], { type: 'sine', gain: 0.12, release: 0.3 })
    melody(ac, t, [[1046.5, 0.27, 0.3], [1318.5, 0.32, 0.3]], { type: 'triangle', gain: 0.04, release: 0.4 })
  },
  // a beast growls (a fight starts)
  growl(ac, t) {
    note(ac, { freq: 95, start: t, dur: 0.7, type: 'sawtooth', gain: 0.16, to: 70, vibrato: 9, attack: 0.08, release: 0.2 })
    noise(ac, { start: t, dur: 0.75, gain: 0.18, type: 'lowpass', freq: 500, to: 220, attack: 0.08 })
  },
  // a boss's special attack: a big roar
  roar(ac, t) {
    note(ac, { freq: 160, start: t, dur: 1.1, type: 'sawtooth', gain: 0.18, to: 60, vibrato: 14, attack: 0.1, release: 0.3 })
    note(ac, { freq: 240, start: t, dur: 1.0, type: 'square', gain: 0.06, to: 90, vibrato: 10, attack: 0.1 })
    noise(ac, { start: t, dur: 1.3, gain: 0.3, type: 'lowpass', freq: 1400, to: 150, attack: 0.1 })
  },
  // a heavy door creaks open
  door(ac, t) {
    note(ac, { freq: 180, start: t, dur: 0.6, type: 'sawtooth', gain: 0.05, to: 240, vibrato: 18, attack: 0.05 })
    noise(ac, { start: t + 0.55, dur: 0.3, gain: 0.3, type: 'lowpass', freq: 300, attack: 0.005 })
  },
  levelup(ac, t) {
    melody(ac, t, [[523.25, 0, 0.1], [659.25, 0.1, 0.1], [783.99, 0.2, 0.1], [1046.5, 0.3, 0.1], [1318.5, 0.4, 0.45]], { type: 'square', gain: 0.07, release: 0.2 })
  },
  // someone takes a hit
  hurt(ac, t) {
    noise(ac, { start: t, dur: 0.12, gain: 0.35, type: 'lowpass', freq: 800, attack: 0.002 })
    note(ac, { freq: 140, start: t, dur: 0.12, type: 'sine', gain: 0.25, to: 70 })
  },
  miss(ac, t) {
    noise(ac, { start: t, dur: 0.22, gain: 0.18, freq: 1800, to: 500, q: 1.5, attack: 0.03 })
  },
  shield(ac, t) {
    for (const f of [620, 930]) note(ac, { freq: f, start: t, dur: 0.04, type: 'triangle', gain: 0.1, release: 0.25 })
  },
  kill(ac, t) {
    noise(ac, { start: t, dur: 0.4, gain: 0.3, type: 'lowpass', freq: 600, to: 120 })
    melody(ac, t + 0.1, [[392, 0, 0.1], [523.25, 0.1, 0.2]], { type: 'triangle', gain: 0.1 })
  },
  good(ac, t) {
    melody(ac, t, [[659.25, 0, 0.1], [987.77, 0.1, 0.25]], { type: 'triangle', gain: 0.12, release: 0.2 })
  },
  bad(ac, t) {
    melody(ac, t, [[392, 0, 0.14], [311.13, 0.15, 0.35]], { type: 'square', gain: 0.07, release: 0.15 })
  },
  down(ac, t) {
    melody(ac, t, [[392, 0, 0.2], [349.23, 0.2, 0.2], [293.66, 0.4, 0.5]], { type: 'triangle', gain: 0.12, release: 0.3 })
  },
  // a page turns (the DM narrates, the rulebook opens)
  page(ac, t) {
    noise(ac, { start: t, dur: 0.18, gain: 0.12, type: 'highpass', freq: 2500, attack: 0.06 })
  },
  /* -- Anzuelo ---------------------------------------------------------------- */
  // a fish jumps out of the water
  splash(ac, t) {
    noise(ac, { start: t, dur: 0.35, gain: 0.35, type: 'lowpass', freq: 2400, to: 400, attack: 0.01 })
    for (let i = 0; i < 4; i++) note(ac, { freq: 700 + i * 260, start: t + 0.05 + i * 0.05, dur: 0.04, type: 'sine', gain: 0.06, to: 1400 + i * 200, release: 0.06 })
  },
  // the reel clicks while the fisher pulls
  reel(ac, t) {
    for (let i = 0; i < 9; i++) noise(ac, { start: t + i * 0.045, dur: 0.02, gain: 0.16, freq: 3200, q: 8 })
  },
  // a bubble: someone sent their answer
  bubble(ac, t) {
    note(ac, { freq: 420, start: t, dur: 0.09, type: 'sine', gain: 0.14, to: 980, release: 0.05 })
  },
  victory(ac, t) {
    SOUNDS.fanfare(ac, t)
  },
  // a sad, slow descent
  defeat(ac, t) {
    melody(ac, t, [[392, 0, 0.45], [369.99, 0.5, 0.45], [349.23, 1.0, 0.45], [329.63, 1.5, 1.2]], { type: 'sawtooth', gain: 0.06, release: 0.4, vibrato: 3 })
    note(ac, { freq: 98, start: t + 1.5, dur: 1.4, type: 'sine', gain: 0.18, release: 0.6 })
  },
}

/** Plays a named sound (does nothing when muted or without Web Audio). */
export function play(name) {
  if (isMuted()) return
  const ac = audio()
  if (!ac || !SOUNDS[name]) return
  try {
    SOUNDS[name](ac, ac.currentTime + 0.02)
  } catch {
    // audio is a nice-to-have: never break the game over it
  }
}

/** Unlocks audio on the first tap anywhere (some browsers need it). */
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (!isMuted()) audio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}
