/**
 * HUD kit shared by the 3D games: the stage layout (3D stage + side panel),
 * player plates, the "what now" banner, dice, view buttons, an error toast
 * and modal sheets. Purely informative pieces let taps through to the board.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { animate } from 'animejs'
import { AnimatedNumber, softSpring, spring } from '../../lib/motion'
import { isMuted, onMuteChange, setMuted } from '../../lib/sound'

/** 3D stage on the left (with HUD on top), side panel on the right; stacked on phones. */
export function StageLayout({ stage, top, bottom, aside, overlay, sky = 'linear-gradient(#BFE3F2, #8FCBE8)', stageRef }) {
  return (
    <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section
        className="relative h-[min(72svh,42rem)] min-h-[24rem] overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-30px_rgba(34,37,46,.6)] lg:h-[calc(100svh-7.5rem)]"
        style={{ background: sky }}
      >
        {stage}
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">{top}</div>
          <div className="flex flex-col items-center gap-2">{bottom}</div>
        </div>
        {stageRef && <ViewButtons stageRef={stageRef} />}
        {overlay}
      </section>
      {aside && <aside className="flex min-w-0 flex-col gap-3 lg:max-h-[calc(100svh-7.5rem)] lg:overflow-y-auto lg:pr-1">{aside}</aside>}
    </div>
  )
}

