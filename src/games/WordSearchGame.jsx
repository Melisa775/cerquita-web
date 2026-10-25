import { useEffect, useRef, useState } from 'react'
import { EndActions, winnerTitle } from '../components/EndActions'

export default function WordSearchGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} error={error} errorId={errorId} />
}
WordSearchGame.showsErrors = true

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]

function clock(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Tiempo transcurrido, contando desde lo que dijo el servidor. */
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

  useEffect(() => {
    if (errorId === seen.current) return
    seen.current = errorId
    if (error) setFlash(error)
  }, [errorId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1600)
    return () => clearTimeout(id)
  }, [flash])

  const foundCount = Object.keys(game.found).length

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>
          Ronda {game.round} de {game.totalRounds} · {game.levelLabel}
        </span>
        <span className="font-display text-xl font-bold text-ink tabular-nums">{clock(elapsed)}</span>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,1fr)_16rem] md:items-start">
        <div className="mx-auto w-full max-w-[34rem]">
          <Board game={game} me={me} send={send} colorOf={colorOf} interactive={playing && isPlayer} />
          <p className="mt-2 h-6 text-center font-medium text-danger" role="alert">{flash}</p>
        </div>

        <aside>
          <p className="text-sm font-semibold text-muted">Categoría</p>
          <h1 className="text-2xl font-extrabold">{game.theme}</h1>
          <p className="mt-1 text-sm text-muted">
            {foundCount} de {game.words.length} palabras
          </p>

          {game.mode === 'race' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(game.scores).map(([p, n]) => (
                <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
                  <span style={{ color: colorOf(p) }}>{p}</span> <span className="tabular-nums">{n}</span>
                </span>
              ))}
            </div>
          )}

          <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1.5 md:grid-cols-1">
            {game.words.map((w) => {
              const f = game.found[w]
              const missed = !f && game.phase === 'round_over'
              return (
                <li key={w} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: f ? colorOf(f.player) : missed ? 'var(--color-muted)' : 'var(--color-line)' }}
                  />
                  <span
                    className={`font-display font-bold uppercase tracking-wide ${f ? 'text-muted line-through' : missed ? 'text-danger' : ''}`}
                  >
                    {w}
                  </span>
                </li>
              )
            })}
          </ul>

          {playing && isPlayer && (
            <>
              <p className="mt-5 text-xs text-muted">
                Arrastra desde la primera letra hasta la última, o toca las dos puntas.
              </p>
              <button
                onClick={() => send({ type: 'ws_give_up' })}
                className="mt-4 text-sm font-semibold text-muted underline underline-offset-2 hover:text-ink"
              >
                Rendirse y ver la solución
              </button>
            </>
          )}
        </aside>
      </div>

      {game.phase === 'round_over' && <RoundOver game={game} me={me} send={send} colorOf={colorOf} />}
    </div>
  )
}

