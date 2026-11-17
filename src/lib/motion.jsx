/**
 * Shared animation pieces built on `motion`. Everything respects the user's
 * "reduce motion" setting through the <MotionConfig reducedMotion="user"> in
 * main.jsx, and the purely decorative bits (confetti) are skipped entirely.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useReducedMotion } from 'motion/react'

export const spring = { type: 'spring', stiffness: 420, damping: 30 }
export const softSpring = { type: 'spring', stiffness: 220, damping: 24 }

/** Fades and lifts its content in when it mounts. */
export function Appear({ children, delay = 0, y = 14, className, as = 'div', ...rest }) {
  const Tag = motion[as]
  return (
    <Tag
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...softSpring, delay }}
      className={className}
      {...rest}
    >
      {children}
    </Tag>
  )
}

/** A number that counts up (or down) to its new value and bumps when it grows. */
export function AnimatedNumber({ value, className, duration = 0.6, decimals = 0, from }) {
  const ref = useRef(null)
  const shown = useRef(from ?? value)
  const format = (v) => (decimals ? v.toFixed(decimals) : Math.round(v))
  const [bump, setBump] = useState(0)

  useEffect(() => {
    const from = shown.current
    if (from === value) return
    if (value > from) setBump((n) => n + 1)
    const controls = animate(from, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => {
        shown.current = v
        if (ref.current) ref.current.textContent = format(v)
      },
    })
    return () => controls.stop()
  }, [value, duration]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.span
      key={bump}
      ref={ref}
      className={`inline-block tabular-nums ${className ?? ''}`}
      initial={bump ? { scale: 1.45 } : false}
      animate={{ scale: 1 }}
      transition={spring}
    >
      {format(shown.current)}
    </motion.span>
  )
}

const CONFETTI_SHAPES = ['rounded-sm', 'rounded-full', 'rounded-none']

/** A one-off burst of confetti over the whole screen. */
export function Confetti({ colors, count = 70 }) {
  const reduce = useReducedMotion()
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      drift: (Math.random() - 0.5) * 220,
      delay: Math.random() * 0.35,
      duration: 2.2 + Math.random() * 1.6,
      spin: (Math.random() - 0.5) * 900,
      size: 6 + Math.random() * 7,
      color: colors[i % colors.length],
      shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
    })),
  )
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDone(true), 4200)
    return () => clearTimeout(t)
  }, [])

  if (reduce || done) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute top-0 ${p.shape}`}
          style={{ left: `${p.x}%`, width: p.size, height: p.size * (p.shape === 'rounded-none' ? 0.45 : 1), background: p.color }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: [0.25, 0.6, 0.45, 1] }}
        />
      ))}
    </div>
  )
}

/** Whose turn it is in a turn-based game, or null when both play at once. */
export function turnOf(game) {
  if (!game || game.phase === 'finished') return null
  if (game.name === 'deeper') return null // every card alternates: a banner each time would be noise
  if (game.toMove) return game.toMove
  if (game.name === 'trivia') return game.mode === 'crowns' ? game.current : null
  if (game.name === 'charades') return game.phase === 'ready' ? game.actor : null
  if (game.name === 'pinturillo') return null
  if (typeof game.turn === 'string' && game.players?.includes(game.turn)) return game.turn
  return null
}

/** "¡Te toca!" banner that drops in when the turn passes to you. */
export function TurnBanner({ game, me, color }) {
  const who = turnOf(game)
  const previous = useRef(who)
  const [show, setShow] = useState(0)

  useEffect(() => {
    if (who === me && previous.current !== me && previous.current !== undefined) setShow((n) => n + 1)
    previous.current = who
  }, [who, me])

  useEffect(() => {
    if (!show) return
    const t = setTimeout(() => setShow(0), 1600)
    return () => clearTimeout(t)
  }, [show])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center" aria-live="polite">
      <AnimatePresence>
        {show > 0 && (
          <motion.div
            key={show}
            className="rounded-full px-5 py-2 font-display text-lg font-extrabold text-white shadow-lg"
            style={{ background: color }}
            initial={{ y: -60, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -40, opacity: 0, scale: 0.9 }}
            transition={spring}
          >
            ¡Te toca!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
