import { useCallback, useEffect, useRef, useState } from 'react'
import DrawingCanvas from '../components/DrawingCanvas'
import TimerBar from '../components/TimerBar'
import { EndActions, winnerTitle } from '../components/EndActions'

const PALETTE = ['#22252E', '#8A8E99', '#E04848', '#F08A2E', '#F2C230', '#3E9460', '#0F6E6A', '#3B7DC4', '#6B4FA0', '#E87AA8', '#8A5A3B']
const SIZES = [4, 10, 24]
const ERASER = '#FFFFFF'

export default function PinturilloGame({ room, me, send, colorOf, error, errorId, subscribe }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} error={error} errorId={errorId} subscribe={subscribe} />
}
PinturilloGame.showsErrors = true

/** Segundos que quedan del turno, a partir de lo que reportó el servidor. */
function useTurnLeft(game) {
  const [left, setLeft] = useState(null)
  useEffect(() => {
    if (game.turnEndsInMs == null) {
      setLeft(null)
      return
    }
    const deadline = Date.now() + game.turnEndsInMs
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [game.turnEndsInMs, game.phase, game.turn])
  return left
}

function Play({ game, me, send, colorOf, error, errorId, subscribe }) {
  const left = useTurnLeft(game)
  const isDrawer = game.drawer === me
  const drawing = game.phase === 'drawing'
  const [tool, setTool] = useState({ color: PALETTE[0], size: SIZES[1] })
  const [flash, setFlash] = useState(null)
  const seen = useRef(errorId)
  const buffer = useRef({ id: null, points: [] })
  const flushTimer = useRef(null)
  // Quien dibuja no recibe sus propios eventos de vuelta: deshacer y borrar se aplican aquí mismo
  const localBus = useRef(new Set())
  const localSubscribe = useCallback((fn) => {
    localBus.current.add(fn)
    return () => localBus.current.delete(fn)
  }, [])
  const emit = (ev) => localBus.current.forEach((fn) => fn(ev))

  useEffect(() => {
    if (errorId === seen.current) return
    seen.current = errorId
    if (error) setFlash(error)
  }, [errorId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2200)
    return () => clearTimeout(id)
  }, [flash])

  useEffect(() => setFlash(null), [game.turn]) // un "¡casi!" no pasa al turno siguiente

  // Los puntos se mandan en paquetitos para no saturar la conexión
  function flush() {
    clearTimeout(flushTimer.current)
    flushTimer.current = null
    const b = buffer.current
    if (b.id && b.points.length) send({ type: 'pz_points', id: b.id, points: b.points })
    b.points = []
  }

  const canvasTool = isDrawer && drawing ? tool : null

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>
          Turno {game.turn} de {game.totalTurns}
        </span>
        <div className="flex gap-2">
          {Object.entries(game.scores).map(([p, n]) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-ink tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="min-w-0">
          <WordBar game={game} me={me} left={left} colorOf={colorOf} />
          <div className="relative mt-3 rounded-[1.6rem] p-1.5" style={{ background: colorOf(game.drawer) }}>
            <DrawingCanvas
              strokes={game.strokes}
              subscribe={isDrawer ? localSubscribe : subscribe}
              tool={canvasTool}
              onStroke={(s) => {
                flush()
                buffer.current = { id: s.id, points: [] }
                send({ type: 'pz_stroke', id: s.id, color: s.color, size: s.size, points: s.points })
              }}
              onPoints={(id, p) => {
                buffer.current.points.push(p)
                if (!flushTimer.current) flushTimer.current = setTimeout(flush, 50)
              }}
              onEnd={flush}
            />
            {game.phase === 'choosing' && <Choosing game={game} me={me} left={left} send={send} colorOf={colorOf} />}
            {game.phase === 'turn_over' && <TurnOver game={game} me={me} left={left} send={send} colorOf={colorOf} />}
          </div>
          {isDrawer && drawing && (
            <Tools
              tool={tool}
              setTool={setTool}
              onUndo={() => {
                flush()
                send({ type: 'pz_undo' })
                emit({ kind: 'undo' })
              }}
              onClear={() => {
                flush()
                send({ type: 'pz_clear' })
                emit({ kind: 'clear' })
              }}
            />
          )}
        </div>

        <Chat game={game} me={me} send={send} colorOf={colorOf} flash={flash} />
      </div>
    </div>
  )
}

function WordBar({ game, me, left, colorOf }) {
  const isDrawer = game.drawer === me
  const drawing = game.phase === 'drawing'
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: colorOf(game.drawer) }}>
            {isDrawer ? 'Dibujas tú' : `Dibuja ${game.drawer}`}
          </p>
          {drawing && (
            <p className="flex flex-wrap gap-x-3 gap-y-1 font-display text-3xl font-extrabold uppercase tracking-[0.25em]">
              {game.mask.map((ch, i) =>
                ch === ' ' ? (
                  <span key={i} className="w-2" />
                ) : (
                  <span key={i} className={ch ? '' : 'text-muted'}>
                    {ch ?? '_'}
                  </span>
                ),
              )}
              {!isDrawer && <span className="self-center text-sm font-normal normal-case tracking-normal text-muted">{game.mask.filter((c) => c !== ' ').length} letras</span>}
            </p>
          )}
        </div>
        {drawing && left != null && <span className="font-display text-3xl font-extrabold tabular-nums">{left}</span>}
      </div>
      {drawing && <TimerBar seconds={game.drawSeconds} resetKey={game.turn} msLeft={game.turnEndsInMs} color={colorOf(game.drawer)} />}
    </div>
  )
}

