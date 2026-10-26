import { useEffect, useMemo, useRef, useState } from 'react'
import ChessPiece, { PIECE_VALUES } from '../components/ChessPiece'

const FILES = 'abcdefgh'
const LIGHT_SQ = '#E8E2D4'
const DARK_SQ = '#7C9893'
const MARK = 'rgba(247, 201, 72, 0.5)'
const PROMOS = ['q', 'r', 'b', 'n']

const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1)
const sqIndex = (n) => (Number(n[1]) - 1) * 8 + FILES.indexOf(n[0])

export default function ChessGame({ room, me, send, colorOf: playerColor, error, errorId }) {
  const game = room.game
  const myColor = game.colors[me] ?? 'w'
  const opponent = game.players.find((p) => p !== me)
  const finished = game.phase === 'finished'
  const myTurn = !finished && game.toMove === me
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (!error) return
    setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="mx-auto w-full max-w-[min(100%,36rem)]">
        <PlayerBar game={game} player={opponent} color={game.colors[opponent]} playerColor={playerColor} me={me} />
        <Board game={game} me={me} myColor={myColor} myTurn={myTurn} send={send} />
        <PlayerBar game={game} player={me} color={myColor} playerColor={playerColor} me={me} />
        <p role="status" className="mt-2 min-h-6 text-center text-sm font-medium text-danger">{flash}</p>
      </div>
      <Side game={game} me={me} send={send} playerColor={playerColor} />
    </div>
  )
}
ChessGame.showsErrors = true

/* --- tablero ------------------------------------------------------------ */