function Board({ game, me, send, colorOf, interactive }) {
  const size = game.size
  const inner = useRef(null)
  const drag = useRef(null) // { start, end, moved }
  const [sel, setSel] = useState(null) // selección propia en curso
  const [anchor, setAnchor] = useState(null) // primera punta en modo "tocar"
  const sent = useRef(null)

  function cellAt(e) {
    const rect = inner.current.getBoundingClientRect()
    const c = Math.floor(((e.clientX - rect.left) / rect.width) * size)
    const r = Math.floor(((e.clientY - rect.top) / rect.height) * size)
    return [Math.min(size - 1, Math.max(0, r)), Math.min(size - 1, Math.max(0, c))]
  }

  // Ajusta el final a la recta más cercana: horizontal, vertical o diagonal
  function snap(start, cell) {
    let dr = cell[0] - start[0]
    let dc = cell[1] - start[1]
    if (Math.abs(dr) > 2 * Math.abs(dc)) dc = 0
    else if (Math.abs(dc) > 2 * Math.abs(dr)) dr = 0
    else {
      const d = Math.max(Math.abs(dr), Math.abs(dc))
      dr = Math.sign(dr) * d
      dc = Math.sign(dc) * d
    }
    let steps = Math.max(Math.abs(dr), Math.abs(dc))
    const sr = Math.sign(dr)
    const sc = Math.sign(dc)
    while (steps > 0) {
      const r = start[0] + sr * steps
      const c = start[1] + sc * steps
      if (r >= 0 && r < size && c >= 0 && c < size) return [r, c]
      steps -= 1
    }
    return start
  }

  function share(start, end) {
    const key = start ? `${start}-${end}` : 'none'
    if (sent.current === key) return
    sent.current = key
    send({ type: 'ws_select', start, end })
  }

  function mark(start, end) {
    setSel(null)
    setAnchor(null)
    sent.current = 'none'
    send({ type: 'ws_mark', start, end })
  }

  function down(e) {
    e.preventDefault()
    inner.current.setPointerCapture?.(e.pointerId)
    const cell = cellAt(e)
    if (anchor && !same(anchor, cell)) {
      mark(anchor, snap(anchor, cell))
      return
    }
    drag.current = { start: cell, end: cell, moved: false }
    setSel({ start: cell, end: cell })
    share(cell, cell)
  }

  function move(e) {
    const d = drag.current
    if (!d) return
    const end = snap(d.start, cellAt(e))
    if (same(end, d.end)) return
    d.end = end
    d.moved = d.moved || !same(end, d.start)
    setSel({ start: d.start, end })
    share(d.start, end)
  }

  function up() {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.moved && !same(d.start, d.end)) {
      mark(d.start, d.end)
    } else if (anchor && same(anchor, d.start)) {
      setAnchor(null) // tocar la misma letra otra vez cancela
      setSel(null)
      share(null, null)
    } else {
      setAnchor(d.start)
    }
  }

  const center = ([r, c]) => [c + 0.5, r + 0.5]
  const capsule = (start, end, color, key, extra = {}) => {
    const [x1, y1] = center(start)
    const [x2, y2] = center(end)
    return (
      <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.78" strokeLinecap="round" {...extra} />
    )
  }

  const text = size >= 14 ? 'text-base sm:text-lg' : size >= 12 ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl'
  const mine = sel ?? (anchor ? { start: anchor, end: anchor } : null)

  return (
    <div className="rounded-[2rem] bg-paper p-3 sm:p-4">
      <div
        ref={inner}
        className={`relative aspect-square w-full touch-none select-none ${interactive ? 'cursor-pointer' : ''}`}
        onPointerDown={interactive ? down : undefined}
        onPointerMove={interactive ? move : undefined}
        onPointerUp={interactive ? up : undefined}
        onPointerCancel={interactive ? up : undefined}
        role="grid"
        aria-label="Sopa de letras"
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
          <g opacity="0.32">
            {Object.entries(game.found).map(([w, f]) => capsule(f.cells[0], f.cells.at(-1), colorOf(f.player), w))}
            {game.missing.map((m) => capsule(m.cells[0], m.cells.at(-1), 'var(--color-muted)', `m-${m.word}`))}
          </g>
          {Object.entries(game.selecting).map(([p, s]) =>
            capsule(s.start, s.end, colorOf(p), `s-${p}`, { opacity: 0.22, strokeDasharray: '0.25 0.18', strokeWidth: 0.7 }),
          )}
          {mine && capsule(mine.start, mine.end, colorOf(me), 'mine', { opacity: 0.4 })}
        </svg>
        <div
          className="relative grid h-full w-full"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {game.grid.flatMap((row, r) =>
            row.split('').map((ch, c) => (
              <span key={`${r}-${c}`} className={`flex items-center justify-center font-display font-bold ${text}`}>
                {ch}
              </span>
            )),
          )}
        </div>
      </div>
    </div>
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
    <div className="pop mt-6 rounded-[2rem] p-6 text-white" style={{ background: accent }}>
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
              <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-paper px-4 py-3">
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
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'wordsearch', ...game.options }} />
    </div>
  )
}
