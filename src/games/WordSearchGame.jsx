/**
 * Word search on the 3D stage: drag across the sheet (or tap both ends).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import { EndActions, winnerTitle } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Flash, Panel, Plates, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/wordsearch3d.js')

export default function WordSearchGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} error={error} errorId={errorId} />
}
WordSearchGame.showsErrors = true

function clock(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Elapsed time, counting from what the server said. */
function useElapsed(game) {
  const [now, setNow] = useState(() => Date.now())
  const base = useRef({ ms: game.elapsedMs, at: Date.now() })
  useEffect(() => {
    base.current = { ms: game.elapsedMs, at: Date.now() }
  }, [game.elapsedMs])
  useEffect(() => {
    if (game.phase !== 'playing') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [game.phase])
  return game.phase === 'playing' ? base.current.ms + (now - base.current.at) : game.elapsedMs
}

function Play({ game, me, send, colorOf, error, errorId }) {
  const elapsed = useElapsed(game)
  const [flash, setFlash] = useState(null)
  const seen = useRef(errorId)
  const playing = game.phase === 'playing'
  const isPlayer = game.players.includes(me)
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  useEffect(() => {
    if (errorId === seen.current) return
    seen.current = errorId
    if (error) setFlash({ text: error, id: errorId })
  }, [errorId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1600)
    return () => clearTimeout(id)
  }, [flash])

  const onPick = useCallback(
    (ev) => {
      if (ev.kind === 'select') send({ type: 'ws_select', start: ev.start, end: ev.end })
      else if (ev.kind === 'mark') send({ type: 'ws_mark', start: ev.start, end: ev.end })
    },
    [send],
  )
  const colors = useMemo(() => Object.fromEntries(game.players.map((p) => [p, cssColor(colorOf(p))])), [game.players, colorOf])
  const state = useMemo(
    () => ({ grid: game.grid, size: game.size, round: game.round, found: game.found, missing: game.missing, selecting: game.selecting, colors, me, interactive: playing && isPlayer }),
    [game.grid, game.size, game.round, game.found, game.missing, game.selecting, colors, me, playing, isPlayer],
  )

  const foundCount = Object.keys(game.found).length
  const plates = game.mode === 'race'
    ? game.players.map((p) => ({
        name: p,
        you: p === me,
        color: colorOf(p),
        value: Object.values(game.found).filter((f) => f.player === p).length,
        max: game.words.length,
        stats: `Total: ${game.scores[p] ?? 0}`,
        active: playing,
      }))
    : [{ name: 'Juntos', color: colorOf(me), value: foundCount, max: game.words.length, stats: `${foundCount} de ${game.words.length} palabras`, active: playing }]

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#EEEAE2, #D6CFC2)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Sopa de letras en 3D" />}
      top={
        <>
          <Plates players={plates} />
          <div className="shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur">
            <p className="font-display text-xl font-extrabold tabular-nums leading-tight">{clock(elapsed)}</p>
            <p className="text-xs font-semibold text-muted">Ronda {game.round}/{game.totalRounds} · {game.levelLabel}</p>
          </div>
        </>
      }
      bottom={
        game.phase === 'round_over' ? (
          <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
        ) : (
          <>
            <Flash flash={flash} />
            <WordChips game={game} colorOf={colorOf} />
          </>
        )
      }
      aside={
        <>
          <Panel title={game.theme} right={<span className="text-xs font-semibold text-muted">{foundCount} de {game.words.length}</span>}>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 px-1">
              {game.words.map((w) => {
                const f = game.found[w]
                const missed = !f && game.phase === 'round_over'
                return (
                  <li key={w} className="flex items-center gap-2">
                    <motion.span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      initial={false}
                      animate={{ background: f ? colorOf(f.player) : missed ? 'var(--color-muted)' : 'var(--color-line)', scale: f ? [1, 2, 1] : 1 }}
                      transition={{ duration: 0.4 }}
                    />
                    <span className={`font-display font-bold uppercase tracking-wide ${f ? 'text-muted line-through' : missed ? 'text-danger' : ''}`}>{w}</span>
                  </li>
                )
              })}
            </ul>
          </Panel>
          {playing && isPlayer && (
            <Panel title="Cómo se juega">
              <p className="px-1 text-sm text-muted">Arrastra desde la primera letra hasta la última, o toca las dos puntas.</p>
              <button onClick={() => send({ type: 'ws_give_up' })} className="mt-3 px-1 text-sm font-semibold text-muted underline underline-offset-2 hover:text-ink">
                Rendirse y ver la solución
              </button>
            </Panel>
          )}
        </>
      }
    />
  )
}

