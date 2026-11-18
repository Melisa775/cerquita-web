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