function Tools({ tool, setTool, onUndo, onClear }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-paper p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colores">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setTool({ ...tool, color: c })}
            aria-label={`Color ${c}`}
            aria-pressed={tool.color === c}
            className={`h-8 w-8 rounded-full ${tool.color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1.5" role="group" aria-label="Grosor">
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => setTool({ ...tool, size: s })}
            aria-label={`Grosor ${s}`}
            aria-pressed={tool.size === s}
            className={`flex h-9 w-9 items-center justify-center rounded-xl ${tool.size === s ? 'bg-ink' : 'bg-stone'}`}
          >
            <span
              className="rounded-full"
              style={{ width: 4 + s * 0.6, height: 4 + s * 0.6, background: tool.size === s ? 'white' : 'var(--color-ink)' }}
            />
          </button>
        ))}
      </div>
      <button
        onClick={() => setTool({ ...tool, color: ERASER, size: Math.max(tool.size, 24) })}
        aria-pressed={tool.color === ERASER}
        className={`rounded-xl px-3 py-2 text-sm font-semibold ${tool.color === ERASER ? 'bg-ink text-white' : 'bg-stone'}`}
      >
        Borrador
      </button>
      <div className="ml-auto flex gap-1.5">
        <button onClick={onUndo} className="rounded-xl bg-stone px-3 py-2 text-sm font-semibold">
          Deshacer
        </button>
        <button onClick={onClear} className="rounded-xl bg-stone px-3 py-2 text-sm font-semibold">
          Borrar todo
        </button>
      </div>
    </div>
  )
}

function Choosing({ game, me, left, send, colorOf }) {
  const isDrawer = game.drawer === me
  return (
    <div className="absolute inset-1.5 flex flex-col items-center justify-center gap-4 rounded-2xl bg-paper/95 p-6 text-center">
      {isDrawer ? (
        <>
          <p className="font-display text-2xl font-extrabold">¿Qué quieres dibujar?</p>
          <div className="flex flex-wrap justify-center gap-3">
            {game.choices.map((w, i) => (
              <button
                key={w}
                onClick={() => send({ type: 'pz_choose', index: i })}
                className="rounded-2xl px-5 py-3 font-display text-xl font-bold text-white"
                style={{ background: colorOf(me) }}
              >
                {w}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">Si no eliges en {left ?? '…'} s, se escoge una sola.</p>
        </>
      ) : (
        <>
          <p className="font-display text-2xl font-extrabold">
            <span style={{ color: colorOf(game.drawer) }}>{game.drawer}</span> está eligiendo qué dibujar
            <span className="animate-pulse">…</span>
          </p>
          <p className="text-muted">Prepárate para adivinar.</p>
        </>
      )}
    </div>
  )
}

function TurnOver({ game, me, left, send, colorOf }) {
  const r = game.result
  const last = game.turn >= game.totalTurns
  return (
    <div className="pop absolute inset-x-4 bottom-4 rounded-2xl p-5 text-white shadow-lg" style={{ background: r.guesser ? colorOf(r.guesser) : 'var(--color-ink)' }}>
      <p className="text-sm font-semibold text-white/80">La palabra era</p>
      <p className="font-display text-3xl font-extrabold uppercase tracking-wider">{r.word}</p>
      <p className="mt-1 text-white/90">
        {r.guesser
          ? `${r.guesser === me ? '¡Lo adivinaste!' : `¡${r.guesser} lo adivinó!`} +${r.points[r.guesser]} para ${r.guesser === me ? 'ti' : r.guesser}, +${r.points[r.drawer]} para ${r.drawer === me ? 'ti' : r.drawer}.`
          : 'Se acabó el tiempo y nadie lo adivinó.'}
      </p>
      <button onClick={() => send({ type: 'next_round' })} className="mt-3 rounded-xl bg-white px-4 py-2 font-semibold text-ink">
        {last ? 'Ver resultados' : `Siguiente turno${left != null ? ` (${left})` : ''}`}
      </button>
    </div>
  )
}

function Chat({ game, me, send, colorOf, flash }) {
  const [text, setText] = useState('')
  const listRef = useRef(null)
  const canGuess = game.phase === 'drawing' && game.drawer !== me && game.players.includes(me)

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [game.guesses.length])

  return (
    <aside className="flex flex-col rounded-[2rem] bg-paper p-5 lg:h-[34rem]">
      <h2 className="font-bold">Intentos</h2>
      <ol ref={listRef} className="mt-3 max-h-60 flex-1 space-y-1.5 overflow-y-auto lg:max-h-none">
        {game.guesses.length === 0 && (
          <li className="text-sm text-muted">{game.drawer === me ? 'Aquí verás lo que va diciendo tu pareja.' : 'Escribe lo que crees que es.'}</li>
        )}
        {game.guesses.map((g, i) => (
          <li key={i} className="text-sm">
            {g.correct ? (
              <span className="font-semibold" style={{ color: 'hsl(148 42% 34%)' }}>
                {g.player === me ? '¡Adivinaste!' : `¡${g.player} adivinó!`}
              </span>
            ) : (
              <>
                <span className="font-semibold" style={{ color: colorOf(g.player) }}>
                  {g.player === me ? 'Tú' : g.player}:
                </span>{' '}
                {g.text}
              </>
            )}
          </li>
        ))}
      </ol>
      <p className="mt-2 min-h-5 text-sm font-semibold" style={{ color: 'hsl(42 82% 38%)' }} role="status">
        {flash}
      </p>
      {canGuess ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) send({ type: 'pz_guess', text })
            setText('')
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            autoComplete="off"
            placeholder="¿Qué es?"
            className="w-full min-w-0 rounded-xl border border-line bg-stone px-3 py-2.5 outline-none focus:border-ink"
          />
          <button type="submit" className="rounded-xl px-4 font-semibold text-white" style={{ background: colorOf(me) }}>
            Enviar
          </button>
        </form>
      ) : (
        game.phase === 'drawing' && game.drawer === me && <p className="mt-2 text-xs text-muted">Tu pareja escribe aquí sus intentos.</p>
      )}
    </aside>
  )
}

function Final({ game, me, send, colorOf }) {
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.scores)}</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(game.scores).map(([p, n]) => (
          <div key={p} className="rounded-2xl bg-paper px-5 py-3">
            <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      <h2 className="mt-8 text-2xl font-bold">Sus dibujos</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {game.history.map((h, i) => (
          <figure key={h.turn} className="overflow-hidden rounded-2xl bg-paper p-2">
            <DrawingCanvas strokes={game.drawings[i] ?? []} />
            <figcaption className="px-2 py-2 text-sm">
              <span className="font-display font-bold uppercase tracking-wide">{h.word}</span>
              <span className="text-muted">
                {' '}· de <span style={{ color: colorOf(h.drawer) }}>{h.drawer}</span>
                {h.guesser ? ' · adivinado' : ' · nadie lo adivinó'}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <EndActions send={send} replay={{ type: 'start_game', game: 'pinturillo', ...game.options }} />
    </div>
  )
}
