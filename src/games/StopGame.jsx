/**
 * Stop: while writing, a 3D letter machine with a light per filled box and a
 * red buzzer; the answers are typed in a card over the stage.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TimerBar from '../components/TimerBar'
import { EndActions, winnerTitle } from '../components/EndActions'
import { useCountdown } from '../hooks/useCountdown'
import { storage } from '../lib/api'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import { useRollingLetter } from '../hooks/useRollingLetter'
import Stage3D from '../components/stage/Stage3D'
import { Panel, Plates, StageLayout } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/stop3d.js')

export default function StopGame({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)

  if (game.phase === 'writing' || game.phase === 'stopping') {
    return <Sheet key={`${game.round}-${game.letter}`} room={room} me={me} send={send} left={left} colorOf={colorOf} />
  }
  if (game.phase === 'review') return <Review game={game} send={send} colorOf={colorOf} />
  return <Final game={game} send={send} colorOf={colorOf} />
}

function RoundLabel({ game }) {
  return <span>Ronda {game.round} de {game.totalRounds}</span>
}

/** The letter tile. With `roll`, it spins through random letters like a slot machine before landing. */
function LetterTile({ letter, size = 'lg', roll = false }) {
  const big = size === 'lg'
  const [shown, rolling] = useRollingLetter(letter, roll)
  return (
    <motion.div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-ink font-display font-extrabold text-white ${
        big ? 'h-32 w-32 rounded-[2rem] text-8xl sm:h-40 sm:w-40' : 'h-14 w-14 rounded-2xl text-4xl'
      }`}
      aria-label={`Letra ${letter}`}
      role="img"
      animate={roll && !rolling ? { scale: [1, 1.12, 1], rotate: [0, -4, 0] } : undefined}
      transition={{ duration: 0.4 }}
    >
      <motion.span
        key={shown}
        initial={rolling ? { y: '-60%', opacity: 0.4 } : false}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: rolling ? 0.06 : 0.2 }}
      >
        {shown}
      </motion.span>
    </motion.div>
  )
}

// --- Write ----------------------------------------------------------------
function Sheet({ room, me, send, left, colorOf }) {
  const game = room.game
  const storeKey = `cerquita:stop:${room.code}:${game.round}:${game.letter}`
  const [answers, setAnswers] = useState(() => {
    try {
      return JSON.parse(storage.get(storeKey)) || {}
    } catch {
      return {}
    }
  })
  const latest = useRef(answers)
  const debounce = useRef(null)
  const playing = me in game.filled
  const locked = game.phase !== 'writing' || !playing
  const complete = game.categories.every((c) => (answers[c.key] || '').trim())

  // If the page was reloaded, the saved draft goes back to the server.
  useEffect(() => {
    if (playing && Object.keys(latest.current).length) send({ type: 'stop_answers', answers: latest.current })
    return () => clearTimeout(debounce.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Someone called Stop: send whatever I last typed right away.
  useEffect(() => {
    if (game.phase === 'stopping' && playing) {
      clearTimeout(debounce.current)
      send({ type: 'stop_answers', answers: latest.current })
    }
  }, [game.phase]) // eslint-disable-line react-hooks/exhaustive-deps

  function update(key, value) {
    const next = { ...latest.current, [key]: value }
    latest.current = next
    setAnswers(next)
    storage.set(storeKey, JSON.stringify(next))
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => send({ type: 'stop_answers', answers: next }), 400)
  }

  function callStop(e) {
    e.preventDefault()
    if (!complete || locked) return
    clearTimeout(debounce.current)
    send({ type: 'stop_call', answers: latest.current })
  }

  const stageRef = useRef(null)
  const callRef = useRef(null)
  callRef.current = () => {
    if (!complete || locked) return
    clearTimeout(debounce.current)
    send({ type: 'stop_call', answers: latest.current })
  }
  const onPick = useCallback(({ kind }) => kind === 'stop' && callRef.current(), [])
  const colors = useMemo(() => Object.fromEntries(Object.keys(game.filled).map((p) => [p, cssColor(colorOf(p))])), [game.filled, colorOf])
  const filled = useMemo(() => ({ ...game.filled, ...(playing ? { [me]: game.categories.filter((c) => (answers[c.key] || '').trim()).length } : {}) }), [game.filled, playing, me, game.categories, answers])
  const state = useMemo(
    () => ({ letter: game.letter, round: game.round, filled, total: game.categories.length, colors, canStop: playing && complete && !locked, stopped: game.phase === 'stopping' }),
    [game.letter, game.round, filled, game.categories.length, colors, playing, complete, locked, game.phase],
  )
  const plates = Object.keys(game.filled).map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: filled[p],
    max: game.categories.length,
    stats: `Ronda ${game.round} de ${game.totalRounds}`,
    active: game.phase === 'writing',
  }))

  const form = (
          <form onSubmit={callStop} className="pointer-events-auto max-h-[52dvh] w-full overflow-y-auto rounded-[2rem] bg-paper/95 p-4 shadow-xl backdrop-blur sm:p-5 lg:max-h-none lg:shadow-none">
            <h1 className="text-xl font-bold sm:text-2xl">Todo con {game.letter}</h1>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
              {game.categories.map((c) => (
                <label key={c.key} className="block min-w-0">
                  <span className="text-xs font-semibold sm:text-sm">{c.label}</span>
                  <input
                    value={answers[c.key] || ''}
                    onChange={(e) => update(c.key, e.target.value)}
                    disabled={locked}
                    maxLength={40}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder={`${c.label}…`}
                    className="mt-0.5 w-full min-w-0 rounded-xl border border-line bg-white px-3 py-2 outline-none focus:border-ink disabled:opacity-60"
                  />
                </label>
              ))}
            </div>
            {playing && (
              <button
                type="submit"
                disabled={!complete || locked}
                className="mt-3 w-full rounded-2xl px-5 py-3 font-display text-2xl font-extrabold text-white disabled:opacity-40"
                style={{ background: colorOf(me) }}
              >
                ¡Stop!
              </button>
            )}
            <p className="mt-1.5 text-xs text-muted sm:text-sm">
              {!playing
                ? 'Esta ronda empezó antes de que entraras. Juegas desde la próxima partida.'
                : complete
                  ? 'Listo. Cántalo antes que tu pareja (o aprieta el botón rojo).'
                  : 'Llena todas las casillas para poder cantar ¡Stop!'}
            </p>
          </form>
  )

  return (
    <>
      {game.phase === 'stopping' && <StopFlash game={game} me={me} colorOf={colorOf} />}
      <StageLayout
        stageRef={stageRef}
        sky="linear-gradient(#F6EDE3, #E2CDB8)"
        stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Máquina de letras en 3D" />}
        top={
          <>
            <Plates players={plates} />
            <div className="w-24 shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur">
              <p className="font-display text-xl font-extrabold tabular-nums leading-tight">{game.phase === 'writing' ? `${left ?? game.writeSeconds} s` : '¡Stop!'}</p>
              <div className="mt-1"><TimerBar seconds={game.writeSeconds} resetKey={game.round} msLeft={room.phaseEndsInMs} /></div>
            </div>
          </>
        }
        bottom={<div className="w-full max-w-2xl lg:hidden">{form}</div>}
        aside={
          <>
          <div className="hidden lg:block">{form}</div>
          <Panel title="Cómo se juega">
            <ul className="space-y-1 px-1 text-sm text-muted">
              <li>Sale una letra: llenen cada categoría con una palabra que empiece por ella.</li>
              <li>El primero que llene todo canta ¡Stop! y se acaba la ronda.</li>
              <li>Respuesta única: {game.points?.unique ?? 100} · repetida: {game.points?.shared ?? 50}.</li>
            </ul>
          </Panel>
          </>
        }
      />
    </>
  )
}

function StopFlash({ game, me, colorOf }) {
  const who = game.stoppedBy
  return (
    <div
      className="flood fixed inset-0 z-20 flex flex-col items-center justify-center gap-2 p-6 text-center text-white"
      style={{ background: who ? colorOf(who) : 'var(--color-ink)' }}
      role="status"
      aria-live="assertive"
    >
      <motion.p
        className="font-display text-8xl font-extrabold sm:text-9xl"
        initial={{ scale: 2.6, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: -4, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 18 }}
      >
        ¡Stop!
      </motion.p>
      <motion.p className="text-xl font-semibold" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        {who ? (who === me ? 'Lo cantaste tú' : `Lo cantó ${who}`) : 'Se acabó el tiempo'}
      </motion.p>
    </div>
  )
}

// --- Review ---------------------------------------------------------------
function Review({ game, send, colorOf }) {
  const players = Object.keys(game.results)
  const last = game.round >= game.totalRounds
  const liveRow = { round: game.round, letter: game.letter, answers: game.results, totals: game.roundTotals, live: true }

  return (
    <div className="mt-4">
      <div className="text-muted"><RoundLabel game={game} /></div>
      <div className="mt-3 flex items-center gap-4">
        <LetterTile letter={game.letter} size="sm" />
        <div>
          <h1 className="text-3xl font-bold">Revisen las respuestas</h1>
          <p className="text-muted">
            Toquen una respuesta para anularla o darla por buena. {game.points.unique} si es única,{' '}
            {game.points.shared} si repiten, 0 si está vacía o no vale.
            {game.spellChecked.length > 0 && ' Se revisó la ortografía de todo menos nombre y apellido.'}
          </p>
        </div>
      </div>

      <section
        className="mt-6 grid gap-x-3 gap-y-2 rounded-[2rem] bg-paper p-4 sm:p-6"
        style={{ gridTemplateColumns: `minmax(4.5rem, auto) repeat(${players.length}, minmax(0, 1fr))` }}
      >
        <span />
        {players.map((p) => (
          <span key={p} className="truncate font-semibold" style={{ color: colorOf(p) }}>{p}</span>
        ))}

        {game.categories.map((c, row) => (
          <Row key={c.key} label={c.label}>
            {players.map((p, col) => (
              <AnswerCell
                key={p}
                delay={0.08 * row + 0.04 * col}
                cell={game.results[p][c.key]}
                letter={game.letter}
                isCity={c.key === 'city'}
                color={colorOf(p)}
                onToggle={() => send({ type: 'stop_toggle', player: p, category: c.key })}
              />
            ))}
          </Row>
        ))}

        <span className="self-center border-t border-line pt-3 font-semibold">Total</span>
        {players.map((p) => (
          <span key={p} className="border-t border-line pt-3 font-display text-4xl font-extrabold tabular-nums">
            <AnimatedNumber value={game.roundTotals[p]} from={0} duration={0.9} />
          </span>
        ))}
      </section>

      <button
        onClick={() => send({ type: 'next_round' })}
        className="mt-6 w-full rounded-2xl bg-ink px-5 py-4 text-lg font-semibold text-white sm:w-auto"
      >
        {last ? 'Ver resultados' : 'Siguiente letra'}
      </button>

      <Sheets game={game} rows={[...game.sheets, liveRow]} colorOf={colorOf} />
    </div>
  )
}

function Row({ label, children }) {
  return (
    <>
      <span className="self-center text-sm font-semibold text-muted">{label}</span>
      {children}
    </>
  )
}

function issueNote(cell, letter, isCity) {
  if (cell.valid) return cell.overridden ? 'aceptada por ustedes' : null
  if (cell.overridden) return 'anulada por ustedes'
  if (cell.issue === 'letter') return `no empieza por ${letter}`
  if (cell.issue === 'spelling') {
    if (cell.suggestion) return `¿Quisiste decir «${cell.suggestion}»?`
    return isCity ? 'no encontramos esa ciudad' : 'no está en el diccionario'
  }
  return null
}

function AnswerCell({ cell, letter, isCity, color, onToggle, delay = 0 }) {
  const enter = { initial: { opacity: 0, y: 10, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { ...softSpring, delay } }
  if (!cell.answer) {
    return <motion.span {...enter} className="flex items-center rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted">Vacía</motion.span>
  }
  const note = issueNote(cell, letter, isCity)
  return (
    <motion.button
      {...enter}
      onClick={onToggle}
      aria-pressed={!cell.valid}
      aria-label={`${cell.answer}: ${cell.valid ? 'vale' : 'no vale'}${note ? `, ${note}` : ''}. Tocar para cambiar`}
      className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl border px-3 py-2.5 text-left"
      style={{ borderColor: cell.valid ? color : 'var(--color-line)' }}
    >
      <span className={`break-words ${cell.valid ? '' : 'text-muted line-through'}`}>{cell.answer}</span>
      <motion.span
        key={cell.points}
        className="ml-auto rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums"
        style={cell.points ? { background: color, color: 'white' } : { color: 'var(--color-muted)' }}
        initial={{ scale: 0.4 }}
        animate={{ scale: 1 }}
        transition={spring}
      >
        {cell.points}
      </motion.span>
      {note && (
        <span className={`basis-full text-xs ${cell.issue === 'spelling' && !cell.valid ? 'font-medium text-danger' : 'text-muted'}`}>
          {note}
        </span>
      )}
    </motion.button>
  )
}

// --- Sheets: one row per letter with its total, like on paper -------------
function Sheets({ game, rows, colorOf }) {
  const players = Object.keys(game.totals)
  if (!rows.length) return null
  return (
    <section className="mt-10">
      <h2 className="text-2xl font-bold">Hojas</h2>
      <div className="mt-4 space-y-6">
        {players.map((p) => {
          const total = rows.reduce((sum, r) => sum + (r.totals[p] ?? 0), 0)
          return (
            <div key={p} className="rounded-[2rem] bg-paper p-4 sm:p-6">
              <h3 className="font-bold" style={{ color: colorOf(p) }}>{p}</h3>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="text-muted">
                      <th className="py-2 pr-3 font-semibold">Letra</th>
                      {game.categories.map((c) => <th key={c.key} className="py-2 pr-3 font-semibold">{c.label}</th>)}
                      <th className="sticky right-0 bg-paper py-2 pl-3 text-right font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.round} className="border-t border-line">
                        <td className="py-2 pr-3 font-display text-xl font-extrabold">
                          {r.letter}
                          {r.live && <span className="block font-sans text-xs font-normal text-muted">en revisión</span>}
                        </td>
                        {game.categories.map((c) => {
                          const cell = r.answers[p]?.[c.key]
                          return (
                            <td key={c.key} className="py-2 pr-3 align-top">
                              <span className={`block truncate ${cell?.valid ? '' : 'text-muted line-through'}`}>
                                {cell?.answer || '—'}
                              </span>
                              <span className="text-xs text-muted tabular-nums">{cell?.points ?? 0}</span>
                            </td>
                          )
                        })}
                        <td className="sticky right-0 bg-paper py-2 pl-3 text-right font-bold tabular-nums">{r.totals[p] ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-ink">
                      <td colSpan={game.categories.length + 1} className="py-2 font-semibold">Total general</td>
                      <td className="sticky right-0 bg-paper py-2 pl-3 text-right font-display text-2xl font-extrabold tabular-nums">{total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// --- End ------------------------------------------------------------------
function Final({ game, send, colorOf }) {
  const players = Object.keys(game.totals)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.totals)}</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        {players.map((p) => (
          <div key={p} className="rounded-2xl bg-paper px-5 py-3">
            <p className="font-semibold" style={{ color: colorOf(p) }}>{p}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums"><AnimatedNumber value={game.totals[p]} from={0} duration={1.2} /></p>
          </div>
        ))}
      </div>
      <EndActions send={send} replay={{ type: 'start_game', game: 'stop', ...game.options }} />
      <Sheets game={game} rows={game.sheets} colorOf={colorOf} />
    </div>
  )
}
