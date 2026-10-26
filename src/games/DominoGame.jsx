import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import DominoTile from '../components/DominoTile'
import { EndActions } from '../components/EndActions'

const FELT = 'hsl(158 30% 34%)'
const sameTile = (t, u) => t && u && t[0] === u[0] && t[1] === u[1]

export default function DominoGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const [selected, setSelected] = useState(null) // ficha que pega por los dos lados
  const [flash, setFlash] = useState(null)

  useEffect(() => setSelected(null), [game.line.length, game.phase, game.handNo])
  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  const myTurn = game.phase === 'playing' && game.turn === me
  const moveOf = (t) => game.moves.find((m) => sameTile(m.tile, t))

  function choose(tile) {
    const m = moveOf(tile)
    if (!m) return
    // Si los dos extremos tienen el mismo número, da igual el lado: no se pregunta
    if (m.sides.length === 1 || game.ends[0] === game.ends[1]) send({ type: 'dm_play', tile, side: m.sides[m.sides.length - 1] })
    else setSelected(sameTile(selected, tile) ? null : tile)
  }
  function place(side) {
    if (selected) send({ type: 'dm_play', tile: selected, side })
  }

  return (
    <div className="mt-4">
      <Scores game={game} me={me} colorOf={colorOf} />

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-semibold" style={{ color: colorOf(other) }}>{other}</span>
          <span className="text-sm text-muted">{game.counts[other]} {game.counts[other] === 1 ? 'ficha' : 'fichas'}</span>
        </div>
        {game.options.boneyard && <span className="text-sm text-muted">Pozo: <span className="font-semibold text-ink">{game.pool}</span></span>}
      </div>
      <OpponentHand game={game} other={other} />

      <Table game={game} selected={selected} onPlace={place} />

      <Status game={game} me={me} colorOf={colorOf} selected={selected} onPlace={place} send={send} />

      {game.phase === 'playing' ? (
        <section className="mt-3 rounded-[2rem] bg-paper p-4 sm:p-5">
          <p className="text-sm font-semibold text-muted">
            Tus fichas · {game.hands[me]?.length ?? 0}
            {game.forced && myTurn && ` · sales con el ${game.forced[0]}|${game.forced[1]}`}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:gap-3">
            {(game.hands[me] ?? []).map((t) => {
              const playable = myTurn && !!moveOf(t)
              const isSel = sameTile(selected, t)
              return (
                <button
                  key={`${t[0]}-${t[1]}`}
                  onClick={() => choose(t)}
                  disabled={!playable}
                  className={`rounded-xl transition-transform ${playable ? 'hover:-translate-y-1.5' : ''} ${isSel ? '-translate-y-2' : ''}`}
                  aria-label={`Ficha ${t[0]} y ${t[1]}${playable ? ', se puede jugar' : ''}`}
                >
                  <DominoTile a={t[0]} b={t[1]} vertical unit={34} dim={myTurn && !playable} ring={isSel ? 'var(--color-ink)' : playable ? colorOf(me) : undefined} />
                </button>
              )
            })}
          </div>
        </section>
      ) : (
        <HandOver game={game} me={me} send={send} colorOf={colorOf} />
      )}
      <p role="status" className="mt-2 min-h-6 text-center text-sm font-medium text-danger">{flash}</p>
    </div>
  )
}
DominoGame.showsErrors = true

