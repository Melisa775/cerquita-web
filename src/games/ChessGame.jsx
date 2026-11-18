/**
 * Chess on the 3D stage. Tap one of your pieces to see where it can go and
 * tap a glowing square to move. Clocks, offers and the move list live in the
 * side panel; the board turns around when you play black.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Confetti, spring } from '../lib/motion'
import { CONFETTI_COLORS } from '../components/EndActions'
import ChessPiece, { PIECE_VALUES } from '../components/ChessPiece'
import Stage3D from '../components/stage/Stage3D'
import { Banner, Flash, Plates, Sheet, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'

const PROMOS = ['q', 'r', 'b', 'n']
const FILES = 'abcdefgh'
const sqIndex = (n) => (Number(n[1]) - 1) * 8 + FILES.indexOf(n[0])
const load = () => import('../lib/three/chess3d.js')

export default function ChessGame({ room, me, send, colorOf: playerColor, error, errorId }) {
  const game = room.game
  const myColor = game.colors[me] ?? 'w'
  const opponent = game.players.find((p) => p !== me)
  const finished = game.phase === 'finished'
  const myTurn = !finished && game.toMove === me
  const flash = useFlash(error, errorId)
  const [selected, setSelected] = useState(null)
  const [promo, setPromo] = useState(null) // { from, to }
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  useEffect(() => {
    setSelected(null)
    setPromo(null)
  }, [game.moves.length, game.phase])

  const onPick = useCallback(
    ({ kind, id }) => {
      if (!myTurn) return
      if (kind === 'square') return setSelected((s) => (s === id ? null : id))
      if (kind !== 'target' || !selected) return
      const piece = game.board[sqIndex(selected)]
      if (piece?.toLowerCase() === 'p' && id[1] === (myColor === 'w' ? '8' : '1')) return setPromo({ from: selected, to: id })
      send({ type: 'ch_move', from: selected, to: id })
    },
    [myTurn, selected, game.board, myColor, send],
  )

  // Esc drops the selection
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setSelected(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const state = useMemo(() => ({ game, me, myTurn, select: selected }), [game, me, myTurn, selected])

  const value = (list) => list.reduce((s, p) => s + PIECE_VALUES[p.toLowerCase()], 0)
  const plates = [me, opponent].filter(Boolean).map((p) => {
    const color = game.colors[p]
    const mine = game.captured[color] ?? []
    const adv = value(mine) - value(game.captured[color === 'w' ? 'b' : 'w'] ?? [])
    return {
      name: p,
      you: p === me,
      color: playerColor(p),
      value: color === 'w' ? '♔' : '♚',
      stats: `${color === 'w' ? 'Blancas' : 'Negras'}${mine.length ? ` · capturó ${mine.length}` : ''}${adv > 0 ? ` (+${adv})` : ''}`,
      active: game.toMove === p && !finished,
    }
  })

  let title
  let hint = null
  if (finished) title = game.result.winner ? (game.result.winner === me ? '¡Ganaste!' : `Ganó ${game.result.winner}`) : 'Tablas'
  else if (myTurn) {
    title = game.check ? '¡Jaque! Te toca' : 'Te toca'
    hint = selected ? 'Toca una casilla brillante para mover, o Esc para soltar.' : 'Toca una de tus piezas.'
  } else title = game.check ? `¡Jaque a ${game.toMove}!` : `Juega ${game.toMove}…`
  if (finished) hint = `Por ${game.result.text}.`

  return (
    <>
      <StageLayout
        stageRef={stageRef}
        sky="linear-gradient(#E6DDCE, #CFC2AC)"
        stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Tablero de ajedrez en 3D" />}
        top={
          <>
            <Plates players={plates} />
            <div className="flex flex-col items-end gap-1">
              {[opponent, me].filter(Boolean).map((p) => (
                <div key={p} className="flex items-center gap-1.5 rounded-xl bg-paper/90 px-2 py-1 text-xs font-semibold shadow-sm backdrop-blur">
                  <span style={{ color: playerColor(p) }}>{p}</span>
                  <Clock game={game} color={game.colors[p]} active={game.phase === 'playing' && game.toMove === p} />
                </div>
              ))}
            </div>
          </>
        }
        bottom={
          <>
            <Banner title={title} hint={hint} color={finished ? (game.result.winner ? playerColor(game.result.winner) : undefined) : game.check ? 'var(--color-danger)' : playerColor(game.toMove)} />
            <Flash flash={flash} />
          </>
        }
        overlay={finished && game.result.winner === me && <Confetti colors={CONFETTI_COLORS} />}
        aside={<Side game={game} me={me} send={send} playerColor={playerColor} />}
      />
      <AnimatePresence>
        {promo && (
          <Sheet key="promo" onClose={() => setPromo(null)}>
            <p className="font-display text-xl font-bold">¿En qué coronas?</p>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {PROMOS.map((p) => (
                <motion.button
                  key={p}
                  whileHover={{ y: -4 }}
                  transition={spring}
                  onClick={() => {
                    send({ type: 'ch_move', from: promo.from, to: promo.to, promotion: p })
                    setPromo(null)
                  }}
                  className="aspect-square rounded-2xl bg-stone p-1 hover:bg-line"
                  aria-label={{ q: 'Dama', r: 'Torre', b: 'Alfil', n: 'Caballo' }[p]}
                >
                  <ChessPiece piece={myColor === 'w' ? p.toUpperCase() : p} />
                </motion.button>
              ))}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  )
}
ChessGame.showsErrors = true

/* --- clock and side panel ------------------------------------------------- */

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
      className={`rounded-lg px-3 py-1 font-display text-xl font-bold tabular-nums transition-colors ${active ? 'text-white' : 'bg-paper text-ink'} ${active && running && ms < 10000 ? 'chess-low' : ''}`}
      style={active ? { background: low ? 'var(--color-danger)' : 'var(--color-ink)' } : undefined}
    >
      {text}
    </span>
  )
}

/* --- side panel --------------------------------------------------------- */

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
              // rematch: colors are swapped
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