/** The words still to find, as chips over the bottom of the stage. */
function WordChips({ game, colorOf }) {
  return (
    <ul className="flex max-w-full flex-wrap justify-center gap-1.5">
      {game.words.map((w) => {
        const f = game.found[w]
        return (
          <motion.li
            key={w}
            layout
            className={`rounded-full px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wide shadow-sm backdrop-blur sm:text-sm ${f ? 'text-white' : 'bg-paper/90'}`}
            style={f ? { background: colorOf(f.player) } : undefined}
            animate={{ scale: f ? [1, 1.25, 1] : 1, opacity: f ? 0.75 : 1 }}
            transition={{ duration: 0.4 }}
          >
            {f ? <s>{w}</s> : w}
          </motion.li>
        )
      })}
    </ul>
  )
}

function RoundOver({ game, me, send, colorOf }) {
  const last = game.round >= game.totalRounds
  const total = game.words.length
  const found = Object.keys(game.found).length
  const time = clock(game.elapsedMs)
  let title
  let detail
  let accent = 'var(--color-ink)'
  if (game.gaveUp) {
    title = 'Se rindieron'
    detail = `Encontraron ${found} de ${total}. Las que faltaban quedaron marcadas en gris.`
  } else if (game.mode === 'team') {
    title = `¡Las encontraron todas en ${time}!`
    detail = 'Buen trabajo en equipo.'
    accent = 'var(--color-p1)'
  } else {
    const counts = Object.fromEntries(game.players.map((p) => [p, Object.values(game.found).filter((f) => f.player === p).length]))
    const ranking = [...game.players].sort((a, b) => counts[b] - counts[a])
    const tie = ranking.length > 1 && counts[ranking[0]] === counts[ranking[1]]
    title = tie ? 'Empate en esta sopa' : ranking[0] === me ? '¡Ganaste esta sopa!' : `${ranking[0]} ganó esta sopa`
    detail = game.players.map((p) => `${p}: ${counts[p]}`).join(' · ') + ` · en ${time}`
    if (!tie) accent = colorOf(ranking[0])
  }
  return (
    <div className="pop pointer-events-auto w-full max-w-lg rounded-[2rem] p-6 text-white shadow-xl" style={{ background: accent }}>
      <p className="font-display text-3xl font-extrabold">{title}</p>
      <p className="mt-1 text-white/85">{detail}</p>
      <button onClick={() => send({ type: 'next_round' })} className="mt-5 rounded-2xl bg-white px-5 py-3 font-semibold text-ink">
        {last ? 'Ver resultados' : 'Otra sopa'}
      </button>
    </div>
  )
}

function Final({ game, me, send, colorOf }) {
  const team = game.mode === 'team'
  const totalSeconds = game.history.reduce((s, h) => s + h.seconds, 0)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">
        {team ? `Tiempo total: ${clock(totalSeconds * 1000)}` : winnerTitle(game.scores, 'palabras')}
      </h1>
      {!team && (
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(game.scores).map(([p, n]) => (
            <div key={p} className="rounded-2xl bg-paper px-5 py-3">
              <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
              <p className="font-display text-4xl font-extrabold"><AnimatedNumber value={n} from={0} duration={1} /></p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <motion.li
            key={h.round}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-paper px-4 py-3"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.1 * h.round }}
          >
            <span className="w-5 text-sm text-muted tabular-nums">{h.round}</span>
            <span className="font-semibold">{h.theme}</span>
            <span className="text-sm text-muted">
              {h.found} de {h.total} · {clock(h.seconds * 1000)}
              {h.gaveUp && ' · se rindieron'}
            </span>
            {!team && (
              <span className="ml-auto flex gap-3 text-sm">
                {Object.entries(h.byPlayer).map(([p, n]) => (
                  <span key={p}>
                    <span style={{ color: colorOf(p) }}>{p}</span> {n}
                  </span>
                ))}
              </span>
            )}
          </motion.li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'wordsearch', ...game.options }} />
    </div>
  )
}