function Scores({ game, me, colorOf }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {game.players.map((p) => (
        <div key={p} className="rounded-2xl bg-paper px-4 py-3">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</span>
            <span className="text-sm text-muted">
              <span className="font-display text-2xl font-extrabold text-ink tabular-nums">{game.scores[p]}</span> / {game.goal}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, (game.scores[p] / game.goal) * 100)}%`, background: colorOf(p) }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function OpponentHand({ game, other }) {
  const n = game.counts[other]
  if (game.phase !== 'playing') return null
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {Array.from({ length: n }, (_, i) => <DominoTile key={i} faceDown vertical unit={14} />)}
    </div>
  )
}

/* --- la mesa: la línea va en serpiente para que quepa ------------------- */

function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref])
  return w
}

function layoutRows(line, capacity) {
  // Cada ficha ocupa 2 unidades (o 1 si es doble, que va atravesada)
  const rows = []
  let row = []
  let used = 0
  line.forEach((t, i) => {
    const size = t[0] === t[1] ? 1 : 2
    if (row.length && used + size > capacity) {
      rows.push(row)
      row = []
      used = 0
    }
    row.push({ t, i })
    used += size
  })
  if (row.length) rows.push(row)
  return rows
}

function Table({ game, selected, onPlace }) {
  const ref = useRef(null)
  const width = useWidth(ref)
  const unit = width < 420 ? 20 : 26
  const gap = 3
  const capacity = Math.max(4, Math.floor((width - 16) / (unit + gap)))
  const rows = layoutRows(game.line, capacity)
  const lastIdx = game.line.length - 1
  const lastPlay = [...game.log].reverse().find((l) => l.action === 'play')
  const targetable = selected ? { left: true, right: true } : null

  return (
    <div ref={ref} className="mt-3 flex min-h-48 flex-col justify-center rounded-[2rem] p-4 sm:p-6" style={{ background: FELT, boxShadow: 'inset 0 2px 12px rgba(0,0,0,.25)' }}>
      {!game.line.length && (
        <p className="flex h-40 items-center justify-center text-center font-semibold text-white/80">
          {game.phase === 'playing' ? `Sale ${game.turn}${game.forced ? ` con el ${game.forced[0]}|${game.forced[1]}` : ''}` : ''}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {rows.map((row, r) => {
          const reversed = r % 2 === 1
          const items = reversed ? [...row].reverse() : row
          return (
            <div key={r} className={`flex items-center gap-[3px] ${rows.length === 1 ? 'justify-center' : reversed ? 'justify-end' : 'justify-start'}`} style={{ minHeight: unit * 2 }}>
              {items.map(({ t, i }) => {
                const double = t[0] === t[1]
                const [a, b] = reversed ? [t[1], t[0]] : t
                const isLeftEnd = i === 0
                const isRightEnd = i === lastIdx
                const fresh = lastPlay && sameTile([...lastPlay.tile].sort((x, y) => x - y), [...t].sort((x, y) => x - y))
                const endSide = targetable && (isLeftEnd ? 'left' : isRightEnd ? 'right' : null)
                const tile = (
                  <DominoTile
                    a={a}
                    b={b}
                    vertical={double}
                    unit={unit}
                    ring={endSide ? 'hsl(46 95% 60%)' : undefined}
                    className={fresh ? 'pop' : ''}
                  />
                )
                return endSide ? (
                  <button key={i} onClick={() => onPlace(endSide)} className="rounded-md" aria-label={`Poner en el extremo ${endSide === 'left' ? 'izquierdo' : 'derecho'}`}>
                    {tile}
                  </button>
                ) : (
                  <span key={i}>{tile}</span>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* --- estado, avisos y botones ------------------------------------------- */

function describe(entry, me) {
  if (!entry) return null
  const who = entry.player === me ? 'Pusiste' : `${entry.player} puso`
  if (entry.action === 'play') return `${who} el ${entry.tile[0]}|${entry.tile[1]}.`
  if (entry.action === 'draw') return entry.player === me ? 'Robaste del pozo.' : `${entry.player} robó del pozo.`
  return entry.player === me ? 'No tenías jugada: pasaste.' : `${entry.player} no tenía jugada y pasó.`
}

function Status({ game, me, colorOf, selected, onPlace, send }) {
  if (game.phase !== 'playing') return null
  const myTurn = game.turn === me
  const last = game.log[game.log.length - 1]
  const draws = [...game.log].reverse()
  let streak = 0
  for (const l of draws) {
    if (l.action === 'draw' && l.player === last?.player) streak += 1
    else break
  }
  const lastText = last?.action === 'draw' && streak > 1
    ? last.player === me ? `Robaste ${streak} fichas.` : `${last.player} robó ${streak} fichas.`
    : describe(last, me)

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-display text-2xl font-extrabold" style={{ color: colorOf(game.turn) }}>
          {myTurn ? (game.mustDraw ? 'No tienes jugada: roba' : 'Te toca') : `Juega ${game.turn}…`}
        </p>
        <p key={game.log.length} className="pop min-h-5 text-sm text-muted">{lastText}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {myTurn && game.mustDraw && (
          <button onClick={() => send({ type: 'dm_draw' })} autoFocus className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
            Robar del pozo ({game.pool})
          </button>
        )}
        {selected && (
          <>
            <button onClick={() => onPlace('left')} className="rounded-2xl bg-ink px-4 py-3 font-semibold text-white">
              ← Izquierda ({game.ends[0]})
            </button>
            <button onClick={() => onPlace('right')} className="rounded-2xl bg-ink px-4 py-3 font-semibold text-white">
              Derecha ({game.ends[1]}) →
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function HandOver({ game, me, send, colorOf }) {
  const r = game.result
  const finished = game.phase === 'finished'
  let title
  if (r.reason === 'domino') title = r.winner === me ? '¡Dominó! Ganaste la mano' : `¡Dominó de ${r.winner}!`
  else if (r.winner) title = `Tranque: ${r.winner === me ? 'ganaste' : `ganó ${r.winner}`} con menos puntos`
  else title = 'Tranque empatado: nadie suma'
  return (
    <section className="pop mt-3 rounded-[2rem] bg-paper p-5 sm:p-6">
      {finished && (
        <p className="font-display text-4xl font-extrabold" style={{ color: colorOf(game.winner) }}>
          {game.winner === me ? '¡Ganaste la partida!' : `${game.winner} ganó la partida`}
        </p>
      )}
      <p className={`font-display font-extrabold ${finished ? 'mt-1 text-xl text-muted' : 'text-3xl'}`}>{title}</p>
      {r.winner && <p className="mt-1 text-muted">Suma {r.points} puntos: lo que le quedó en la mano a {game.players.find((p) => p !== r.winner) === me ? 'ti' : game.players.find((p) => p !== r.winner)}.</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {game.players.map((p) => (
          <div key={p}>
            <p className="text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-muted">· {r.pips[p]} puntos en la mano</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(game.hands[p] ?? []).map((t) => <DominoTile key={`${t[0]}-${t[1]}`} a={t[0]} b={t[1]} vertical unit={22} />)}
              {!(game.hands[p] ?? []).length && <span className="text-sm text-muted">Sin fichas</span>}
            </div>
          </div>
        ))}
      </div>
      {finished ? (
        <EndActions send={send} replay={{ type: 'start_game', game: 'domino', ...game.options }} />
      ) : (
        <button onClick={() => send({ type: 'next_round' })} autoFocus className="mt-5 rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
          Siguiente mano
        </button>
      )}
    </section>
  )
}