/** Player plates: a ring that fills toward `max`, name, a stats line and badges. */
export function Plates({ players }) {
  // three or more players on a phone: just the rings (names come back from sm up)
  const crowded = players.length > 2
  return (
    <div className={`flex min-w-0 gap-1.5 ${crowded ? 'max-sm:gap-1' : ''}`}>
      {players.map((p) => {
        const pct = p.max ? Math.min(1, p.value / p.max) : 0
        const R = 19
        return (
          <motion.div
            key={p.name}
            layout
            className={`flex min-w-0 items-center gap-2 rounded-2xl bg-paper/90 py-1 pl-1 pr-2.5 shadow-sm backdrop-blur sm:gap-2.5 sm:py-1.5 sm:pl-1.5 sm:pr-3 ${crowded ? 'max-sm:shrink-0 max-sm:rounded-full max-sm:p-0.5' : ''}`}
            title={p.name}
            animate={{ scale: p.active ? 1 : 0.94, opacity: p.active ? 1 : 0.85 }}
            style={p.active ? { boxShadow: `0 0 0 3px ${p.color}` } : undefined}
            transition={softSpring}
          >
            <div className="relative h-9 w-9 shrink-0 sm:h-11 sm:w-11">
              <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                <circle cx="22" cy="22" r={R} fill="none" stroke="var(--color-line)" strokeWidth="4" />
                <motion.circle
                  cx="22" cy="22" r={R} fill="none" stroke={p.color} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * R}
                  animate={{ strokeDashoffset: 2 * Math.PI * R * (1 - pct) }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold">
                {typeof p.value === 'number' ? <AnimatedNumber value={p.value} /> : p.value}
              </span>
            </div>
            <div className={`min-w-0 ${crowded ? 'max-sm:hidden' : ''}`}>
              <p className="truncate text-sm font-bold" style={{ color: p.color }}>{p.name}{p.you && ' (tú)'}</p>
              {p.stats && <p className="hidden truncate text-xs text-muted sm:block">{p.stats}</p>}
              {p.badges?.length > 0 && (
                <p className="mt-0.5 flex gap-1 text-[0.65rem] font-bold">
                  {p.badges.map((b) => <span key={b} className="rounded-full bg-ink px-1.5 text-white">{b}</span>)}
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/** What to do now. Changes slide in; informative only, so taps pass through. */
export function Banner({ title, hint, color, children }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={title}
        className="max-w-[min(100%,34rem)] rounded-2xl bg-paper/92 px-4 py-2 text-center shadow-md backdrop-blur"
        initial={{ y: 16, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -10, opacity: 0, transition: { duration: 0.15 } }}
        transition={spring}
        aria-live="polite"
      >
        <p className="font-display text-lg font-extrabold sm:text-xl" style={{ color }}>{title}</p>
        {hint && <p className="text-xs text-muted sm:text-sm">{hint}</p>}
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Error toast that shakes in and goes away by itself. */
export function useFlash(error, errorId, ms = 3200) {
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (error) setFlash({ text: error, id: errorId })
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), ms)
    return () => clearTimeout(id)
  }, [flash, ms])
  return flash
}

export function Flash({ flash }) {
  return (
    <AnimatePresence>
      {flash && (
        <motion.p
          key={flash.id}
          className="pointer-events-auto rounded-full bg-danger px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1, x: [0, -6, 6, -3, 0] }}
          exit={{ opacity: 0 }}
          role="alert"
        >
          {flash.text}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

/* --- dice ------------------------------------------------------------------- */

const PIPS = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
}

export function DieFace({ value, red, ring }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-md">
      <rect x="3" y="3" width="94" height="94" rx="22" fill="white" stroke={ring ?? 'rgba(0,0,0,.12)'} strokeWidth={ring ? 8 : 3} />
      {PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill={red ? '#C0392B' : '#22252E'} />)}
    </svg>
  )
}

/**
 * The last roll. Each new `rollId` tumbles the dice with anime.js. Pass
 * `onPick(i)` to make each die selectable (`selected`, `used`).
 */
export function DiceTray({ dice, rollId, sum = true, red, selected, used = [], onPick, ringColor }) {
  const refs = [useRef(null), useRef(null)]
  const [faces, setFaces] = useState(dice ?? null)
  const first = useRef(true)

  useEffect(() => {
    if (!dice) return
    if (first.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      first.current = false
      setFaces(dice)
      return
    }
    let n = 0
    const tick = setInterval(() => {
      n++
      setFaces([1 + ((n * 5 + 2) % 6), 1 + ((n * 3 + 4) % 6)])
    }, 70)
    const stop = setTimeout(() => {
      clearInterval(tick)
      setFaces(dice)
    }, 650)
    refs.forEach((r, i) => r.current && animate(r.current, { rotate: [i ? 420 : -480, 0], translateY: [-40, 0], scale: [0.6, 1], duration: 900, ease: 'outBounce' }))
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
  }, [rollId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!faces || !dice) return null
  const total = dice[0] + dice[1]
  return (
    <div className={`flex shrink-0 items-center gap-1 rounded-2xl bg-paper/90 p-1 pr-2 shadow-sm backdrop-blur sm:gap-1.5 sm:p-1.5 sm:pr-3 ${onPick ? 'pointer-events-auto' : ''}`} aria-label={`Dados: ${dice.join(' y ')}`}>
      {faces.map((v, i) => {
        const content = (
          <div ref={refs[i]} className="h-8 w-8 sm:h-11 sm:w-11" style={{ opacity: used.includes(i) ? 0.3 : 1 }}>
            <DieFace value={v} red={red} ring={selected === i ? ringColor : undefined} />
          </div>
        )
        return onPick ? (
          <button key={i} onClick={() => onPick(i)} disabled={used.includes(i)} aria-pressed={selected === i} aria-label={`Usar el dado ${v}`} className="rounded-xl">
            {content}
          </button>
        ) : (
          <div key={i}>{content}</div>
        )
      })}
      {sum && <span className={`ml-1 font-display text-2xl font-extrabold tabular-nums ${red ? 'text-danger' : ''}`}>{total}</span>}
    </div>
  )
}

/* --- camera ------------------------------------------------------------------ */

export function ViewButtons({ stageRef }) {
  const btn = 'flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 text-lg font-bold shadow-sm backdrop-blur hover:bg-paper'
  return (
    <>
      <div className="absolute bottom-3 left-3 hidden flex-col gap-1.5 sm:flex">
        <button className={btn} onClick={() => stageRef.current?.call('zoom', 1)} aria-label="Acercar">+</button>
        <button className={btn} onClick={() => stageRef.current?.call('zoom', -1)} aria-label="Alejar">−</button>
        <button className={btn} onClick={() => stageRef.current?.call('resetView')} aria-label="Centrar la vista (R)" title="Centrar la vista (R)">⟲</button>
        <MuteButton className={btn} />
      </div>
    </>
  )
}

/** Sound on/off (remembered in this browser). */
export function MuteButton({ className }) {
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => onMuteChange(setMutedState), [])
  return (
    <button className={className} onClick={() => setMuted(!muted)} aria-pressed={muted} aria-label={muted ? 'Activar el sonido' : 'Silenciar'} title={muted ? 'Activar el sonido' : 'Silenciar'}>
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

/** R centers the camera again on any 3D board. */
export function useViewKeys(stageRef) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key.toLowerCase() === 'r') stageRef.current?.call('resetView')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [stageRef])
}

/* --- panels and sheets -------------------------------------------------------------- */

export function Panel({ title, children, right }) {
  return (
    <section className="rounded-[1.6rem] bg-paper p-3">
      {(title || right) && (
        <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
          {title && <h2 className="font-bold">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

export function Sheet({ children, onClose, bottom = false }) {
  return (
    <motion.div
      className={`fixed inset-0 z-50 flex justify-center bg-ink/35 p-4 ${bottom ? 'items-end sm:items-center' : 'items-center'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-3xl bg-paper p-5 shadow-2xl"
        initial={{ y: 60, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

/** Log list: newest first, the latest one slides in. */
export function LogList({ items, render, colorOf, empty = 'Aquí aparece lo que va pasando.' }) {
  const list = [...items].reverse()
  if (!list.length) return <p className="py-2 text-sm text-muted">{empty}</p>
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
      {list.map((l, i) => (
        <motion.li
          key={items.length - i}
          className={`flex items-start gap-2 ${i === 0 ? 'font-semibold' : 'text-muted'}`}
          initial={i === 0 ? { opacity: 0, x: -10 } : false}
          animate={{ opacity: 1, x: 0 }}
        >
          {l.player && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(l.player) }} />}
          {render(l)}
        </motion.li>
      ))}
    </ul>
  )
}

/** Big call-to-action button floating at the bottom of the stage. */
export function BigAction({ children, onClick, color, pulse = true, disabled }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="pointer-events-auto rounded-full px-8 py-3.5 font-display text-xl font-extrabold text-white shadow-xl disabled:opacity-40"
      style={{ background: color }}
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: pulse ? [1, 1.05, 1] : 1, opacity: 1 }}
      transition={{ scale: pulse ? { duration: 1.6, repeat: Infinity } : spring, opacity: { duration: 0.2 } }}
    >
      {children}
    </motion.button>
  )
}
