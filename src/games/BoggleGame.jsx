import { useEffect, useMemo, useRef, useState } from 'react'
import TimerBar from '../components/TimerBar'
import { EndActions, winnerTitle } from '../components/EndActions'
import { useCountdown } from '../hooks/useCountdown'
import { areNeighbors, cleanWord, findPath, pointsFor, wordFromPath } from '../lib/boggle'

export default function BoggleGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'playing') return <Play key={game.round} room={room} me={me} send={send} colorOf={colorOf} />
  if (game.phase === 'review') return <Review game={game} send={send} colorOf={colorOf} />
  return <Final game={game} send={send} colorOf={colorOf} />
}

function RoundLabel({ game }) {
  return <span>Ronda {game.round} de {game.totalRounds}</span>
}

function clock(seconds) {
  if (seconds == null) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// --- Tablero --------------------------------------------------------------
/**
 * Tablero de dados. Se puede arrastrar el dedo por las letras (se envía al
 * soltar) o tocarlas una por una (tocar la última otra vez envía la palabra).
 * La zona sensible de cada dado es un círculo interior para que al moverse
 * en diagonal no se marque un vecino sin querer.
 */
function Board({ game, path = [], color, interactive = false, compact = false, onPath, onSubmit }) {
  const ref = useRef(null)
  const drag = useRef({ active: false, moved: false, submitOnUp: false })
  const live = useRef(path) // el camino más reciente, aunque React aún no haya repintado
  live.current = path
  const size = game.size

  function setPath(p) {
    live.current = p
    onPath(p)
  }

  function hit(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    const idx = el?.closest?.('[data-idx]')?.dataset.idx
    return idx == null ? null : Number(idx)
  }

  function down(e) {
    const idx = hit(e)
    if (idx == null) return
    e.preventDefault()
    ref.current.setPointerCapture?.(e.pointerId)
    const path = live.current
    const last = path.at(-1)
    drag.current = { active: true, moved: false, submitOnUp: false }
    if (idx === last && path.length) drag.current.submitOnUp = true
    else if (path.includes(idx)) setPath(path.slice(0, path.indexOf(idx) + 1))
    else if (path.length && areNeighbors(last, idx, size)) setPath([...path, idx])
    else setPath([idx])
  }

  function move(e) {
    if (!drag.current.active) return
    const idx = hit(e)
    const path = live.current
    const last = path.at(-1)
    if (idx == null || idx === last) return
    if (path.length >= 2 && idx === path.at(-2)) {
      setPath(path.slice(0, -1)) // devolverse arrastrando
      drag.current.moved = true
    } else if (!path.includes(idx) && areNeighbors(last, idx, size)) {
      setPath([...path, idx])
      drag.current.moved = true
      drag.current.submitOnUp = false
    }
  }

  function up() {
    const { active, moved, submitOnUp } = drag.current
    drag.current.active = false
    const path = live.current
    if (active && (moved || submitOnUp) && path.length > 1) onSubmit(path)
  }

  const centers = path.map((i) => [(i % size) + 0.5, Math.floor(i / size) + 0.5])

  return (
    <div
      ref={ref}
      className={`relative grid aspect-square w-full touch-none select-none rounded-[2rem] bg-ink ${
        compact ? 'gap-1.5 p-2.5' : 'gap-2 p-3 sm:gap-3 sm:p-4'
      }`}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      onPointerDown={interactive ? down : undefined}
      onPointerMove={interactive ? move : undefined}
      onPointerUp={interactive ? up : undefined}
      onPointerCancel={interactive ? up : undefined}
      role="group"
      aria-label="Tablero de letras"
    >
      {game.board.map((letter, i) => {
        const on = path.includes(i)
        return (
          <div
            key={i}
            className={`relative flex items-center justify-center rounded-2xl font-display font-extrabold shadow-[0_3px_0_rgb(0_0_0/0.25)] ${
              compact ? 'text-2xl' : size === 4 ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl'
            } ${on ? 'text-white' : 'bg-paper text-ink'} ${interactive ? 'cursor-pointer' : ''}`}
            style={on ? { background: color } : undefined}
          >
            {letter}
            {interactive && <span data-idx={i} className="absolute inset-[16%] rounded-full" aria-hidden="true" />}
          </div>
        )
      })}
      {centers.length > 1 && (
        <svg
          className={`pointer-events-none absolute ${compact ? 'inset-2.5' : 'inset-3 sm:inset-4'}`}
          viewBox={`0 0 ${size} ${size}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polyline
            points={centers.map(([x, y]) => `${x},${y}`).join(' ')}
            fill="none"
            stroke="white"
            strokeOpacity="0.55"
            strokeWidth="0.09"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </div>
  )
}

// --- Jugar ----------------------------------------------------------------
function Play({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)
  const [path, setPath] = useState([])
  const [typed, setTyped] = useState('')
  const [feedback, setFeedback] = useState(null) // { text, good }
  const inputRef = useRef(null)
  const playing = me in game.counts
  const mine = game.mine
  const done = game.done.includes(me)
  const color = colorOf(me)

  const typedWord = cleanWord(typed)
  const typedPath = useMemo(() => (typedWord ? findPath(game.board, game.size, typedWord) : null), [typedWord, game.board, game.size])
  const shownPath = typedWord ? typedPath ?? [] : path
  const current = typedWord || wordFromPath(game.board, path)
  const buildable = typedWord ? !!typedPath : path.length > 0

  useEffect(() => {
    if (window.matchMedia?.('(pointer: fine)').matches) inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!feedback) return
    const id = setTimeout(() => setFeedback(null), 1600)
    return () => clearTimeout(id)
  }, [feedback])

  function submit(word) {
    setPath([])
    setTyped('')
    if (!word) return
    if (word.length < game.minLength) return setFeedback({ text: `Mínimo ${game.minLength} letras`, good: false })
    if (mine.some((m) => m.word === word)) return setFeedback({ text: 'Ya la tienes', good: false })
    if (!findPath(game.board, game.size, word)) return setFeedback({ text: 'No se puede armar en el tablero', good: false })
    send({ type: 'boggle_word', word })
    setFeedback({ text: `+ ${word.toUpperCase()}`, good: true })
  }

  function onTypedSubmit(e) {
    e.preventDefault()
    submit(typedWord || wordFromPath(game.board, path))
  }

  const others = Object.keys(game.counts).filter((p) => p !== me)

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between text-muted">
        <RoundLabel game={game} />
        <span className="font-display text-xl font-bold text-ink tabular-nums">{clock(left ?? game.playSeconds)}</span>
      </div>
      <TimerBar seconds={game.playSeconds} resetKey={game.round} msLeft={room.phaseEndsInMs} />

      <div className="mt-5 grid gap-6 md:grid-cols-[minmax(0,1fr)_17rem] md:items-start">
        <div className="mx-auto w-full max-w-[32rem]">
          <div className="flex h-12 items-center justify-center" aria-live="polite">
            {current ? (
              <span
                className={`font-display text-3xl font-extrabold tracking-wider ${buildable ? '' : 'text-danger line-through'}`}
                style={buildable ? { color } : undefined}
              >
                {current.toUpperCase()}
              </span>
            ) : feedback ? (
              <span className={`text-lg font-semibold ${feedback.good ? '' : 'text-danger'}`} style={feedback.good ? { color } : undefined}>
                {feedback.text}
              </span>
            ) : (
              <span className="text-muted">
                {playing ? 'Arrastra el dedo por letras vecinas o escribe abajo' : 'Esta ronda empezó antes de que entraras'}
              </span>
            )}
          </div>

          <Board
            game={game}
            path={shownPath}
            color={color}
            interactive={playing}
            onPath={(p) => {
              setTyped('')
              setPath(p)
            }}
            onSubmit={(p) => submit(wordFromPath(game.board, p))}
          />

          {playing && (
            <form onSubmit={onTypedSubmit} className="mt-4 flex gap-2">
              <input
                ref={inputRef}
                value={typed}
                onChange={(e) => {
                  setPath([])
                  setTyped(e.target.value)
                }}
                placeholder="O escribe la palabra"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={20}
                className="w-full min-w-0 rounded-2xl border border-line bg-paper px-4 py-3 text-lg outline-none focus:border-ink"
              />
              {(path.length > 0 || typed) && (
                <button
                  type="button"
                  onClick={() => {
                    setPath([])
                    setTyped('')
                  }}
                  className="rounded-2xl border border-line px-4 font-semibold hover:border-ink"
                >
                  Borrar
                </button>
              )}
              <button type="submit" className="rounded-2xl px-5 font-semibold text-white" style={{ background: color }}>
                Enviar
              </button>
            </form>
          )}
        </div>

        <aside>
          <h2 className="text-xl font-bold">
            Tus palabras <span className="text-muted tabular-nums">({mine.length})</span>
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {[...mine].reverse().map((m) => (
              <li
                key={m.word}
                title={m.known ? undefined : 'No está en el diccionario: al final deciden si vale'}
                className={`rounded-xl px-2.5 py-1 text-sm font-semibold ${m.known ? 'bg-paper' : 'border border-dashed border-line text-muted'}`}
              >
                {m.word.toUpperCase()}
                <span className="ml-1.5 text-xs text-muted tabular-nums">{m.known ? pointsFor(m.word) : '?'}</span>
              </li>
            ))}
            {!mine.length && <li className="text-sm text-muted">Todavía ninguna.</li>}
          </ul>

          <ul className="mt-6 space-y-1 text-sm">
            {others.map((p) => (
              <li key={p}>
                <span className="font-semibold" style={{ color: colorOf(p) }}>{p}</span>
                <span className="text-muted">
                  {' '}lleva {game.counts[p]} {game.counts[p] === 1 ? 'palabra' : 'palabras'}
                  {game.done.includes(p) && ' y ya terminó'}
                </span>
              </li>
            ))}
          </ul>

          {playing && (
            <button
              onClick={() => send({ type: 'boggle_done' })}
              disabled={done}
              className="mt-5 w-full rounded-2xl border border-line px-4 py-3 font-semibold hover:border-ink disabled:opacity-60"
            >
              {done ? 'Esperando a tu pareja…' : 'Ya no encuentro más'}
            </button>
          )}
          <p className="mt-4 text-xs text-muted">
            Puntos: 3–4 letras 1 · 5 letras 2 · 6 letras 3 · 7 letras 5 · 8 o más 11. Las palabras que encuentren los dos no cuentan.
          </p>
        </aside>
      </div>
    </div>
  )
}

// --- Revisar --------------------------------------------------------------
const STATUS_NOTE = {
  shared: 'los dos',
  invalid: 'no está en el diccionario',
}

function Review({ game, send, colorOf }) {
  const players = Object.keys(game.results)
  const last = game.round >= game.totalRounds
  const [highlight, setHighlight] = useState(null)
  const path = highlight ? findPath(game.board, game.size, highlight) ?? [] : []

  return (
    <div className="mt-4">
      <div className="text-muted"><RoundLabel game={game} /></div>
      <h1 className="mt-1 text-3xl font-bold">Resultados de la ronda</h1>
      <p className="mt-1 text-muted">
        Las que encontraron los dos se tachan. Toquen una palabra para darla por buena o anularla.
      </p>

      <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
        {players.map((p) => (
          <section key={p} className="rounded-[2rem] bg-paper p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="truncate font-bold" style={{ color: colorOf(p) }}>{p}</h2>
              <span className="font-display text-4xl font-extrabold tabular-nums">{game.roundTotals[p]}</span>
            </div>
            <ul className="mt-3 space-y-1.5">
              {game.results[p].map((item) => (
                <li key={item.word}>
                  <button
                    onClick={() => item.status !== 'shared' && send({ type: 'boggle_toggle', word: item.word })}
                    onMouseEnter={() => setHighlight(item.word)}
                    onFocus={() => setHighlight(item.word)}
                    disabled={item.status === 'shared'}
                    className="flex w-full flex-wrap items-center justify-between gap-x-2 rounded-xl border px-3 py-2 text-left disabled:cursor-default"
                    style={{ borderColor: item.status === 'ok' ? colorOf(p) : 'var(--color-line)' }}
                    aria-label={`${item.word}: ${item.status === 'ok' ? 'vale' : STATUS_NOTE[item.status]}`}
                  >
                    <span className={`font-semibold break-all ${item.status === 'ok' ? '' : 'text-muted line-through'}`}>
                      {item.word.toUpperCase()}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                      {item.status !== 'ok' && STATUS_NOTE[item.status]}
                      {item.overridden && item.status === 'ok' && 'aceptada'}
                      {item.overridden && item.status === 'invalid' && 'anulada'}
                      <span
                        className="rounded-lg px-2 py-0.5 text-sm font-bold tabular-nums"
                        style={item.points ? { background: colorOf(p), color: 'white' } : undefined}
                      >
                        {item.points}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!game.results[p].length && <li className="text-sm text-muted">Sin palabras esta ronda.</li>}
            </ul>
          </section>
        ))}
      </div>

      <button
        onClick={() => send({ type: 'next_round' })}
        className="mt-6 w-full rounded-2xl bg-ink px-5 py-4 text-lg font-semibold text-white sm:w-auto"
      >
        {last ? 'Ver resultados' : 'Siguiente tablero'}
      </button>

      <section className="mt-10 grid gap-6 md:grid-cols-[18rem_1fr] md:items-start">
        <div className="mx-auto w-full max-w-[18rem]">
          <Board game={game} path={path} color="hsl(40 80% 48%)" compact />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Se les escaparon</h2>
          <p className="mt-1 text-muted">
            El tablero tenía {game.possible} palabras. Estas son las más largas que nadie encontró; tóquenlas para ver dónde estaban.
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {game.missed.map((w) => (
              <li key={w}>
                <button
                  onClick={() => setHighlight(w)}
                  onMouseEnter={() => setHighlight(w)}
                  aria-pressed={highlight === w}
                  className={`rounded-xl px-2.5 py-1 text-sm font-semibold ${highlight === w ? 'bg-ink text-white' : 'bg-paper'}`}
                >
                  {w.toUpperCase()}
                  <span className="ml-1.5 text-xs opacity-70 tabular-nums">{pointsFor(w)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
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
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-baseline gap-x-5 gap-y-1 rounded-2xl bg-paper px-4 py-3">
            <span className="text-sm text-muted">Tablero {h.round}</span>
            {players.map((p) => (
              <span key={p} className="text-sm">
                <span className="font-semibold" style={{ color: colorOf(p) }}>{p}</span>{' '}
                <span className="tabular-nums">{h.totals[p] ?? 0} pts</span>
                {h.best?.[p] && <span className="text-muted"> · mejor: {h.best[p].toUpperCase()}</span>}
              </span>
            ))}
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'boggle', ...game.options }} />
    </div>
  )
}
