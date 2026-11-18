/**
 * Color de memoria: the color floods the screen to memorize it; guessing and
 * the reveal happen on a 3D workbench with paint cans.
 */
import { useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, Confetti, softSpring, spring } from '../lib/motion'
import { CONFETTI_COLORS } from '../components/EndActions'
import ColorSliders from '../components/ColorSliders'
import TimerBar from '../components/TimerBar'
import { useCountdown } from '../hooks/useCountdown'
import { hsbToCss, inkFor } from '../lib/color'
import Stage3D from '../components/stage/Stage3D'
import { Panel, Plates, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/color3d.js')

export default function ColorGame({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)

  if (game.phase === 'memorize') return <Memorize game={game} left={left} />
  if (game.phase === 'distract') return <Distract game={game} />
  if (game.phase === 'guess') {
    return <Guess key={game.round} game={game} me={me} send={send} left={left} msLeft={room.phaseEndsInMs} colorOf={colorOf} />
  }
  return <Reveal game={game} me={me} send={send} colorOf={colorOf} />
}

function RoundLabel({ game }) {
  return (
    <span>
      Ronda {game.round} de {game.totalRounds}
      {game.level !== 'normal' && <> · Nivel {game.levelLabel}</>}
    </span>
  )
}

// Expert: another color overwrites the memory of the first one
function Distract({ game }) {
  return (
    <div
      className="flood fixed inset-0 z-20 flex flex-col items-center justify-center gap-3 p-6 text-center"
      style={{ background: hsbToCss(game.distractor), color: inkFor(game.distractor) }}
      role="status"
      aria-live="polite"
    >
      <h1 className="text-4xl font-extrabold sm:text-6xl">Este no es</h1>
      <p className="text-lg font-semibold">No dejes que te confunda</p>
    </div>
  )
}

function Memorize({ game, left }) {
  const ink = inkFor(game.target)
  return (
    <div
      className="flood fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ background: hsbToCss(game.target), color: ink }}
      role="status"
      aria-live="polite"
    >
      <p className="text-lg font-semibold"><RoundLabel game={game} /></p>
      <h1 className="text-4xl font-extrabold sm:text-6xl">Memoriza este color</h1>
      <motion.p
        key={left ?? game.memorizeSeconds}
        className="font-display text-8xl font-extrabold tabular-nums"
        aria-label={`${left ?? ''} segundos`}
        initial={{ scale: 1.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring}
      >
        {left ?? game.memorizeSeconds}
      </motion.p>
    </div>
  )
}

/** The 3D workbench shared by guessing and the reveal. */
function Bench({ game, state, top, bottom, aside }) {
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#F4EFE8, #DCD0C2)"
      stage={<Stage3D ref={stageRef} load={load} state={state} label="Latas de pintura en 3D" />}
      top={top}
      bottom={bottom}
      aside={
        <>
          {aside}
          <Panel title="Cómo se juega">
            <ul className="space-y-1 px-1 text-sm text-muted">
              <li>Memoriza el color que llena la pantalla.</li>
              <li>Después, arma el más parecido con los tres deslizadores.</li>
              <li>Mientras más cerca, más puntos (hasta 10 por ronda).</li>
            </ul>
            <p className="mt-2 px-1 text-xs text-muted"><RoundLabel game={game} /></p>
          </Panel>
        </>
      }
    />
  )
}

function plates(game, me, colorOf) {
  return Object.keys(game.totals).map((p) => ({ name: p, you: p === me, color: colorOf(p), value: Math.round(game.totals[p]), max: 0, stats: `Ronda ${game.round} de ${game.totalRounds}`, active: true }))
}

function Guess({ game, me, send, left, msLeft, colorOf }) {
  // Random starting point so no color is favored
  const [color, setColor] = useState(() => ({
    h: Math.floor(Math.random() * 360),
    s: 30 + Math.floor(Math.random() * 40),
    b: 50 + Math.floor(Math.random() * 30),
  }))
  const sent = game.submitted.includes(me)
  const others = Object.keys(game.totals).filter((p) => p !== me)
  const ring = useMemo(() => cssColor(colorOf(me)), [colorOf, me])
  const state = useMemo(() => ({ phase: 'guess', round: game.round, mine: cssColor(hsbToCss(color)), sent, ring }), [game.round, color, sent, ring])

  return (
    <Bench
      game={game}
      state={state}
      top={
        <>
          <Plates players={plates(game, me, colorOf)} />
          <div className="w-24 shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur">
            <p className="font-display text-xl font-extrabold tabular-nums leading-tight">{left ?? game.guessSeconds} s</p>
            <div className="mt-1"><TimerBar seconds={game.guessSeconds} resetKey={game.round} msLeft={msLeft} /></div>
          </div>
        </>
      }
      bottom={
        <div className="pointer-events-auto w-full max-w-lg rounded-[2rem] bg-paper/95 p-4 shadow-xl backdrop-blur sm:p-5">
          <h1 className="text-xl font-bold sm:text-2xl">{sent ? 'Color enviado' : '¿Cómo era el color?'}</h1>
          <p className="text-sm text-muted">{sent ? 'Ya no puedes cambiarlo.' : 'Muévete por los tres deslizadores hasta que se parezca.'}</p>
          <div className="mt-3">
            <ColorSliders value={color} onChange={setColor} disabled={sent} hints={game.hints} />
          </div>
          <button
            onClick={() => send({ type: 'color_guess', color })}
            disabled={sent}
            className="mt-4 w-full rounded-2xl px-5 py-3.5 text-lg font-semibold text-white disabled:opacity-50"
            style={{ background: colorOf(me) }}
          >
            {sent ? 'Enviado' : 'Enviar mi color'}
          </button>
        </div>
      }
      aside={
        others.length > 0 && (
          <Panel title="Tu pareja">
            <ul className="space-y-1 px-1 text-sm">
              {others.map((p) => (
                <motion.li key={`${p}-${game.submitted.includes(p)}`} style={{ color: colorOf(p) }} className="font-semibold" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
                  {game.submitted.includes(p) ? `✓ ${p} ya envió su color` : `${p} está eligiendo…`}
                </motion.li>
              ))}
            </ul>
          </Panel>
        )
      }
    />
  )
}

function Reveal({ game, me, send, colorOf }) {
  const players = Object.keys(game.totals)
  const finished = game.phase === 'finished'
  const ranking = [...players].sort((a, b) => game.totals[b] - game.totals[a])
  const tie = players.length > 1 && game.totals[ranking[0]] === game.totals[ranking[1]]
  const state = useMemo(
    () => ({
      phase: 'reveal',
      round: game.round,
      target: cssColor(hsbToCss(game.target)),
      guesses: players.map((p) => ({ name: p, color: game.guesses[p] ? cssColor(hsbToCss(game.guesses[p])) : null, ring: cssColor(colorOf(p)) })),
    }),
    [game.round, game.target, game.guesses, players.join(','), colorOf], // eslint-disable-line react-hooks/exhaustive-deps
  )

  return (
    <Bench
      game={game}
      state={state}
      top={<Plates players={plates(game, me, colorOf)} />}
      bottom={
        <div className="pointer-events-auto w-full max-w-xl rounded-[2rem] bg-paper/95 p-4 shadow-xl backdrop-blur sm:p-5">
          {finished && <Confetti colors={CONFETTI_COLORS} />}
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 shrink-0 rounded-2xl shadow-inner" style={{ background: hsbToCss(game.target) }} title="El color era este" />
            <p className="font-display text-xl font-extrabold sm:text-2xl">
              {finished ? (players.length < 2 ? `Terminaste con ${game.totals[ranking[0]].toFixed(1)} puntos` : tie ? 'Empate perfecto' : `Ganó ${ranking[0]}`) : 'El color era este'}
            </p>
          </div>
          <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
            {players.map((p, i) => (
              <motion.div key={p} className="flex items-center gap-2 rounded-2xl bg-stone p-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...softSpring, delay: 0.5 + i * 0.45 }}>
                <span className="h-9 w-9 shrink-0 rounded-xl border border-line" style={game.guesses[p] ? { background: hsbToCss(game.guesses[p]) } : undefined} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold" style={{ color: colorOf(p) }}>{p}</span>
                  <span className="font-display text-2xl font-extrabold tabular-nums">
                    <AnimatedNumber key={game.round} value={game.roundScores[p] ?? 0} from={0} decimals={1} duration={1} />
                  </span>
                  <span className="text-xs text-muted"> /10</span>
                </span>
              </motion.div>
            ))}
          </div>
          {finished ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={() => send({ type: 'start_game', game: 'color', ...game.options })} className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
                Jugar otra vez
              </button>
              <button onClick={() => send({ type: 'back_to_lobby' })} className="rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink">
                Volver a los juegos
              </button>
            </div>
          ) : (
            <button onClick={() => send({ type: 'next_round' })} className="mt-4 w-full rounded-2xl bg-ink px-5 py-3.5 text-lg font-semibold text-white">
              Siguiente ronda
            </button>
          )}
        </div>
      }
      aside={
        game.history.length > 0 && (
          <Panel title="Rondas">
            <History game={game} players={players} />
          </Panel>
        )
      }
    />
  )
}

function History({ game, players }) {
  return (
    <ol className="space-y-2" aria-label="Resumen de rondas">
      {game.history.map((r) => (
        <motion.li
          key={r.round}
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...softSpring, delay: 0.2 + r.round * 0.05 }}
        >
          <span className="w-6 text-sm text-muted tabular-nums">{r.round}</span>
          <span className="h-8 w-12 rounded-lg" style={{ background: hsbToCss(r.target) }} title="Color real" />
          {players.map((p) => (
            <span key={p} className="flex items-center gap-2">
              <span
                className="h-8 w-8 rounded-lg border border-line"
                style={r.guesses[p] ? { background: hsbToCss(r.guesses[p]) } : undefined}
                title={`Intento de ${p}`}
              />
              <span className="w-10 text-sm tabular-nums">{r.scores[p].toFixed(1)}</span>
            </span>
          ))}
        </motion.li>
      ))}
    </ol>
  )
}