function Board({ game, me, myColor, myTurn, send }) {
  const boardRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [promo, setPromo] = useState(null) // { from, to }
  const [drag, setDrag] = useState(null) // { from, x, y, moved }
  const dropped = useRef(null) // jugada hecha arrastrando: no se anima
  const flipped = myColor === 'b'
  const legal = myTurn ? game.legal : {}
  const targets = selected ? legal[selected] ?? [] : []
  const hints = game.options.hints

  // Al cambiar la posición se limpia la selección
  const ply = game.moves.length
  useEffect(() => {
    setSelected(null)
    setPromo(null)
  }, [ply, game.phase])

  const order = useMemo(() => {
    const rows = []
    for (let r = 7; r >= 0; r--) for (let f = 0; f < 8; f++) rows.push(r * 8 + f)
    return flipped ? rows.reverse() : rows
  }, [flipped])

  function attempt(from, to) {
    const piece = game.board[sqIndex(from)]
    const lastRank = myColor === 'w' ? '8' : '1'
    if (piece?.toLowerCase() === 'p' && to[1] === lastRank) {
      setPromo({ from, to })
      return
    }
    send({ type: 'ch_move', from, to })
  }

  // Seleccionar piezas lo manejan los eventos de puntero; el clic solo mueve o suelta
  function clickSquare(name) {
    if (promo) return
    if (selected && targets.includes(name)) attempt(selected, name)
    else if (!legal[name]) setSelected(null)
  }

  function squareAt(x, y) {
    const rect = boardRef.current.getBoundingClientRect()
    const col = Math.floor(((x - rect.left) / rect.width) * 8)
    const row = Math.floor(((y - rect.top) / rect.height) * 8)
    if (col < 0 || col > 7 || row < 0 || row > 7) return null
    return sqName(order[row * 8 + col])
  }

  function onPointerDown(e) {
    if (promo || e.button > 0) return
    const name = squareAt(e.clientX, e.clientY)
    if (!name || !legal[name]) return
    e.preventDefault()
    boardRef.current.setPointerCapture(e.pointerId)
    setDrag({ from: name, x: e.clientX, y: e.clientY, moved: false, wasSelected: selected === name })
    setSelected(name)
  }
  function onPointerMove(e) {
    if (!drag) return
    const moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved, cx: e.clientX, cy: e.clientY })
  }
  function onPointerUp(e) {
    if (!drag) return
    const name = squareAt(e.clientX, e.clientY)
    const d = drag
    setDrag(null)
    if (!d.moved) {
      // fue un clic sobre la pieza: un segundo clic la suelta
      if (d.wasSelected) setSelected(null)
      return
    }
    if (name && (legal[d.from] ?? []).includes(name)) {
      dropped.current = `${d.from}${name}`
      attempt(d.from, name)
    }
  }

  const last = game.lastMove
  const lastKey = last ? `${last.from}${last.to}` : null
  const animate = last && dropped.current !== lastKey
  const squarePx = boardRef.current ? boardRef.current.getBoundingClientRect().width / 8 : 0

  return (
    <div className="relative mt-2 select-none">
      <div
        ref={boardRef}
        className="grid aspect-square w-full touch-none grid-cols-8 grid-rows-8 overflow-hidden rounded-xl shadow-sm"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => setDrag(null)}
        role="grid"
        aria-label="Tablero de ajedrez"
      >
        {order.map((i, pos) => {
          const n = sqName(i)
          const piece = game.board[i]
          const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 0
          const isTarget = targets.includes(n)
          const row = Math.floor(pos / 8)
          const col = pos % 8
          const isLast = last && (last.from === n || last.to === n)
          const dragging = drag?.moved && drag.from === n
          let slide = null
          if (animate && last.to === n && squarePx) {
            const a = order.indexOf(sqIndex(last.from))
            const b = pos
            slide = { '--dx': `${((a % 8) - (b % 8)) * 100}%`, '--dy': `${(Math.floor(a / 8) - Math.floor(b / 8)) * 100}%` }
          }
          return (
            <div
              key={n}
              onClick={() => clickSquare(n)}
              className={`relative ${legal[n] || isTarget ? 'cursor-pointer' : ''}`}
              style={{ background: dark ? DARK_SQ : LIGHT_SQ }}
              aria-label={n}
            >
              {isLast && <div className="absolute inset-0" style={{ background: MARK }} />}
              {selected === n && <div className="absolute inset-0" style={{ background: 'rgba(247, 201, 72, 0.75)' }} />}
              {game.check === n && (
                <div className="absolute inset-0" style={{ background: 'radial-gradient(circle, rgba(214,48,49,.9) 0%, rgba(214,48,49,.45) 45%, transparent 72%)' }} />
              )}
              {col === 0 && (
                <span className="absolute left-1 top-0.5 text-[0.62rem] font-bold sm:text-xs" style={{ color: dark ? LIGHT_SQ : DARK_SQ }}>
                  {n[1]}
                </span>
              )}
              {row === 7 && (
                <span className="absolute bottom-0.5 right-1 text-[0.62rem] font-bold sm:text-xs" style={{ color: dark ? LIGHT_SQ : DARK_SQ }}>
                  {n[0]}
                </span>
              )}
              {piece && (
                <ChessPiece
                  key={slide ? `${lastKey}-${game.moves.length}` : 'still'}
                  piece={piece}
                  className={`relative h-full w-full p-[3%] ${slide ? 'chess-slide z-10' : ''}`}
                  style={{ ...slide, opacity: dragging ? 0.25 : 1 }}
                />
              )}
              {isTarget && hints && (
                piece ? (
                  <div className="absolute inset-[4%] rounded-full" style={{ boxShadow: 'inset 0 0 0 5px rgba(34,37,46,.28)' }} />
                ) : (
                  <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'rgba(34,37,46,.25)' }} />
                )
              )}
            </div>
          )
        })}
      </div>

      {drag?.moved && (
        <ChessPiece
          piece={game.board[sqIndex(drag.from)]}
          className="pointer-events-none fixed z-50 drop-shadow-lg"
          style={{ width: squarePx * 1.1, height: squarePx * 1.1, left: drag.x - squarePx * 0.55, top: drag.y - squarePx * 0.55 }}
        />
      )}

      {promo && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-ink/45" onClick={() => setPromo(null)}>
          <div className="pop rounded-3xl bg-paper p-4 text-center shadow-lg" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-lg font-bold">¿En qué coronas?</p>
            <div className="mt-3 flex gap-2">
              {PROMOS.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    send({ type: 'ch_move', from: promo.from, to: promo.to, promotion: p })
                    setPromo(null)
                  }}
                  className="h-16 w-16 rounded-2xl bg-stone p-1 hover:bg-line sm:h-20 sm:w-20"
                  aria-label={{ q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo' }[p]}
                >
                  <ChessPiece piece={myColor === 'w' ? p.toUpperCase() : p} />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {game.phase === 'finished' && <ResultOverlay game={game} me={me} />}
    </div>
  )
}

