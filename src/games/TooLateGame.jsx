/**
 * Contrarreloj on the 3D stage: a ring of arcade buttons around a clock.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TimerBar from '../components/TimerBar'
import { EndActions, winnerTitle } from '../components/EndActions'
import { useCountdown } from '../hooks/useCountdown'
import { AnimatePresence, motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import Stage3D from '../components/stage/Stage3D'
import { Panel, Plates, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/toolate3d.js')

export default function TooLateGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} send={send} colorOf={colorOf} />
  return <Board room={room} me={me} send={send} colorOf={colorOf} />
}

function Scores({ game, colorOf }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(game.scores).map(([p, n]) => (
        <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
          <span style={{ color: colorOf(p) }}>{p}</span> <AnimatedNumber value={n} />
        </span>
      ))}
    </div>
  )
}

function Board({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)
  const [sentFor, setSentFor] = useState(null) // avoids sending two letters in the same turn
  const usedBy = Object.fromEntries(game.used.map((u) => [u.letter, u.player]))
  const lastUsed = game.used.at(-1)
  const myTurn = game.phase === 'playing' && game.turn === me
  const canPick = myTurn && sentFor !== game.turnId
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  function pick(letter) {
    if (!canPick || usedBy[letter] || !game.letters.includes(letter)) return
    setSentFor(game.turnId)
    send({ type: 'tl_pick', letter })
  }
  const pickRef = useRef(pick)
  pickRef.current = pick
  const onPick = useCallback(({ kind, id }) => kind === 'letter' && pickRef.current(id), [])

  // On desktop you can also play with the keyboard
  useEffect(() => {
    if (!canPick) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      const letter = e.key.toUpperCase()
      if (letter.length === 1) pick(letter)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const colors = useMemo(() => Object.fromEntries(Object.keys(game.scores).map((p) => [p, cssColor(colorOf(p))])), [game.scores, colorOf])
  const state = useMemo(
    () => ({
      letters: game.letters,
      used: game.used,
      colors,
      canPick,
      turnId: game.turnId,
      turnSeconds: game.turnSeconds,
      msLeft: room.phaseEndsInMs,
      playing: game.phase === 'playing',
      turnColor: game.turn ? cssColor(colorOf(game.turn)) : '#E15A4A',
    }),
    [game.letters, game.used, colors, canPick, game.turnId, game.turnSeconds, room.phaseEndsInMs, game.phase, game.turn, colorOf],
  )
  const plates = Object.entries(game.scores).map(([p, n]) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: n,
    max: game.totalRounds,
    stats: `Ronda ${game.round} de ${game.totalRounds}`,
    active: game.phase === 'playing' && game.turn === p,
  }))

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#F7EEE7, #E5CFC2)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Botones de letras en 3D" />}
      top={
        <>
          <Plates players={plates} />
          <div className="max-w-[45%] shrink rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur [perspective:600px]">
            <p className="text-xs font-semibold text-muted">Categoría · {game.used.length}/{game.letters.length}</p>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={game.category}
                className="font-display text-base font-extrabold leading-tight sm:text-xl"
                initial={{ rotateX: -90, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                exit={{ rotateX: 90, opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                {game.category}
              </motion.p>
            </AnimatePresence>
          </div>
        </>
      }
      bottom={
        <div className="pointer-events-auto w-full max-w-xl">
          {game.phase === 'ready' && <Ready game={game} me={me} send={send} colorOf={colorOf} />}
          {game.phase === 'playing' && (
            <Turn game={game} me={me} left={left} msLeft={room.phaseEndsInMs} send={send} colorOf={colorOf} lastUsed={lastUsed} />
          )}
          {game.phase === 'round_over' && <RoundOver game={game} send={send} />}
        </div>
      }
      aside={
        <Panel title="Cómo se juega">
          <ul className="space-y-1 px-1 text-sm text-muted">
            <li>Por turnos, digan en voz alta una palabra de la categoría.</li>
            <li>Toquen la letra con la que empieza: esa ya no se puede usar.</li>
            <li>Si se te acaba el tiempo, el punto es para tu pareja.</li>
            <li>Si la palabra no vale, toquen ¡No vale!</li>
          </ul>
        </Panel>
      }
    />
  )
}

function Ready({ game, me, send, colorOf }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[2rem] bg-paper/95 p-4 shadow-xl backdrop-blur">
      <p className="text-lg">
        Empieza{' '}
        <strong style={{ color: colorOf(game.turn) }}>{game.turn === me ? 'tú' : game.turn}</strong>.
        {' '}Si la categoría no les gusta, cámbienla.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => send({ type: 'tl_reroll' })}
          className="rounded-2xl border border-line px-4 py-3 font-semibold hover:border-ink"
        >
          Otra categoría
        </button>
        <button onClick={() => send({ type: 'tl_begin' })} className="rounded-2xl bg-ink px-6 py-3 font-semibold text-white">
          ¡Empezar!
        </button>
      </div>
    </div>
  )
}

function Turn({ game, me, left, msLeft, send, colorOf, lastUsed }) {
  const mine = game.turn === me
  const color = colorOf(game.turn)
  return (
    <motion.div className="rounded-[2rem] p-4 text-white shadow-xl sm:p-5" animate={{ background: color }} transition={{ duration: 0.35 }} aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div>
          <motion.p
            key={game.turnId}
            className="font-display text-2xl font-extrabold sm:text-3xl"
            initial={{ x: mine ? -30 : 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={spring}
          >
            {mine ? '¡Tu turno!' : `Turno de ${game.turn}`}
          </motion.p>
          <p className="mt-1 text-sm text-white/85 sm:text-base">
            {mine
              ? 'Di una palabra en voz alta y toca la letra con la que empieza.'
              : `Escucha a ${game.turn}. Si su palabra no vale, toquen ¡No vale!`}
          </p>
        </div>
        <motion.span
          key={left}
          className="font-display text-5xl font-extrabold tabular-nums sm:text-6xl"
          aria-label={`${left ?? game.turnSeconds} segundos`}
          initial={{ scale: left != null && left <= 3 ? 1.5 : 1.15, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1, rotate: left != null && left <= 3 ? [0, -6, 6, 0] : 0 }}
          transition={{ duration: 0.3 }}
        >
          {left ?? game.turnSeconds}
        </motion.span>
      </div>
      <TimerBar seconds={game.turnSeconds} resetKey={game.turnId} msLeft={msLeft} color="white" track="bg-white/30" />
      {lastUsed && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-white/85">
            {lastUsed.player === me ? 'Tocaste' : `${lastUsed.player} tocó`} la <strong className="text-white">{lastUsed.letter}</strong>
          </span>
          <button
            onClick={() => send({ type: 'tl_undo' })}
            className="rounded-xl bg-white/20 px-4 py-2 font-semibold hover:bg-white/30"
          >
            ¡No vale!
          </button>
        </div>
      )}
    </motion.div>
  )
}

function RoundOver({ game, send }) {
  const r = game.result
  const players = Object.keys(game.scores)
  const others = r.type === 'timeout' ? players.filter((p) => p !== r.loser) : []
  const winner = others.length === 1 ? others[0] : others.length ? 'los demás' : null
  const last = game.round >= game.totalRounds
  return (
    <motion.div
      className="rounded-[2rem] bg-ink p-6 text-white shadow-xl"
      initial={{ scale: 0.85, opacity: 0, rotate: -2 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 16 }}
    >
      {r.type === 'completed' ? (
        <>
          <p className="font-display text-4xl font-extrabold">¡Lo lograron!</p>
          <p className="mt-1 text-white/80">Usaron las {game.letters.length} letras. Punto para los dos.</p>
        </>
      ) : (
        <>
          <p className="font-display text-4xl font-extrabold">
            ¡Too late, {r.loser}!
          </p>
          <p className="mt-1 text-white/80">
            {winner ? `Se le acabó el tiempo. Punto para ${winner}.` : 'Se acabó el tiempo.'} Llegaron a {game.used.length} letras.
          </p>
        </>
      )}
      <button
        onClick={() => send({ type: 'next_round' })}
        className="mt-5 rounded-2xl bg-white px-5 py-3 font-semibold text-ink"
      >
        {last ? 'Ver resultados' : 'Siguiente ronda'}
      </button>
    </motion.div>
  )
}

function Final({ game, send, colorOf }) {
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.scores)}</h1>
      <div className="mt-4"><Scores game={game} colorOf={colorOf} /></div>
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <motion.li
            key={h.round}
            className="flex flex-wrap items-baseline gap-x-3 rounded-2xl bg-paper px-4 py-3"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.1 * h.round }}
          >
            <span className="w-5 text-sm text-muted tabular-nums">{h.round}</span>
            <span className="font-semibold">{h.category}</span>
            <span className="text-sm text-muted">
              {h.result.type === 'completed'
                ? `¡Completaron las ${h.letters} letras!`
                : <>{h.letters} letras · perdió <span style={{ color: colorOf(h.result.loser) }}>{h.result.loser}</span></>}
            </span>
          </motion.li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'toolate', ...game.options }} />
    </div>
  )
}
