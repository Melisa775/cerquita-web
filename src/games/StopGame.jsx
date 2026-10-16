import { useEffect, useRef, useState } from 'react'
import TimerBar from '../components/TimerBar'
import { EndActions, winnerTitle } from '../components/EndActions'
import { useCountdown } from '../hooks/useCountdown'
import { storage } from '../lib/api'

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

function LetterTile({ letter, size = 'lg' }) {
  const big = size === 'lg'
  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-ink font-display font-extrabold text-white ${
        big ? 'h-32 w-32 rounded-[2rem] text-8xl sm:h-40 sm:w-40' : 'h-14 w-14 rounded-2xl text-4xl'
      }`}
      aria-label={`Letra ${letter}`}
      role="img"
    >
      {letter}
    </div>
  )
}

// --- Escribir -------------------------------------------------------------
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

  // Si se recargó la página, el borrador guardado vuelve al servidor.
  useEffect(() => {
    if (playing && Object.keys(latest.current).length) send({ type: 'stop_answers', answers: latest.current })
    return () => clearTimeout(debounce.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Alguien cantó Stop: se envía ya mismo lo último que escribí.
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

  const others = Object.keys(game.filled).filter((p) => p !== me)

  return (
    <div className="mt-4">
      {game.phase === 'stopping' && <StopFlash game={game} me={me} colorOf={colorOf} />}

      <div className="flex items-baseline justify-between text-muted">
        <RoundLabel game={game} />
        <span className="tabular-nums">{game.phase === 'writing' ? `${left ?? game.writeSeconds} s` : '¡Stop!'}</span>
      </div>
      <TimerBar seconds={game.writeSeconds} resetKey={game.round} msLeft={room.phaseEndsInMs} />

      <div className="mt-6 grid gap-6 md:grid-cols-[auto_1fr] md:items-start">
        <div className="flex items-center gap-5 md:flex-col md:items-start">
          <LetterTile letter={game.letter} />
          <ul className="space-y-2 text-sm">
            {others.map((p) => (
              <li key={p}>
                <span className="font-semibold" style={{ color: colorOf(p) }}>{p}</span>
                <span className="text-muted"> lleva {game.filled[p]} de {game.categories.length}</span>
                <Dots filled={game.filled[p]} total={game.categories.length} color={colorOf(p)} />
              </li>
            ))}
          </ul>
        </div>

        <form onSubmit={callStop}>
          <h1 className="text-3xl font-bold">Todo con {game.letter}</h1>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {game.categories.map((c) => (
              <label key={c.key} className="block">
                <span className="text-sm font-semibold">{c.label}</span>
                <input
                  value={answers[c.key] || ''}
                  onChange={(e) => update(c.key, e.target.value)}
                  disabled={locked}
                  maxLength={40}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder={`${c.label} con ${game.letter}…`}
                  className="mt-1 w-full rounded-2xl border border-line bg-paper px-4 py-3 text-lg outline-none focus:border-ink disabled:opacity-60"
                />
              </label>
            ))}
          </div>
          {playing && (
            <button
              type="submit"
              disabled={!complete || locked}
              className="mt-5 w-full rounded-2xl px-5 py-4 font-display text-2xl font-extrabold text-white disabled:opacity-40"
              style={{ background: colorOf(me) }}
            >
              ¡Stop!
            </button>
          )}
          <p className="mt-2 text-sm text-muted">
            {!playing
              ? 'Esta ronda empezó antes de que entraras. Juegas desde la próxima partida.'
              : complete
                ? 'Listo. Cántalo antes que tu pareja.'
                : 'Llena todas las casillas para poder cantar ¡Stop!'}
          </p>
        </form>
      </div>
    </div>
  )
}

function Dots({ filled, total, color }) {
  return (
    <span className="mt-1 flex gap-1" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2 w-4 rounded-full"
          style={{ background: i < filled ? color : 'var(--color-line)' }}
        />
      ))}
    </span>
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
      <p className="font-display text-8xl font-extrabold sm:text-9xl">¡Stop!</p>
      <p className="text-xl font-semibold">
        {who ? (who === me ? 'Lo cantaste tú' : `Lo cantó ${who}`) : 'Se acabó el tiempo'}
      </p>
    </div>
  )
}

// --- Revisar --------------------------------------------------------------
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

        {game.categories.map((c) => (
          <Row key={c.key} label={c.label}>
            {players.map((p) => (
              <AnswerCell
                key={p}
                cell={game.results[p][c.key]}
                color={colorOf(p)}
                onToggle={() => send({ type: 'stop_toggle', player: p, category: c.key })}
              />
            ))}
          </Row>
        ))}

        <span className="self-center border-t border-line pt-3 font-semibold">Total</span>
        {players.map((p) => (
          <span key={p} className="border-t border-line pt-3 font-display text-4xl font-extrabold tabular-nums">
            {game.roundTotals[p]}
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

function AnswerCell({ cell, color, onToggle }) {
  if (!cell.answer) {
    return <span className="flex items-center rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-muted">Vacía</span>
  }
  return (
    <button
      onClick={onToggle}
      aria-pressed={!cell.valid}
      aria-label={`${cell.answer}: ${cell.valid ? 'vale' : 'no vale'}. Tocar para cambiar`}
      className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-xl border px-3 py-2.5 text-left"
      style={{ borderColor: cell.valid ? color : 'var(--color-line)' }}
    >
      <span className={`break-words ${cell.valid ? '' : 'text-muted line-through'}`}>{cell.answer}</span>
      <span className="ml-auto flex items-center gap-1.5">
        {cell.overridden && <span className="text-xs text-muted">corregida</span>}
        <span
          className="rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums"
          style={cell.points ? { background: color, color: 'white' } : { color: 'var(--color-muted)' }}
        >
          {cell.points}
        </span>
      </span>
    </button>
  )
}

// --- Hojas: una fila por letra con su total, como en papel ----------------
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

// --- Final ----------------------------------------------------------------
function Final({ game, send, colorOf }) {
  const players = Object.keys(game.totals)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.totals)}</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        {players.map((p) => (
          <div key={p} className="rounded-2xl bg-paper px-5 py-3">
            <p className="font-semibold" style={{ color: colorOf(p) }}>{p}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{game.totals[p]}</p>
          </div>
        ))}
      </div>
      <EndActions send={send} replay={{ type: 'start_game', game: 'stop', ...game.options }} />
      <Sheets game={game} rows={game.sheets} colorOf={colorOf} />
    </div>
  )
}