function ResultOverlay({ game, me }) {
  const [hidden, setHidden] = useState(false)
  if (hidden) return null
  const r = game.result
  const title = r.winner ? (r.winner === me ? '¡Ganaste!' : `Ganó ${r.winner}`) : 'Tablas'
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-ink/35" onClick={() => setHidden(true)}>
      <div className="pop rounded-3xl bg-paper px-8 py-6 text-center shadow-lg">
        <p className="font-display text-4xl font-extrabold">{title}</p>
        <p className="mt-1 text-muted">Por {r.text}.</p>
        <p className="mt-3 text-xs text-muted">Toca para ver el tablero</p>
      </div>
    </div>
  )
}

/* --- jugadores y reloj -------------------------------------------------- */

function PlayerBar({ game, player, color, playerColor, me }) {
  const captured = game.captured[color] ?? []
  const value = (list) => list.reduce((s, p) => s + PIECE_VALUES[p.toLowerCase()], 0)
  const advantage = value(captured) - value(game.captured[color === 'w' ? 'b' : 'w'] ?? [])
  const sorted = [...captured].sort((a, b) => PIECE_VALUES[a.toLowerCase()] - PIECE_VALUES[b.toLowerCase()])
  const active = game.phase === 'playing' && game.turn === color
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-4 w-4 shrink-0 rounded-full border-2"
          style={{ background: color === 'w' ? '#F7F5EF' : '#2A2D36', borderColor: '#22252E' }}
          title={color === 'w' ? 'Blancas' : 'Negras'}
        />
        <span className="truncate font-semibold" style={{ color: playerColor(player) }}>
          {player}
          {player === me && ' (tú)'}
        </span>
        <span className="flex min-w-0 items-center">
          {sorted.map((p, i) => (
            <ChessPiece key={i} piece={p} className="-ml-1.5 h-5 w-5 first:ml-0" />
          ))}
          {advantage > 0 && <span className="ml-1 text-xs font-semibold text-muted">+{advantage}</span>}
        </span>
      </div>
      <Clock game={game} color={color} active={active} />
    </div>
  )
}

function Clock({ game, color, active }) {
  const [now, setNow] = useState(() => Date.now())
  const receivedRef = useRef({ at: Date.now(), clocks: game.clocks })
  if (receivedRef.current.clocks !== game.clocks) receivedRef.current = { at: Date.now(), clocks: game.clocks }
  const running = game.clockRunning && active

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [running])

  if (!game.clocks) {
    return active ? <span className="rounded-lg bg-ink px-2.5 py-1 text-sm font-semibold text-white">Juega</span> : null
  }
  const base = receivedRef.current.clocks[color]
  const ms = Math.max(0, running ? base - (now - receivedRef.current.at) : base)
  const low = ms < 20000
  const total = Math.ceil(ms / 100) / 10
  const m = Math.floor(total / 60)
  const s = total % 60
  const text = ms < 10000 ? `${Math.floor(s)}.${Math.floor((ms % 1000) / 100)}` : `${m}:${String(Math.floor(s)).padStart(2, '0')}`
  return (
    <span
      className={`rounded-lg px-3 py-1 font-display text-xl font-bold tabular-nums ${active ? 'text-white' : 'bg-paper text-ink'}`}
      style={active ? { background: low ? 'var(--color-danger)' : 'var(--color-ink)' } : undefined}
    >
      {text}
    </span>
  )
}

/* --- panel lateral ------------------------------------------------------ */

function Side({ game, me, send, playerColor }) {
  const finished = game.phase === 'finished'
  const opponent = game.players.find((p) => p !== me)
  const [confirmResign, setConfirmResign] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [game.moves.length])

  useEffect(() => {
    if (!confirmResign) return
    const id = setTimeout(() => setConfirmResign(false), 3000)
    return () => clearTimeout(id)
  }, [confirmResign])

  const pairs = []
  for (let i = 0; i < game.moves.length; i += 2) pairs.push([game.moves[i], game.moves[i + 1]])

  let status
  if (finished) status = null
  else if (game.toMove === me) status = game.check ? '¡Jaque! Te toca' : 'Te toca'
  else status = game.check ? `¡Jaque a ${game.toMove}!` : `Juega ${game.toMove}`

  return (
    <aside className="rounded-[2rem] bg-paper p-5">
      {status && (
        <p className="font-display text-2xl font-extrabold" style={{ color: game.check ? 'var(--color-danger)' : playerColor(game.toMove) }}>
          {status}
        </p>
      )}
      {finished && (
        <p className="font-display text-2xl font-extrabold">
          {game.result.winner ? (game.result.winner === me ? '¡Ganaste!' : `Ganó ${game.result.winner}`) : 'Tablas'}
          <span className="block text-sm font-normal text-muted">Por {game.result.text}.</span>
        </p>
      )}

      {!finished && game.drawOffer && game.drawOffer !== me && (
        <Offer text={`${opponent} ofrece tablas`} onYes={() => send({ type: 'ch_draw' })} onNo={() => send({ type: 'ch_draw_decline' })} yes="Aceptar" />
      )}
      {!finished && game.undoRequest && game.undoRequest !== me && (
        <Offer text={`${opponent} quiere deshacer su última jugada`} onYes={() => send({ type: 'ch_undo' })} onNo={() => send({ type: 'ch_undo_decline' })} yes="Dejar" />
      )}
      {!finished && game.drawOffer === me && <p className="mt-3 rounded-2xl bg-stone px-3 py-2 text-sm text-muted">Ofreciste tablas. Esperando respuesta…</p>}
      {!finished && game.undoRequest === me && <p className="mt-3 rounded-2xl bg-stone px-3 py-2 text-sm text-muted">Pediste deshacer. Esperando respuesta…</p>}

      <ol ref={listRef} className="mt-4 max-h-64 overflow-y-auto rounded-2xl bg-stone p-2 text-sm tabular-nums lg:max-h-80" aria-label="Jugadas">
        {pairs.map(([w, b], i) => (
          <li key={i} className="grid grid-cols-[2.2rem_1fr_1fr] rounded-lg px-2 py-0.5 odd:bg-white/60">
            <span className="text-muted">{i + 1}.</span>
            <span className="font-semibold">{w}</span>
            <span className="font-semibold">{b ?? ''}</span>
          </li>
        ))}
        {!pairs.length && <li className="px-2 py-1 text-muted">Las blancas empiezan.</li>}
      </ol>

      {!finished && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={() => send({ type: 'ch_draw' })}
            disabled={game.drawOffer === me}
            className="rounded-2xl border border-line px-3 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-40"
          >
            Ofrecer tablas
          </button>
          <button
            onClick={() => send({ type: 'ch_undo' })}
            disabled={game.undoRequest === me || !game.moves.length}
            className="rounded-2xl border border-line px-3 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-40"
          >
            Deshacer
          </button>
          <button
            onClick={() => (confirmResign ? send({ type: 'ch_resign' }) : setConfirmResign(true))}
            className={`col-span-2 rounded-2xl px-3 py-2.5 text-sm font-semibold ${confirmResign ? 'bg-danger text-white' : 'border border-line text-danger hover:border-danger'}`}
          >
            {confirmResign ? '¿Seguro? Toca otra vez para rendirte' : 'Rendirse'}
          </button>
        </div>
      )}

      {finished && (
        <div className="mt-4 grid gap-2">
          <button
            onClick={() => {
              // revancha: se cambian los colores
              const black = Object.keys(game.colors).find((p) => game.colors[p] === 'b')
              send({ type: 'start_game', game: 'chess', ...game.options, white: black })
            }}
            className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white"
          >
            Revancha (cambian colores)
          </button>
          <button onClick={() => send({ type: 'back_to_lobby' })} className="rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink">
            Volver a los juegos
          </button>
        </div>
      )}
    </aside>
  )
}

function Offer({ text, onYes, onNo, yes }) {
  return (
    <div className="pop mt-3 rounded-2xl bg-ink p-3 text-white">
      <p className="text-sm font-semibold">{text}</p>
      <div className="mt-2 flex gap-2">
        <button onClick={onYes} className="flex-1 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-ink">{yes}</button>
        <button onClick={onNo} className="flex-1 rounded-xl border border-white/40 px-3 py-2 text-sm font-semibold">No</button>
      </div>
    </div>
  )
}

