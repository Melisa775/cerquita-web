import { useEffect, useMemo, useRef, useState } from 'react'
import { EndActions } from '../components/EndActions'
import { SIZE, preview } from '../lib/crosswords'

const PREMIUM_STYLE = {
  TP: { bg: 'hsl(4 70% 60%)', fg: 'white', label: '3P' },
  DP: { bg: 'hsl(345 70% 84%)', fg: 'hsl(345 50% 32%)', label: '2P' },
  TL: { bg: 'hsl(212 62% 55%)', fg: 'white', label: '3L' },
  DL: { bg: 'hsl(200 70% 84%)', fg: 'hsl(205 50% 30%)', label: '2L' },
}
const BOARD_BG = 'hsl(40 28% 92%)'
const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')

export default function CrosswordsGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const myTurn = game.phase === 'playing' && game.turn === me
  const [pending, setPending] = useState([]) // {r, c, letter, blank, idx}
  const [selected, setSelected] = useState(null) // índice del atril
  const [order, setOrder] = useState(() => game.rack.map((_, i) => i))
  const [blankAsk, setBlankAsk] = useState(null) // {r, c, idx}
  const [swap, setSwap] = useState(null) // Set de índices para cambiar
  const [drag, setDrag] = useState(null) // {idx, x, y}
  const [flash, setFlash] = useState(null)
  const rackKey = game.rack.join('')

  // Si cambia el atril (jugaste, cambiaste o es otra partida) se reinicia lo local
  useEffect(() => {
    setPending([])
    setSelected(null)
    setSwap(null)
    setOrder(game.rack.map((_, i) => i))
  }, [rackKey, game.rack])
  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 3500)
    return () => clearTimeout(id)
  }, [flash])

  const used = new Set(pending.map((p) => p.idx))
  const pv = useMemo(() => preview(game.board, pending, game.premiums, game.values), [game.board, pending, game.premiums, game.values])

  function placeAt(r, c, idx) {
    if (!myTurn || game.board[r][c] || pending.some((p) => p.r === r && p.c === c)) return
    const letter = game.rack[idx]
    if (letter === '?') {
      setBlankAsk({ r, c, idx })
      return
    }
    setPending([...pending, { r, c, letter, blank: false, idx }])
    setSelected(null)
  }

  function clickCell(r, c) {
    const mine = pending.find((p) => p.r === r && p.c === c)
    if (mine) {
      setPending(pending.filter((p) => p !== mine))
      return
    }
    if (selected != null && !used.has(selected)) placeAt(r, c, selected)
  }

  function submit() {
    send({ type: 'cw_play', tiles: pending.map(({ r, c, letter, blank }) => ({ r, c, letter, blank })) })
  }

  // arrastrar del atril al tablero
  function onRackPointerDown(e, idx) {
    if (!myTurn || used.has(idx) || swap) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ idx, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false })
  }
  function onRackPointerMove(e) {
    if (!drag) return
    const moved = drag.moved || Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6
    setDrag({ ...drag, x: e.clientX, y: e.clientY, moved })
  }
  function onRackPointerUp(e, idx) {
    const d = drag
    setDrag(null)
    if (!d) return
    if (!d.moved) {
      setSelected(selected === idx ? null : idx)
      return
    }
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-cell]')
    if (el) {
      const [r, c] = el.dataset.cell.split(',').map(Number)
      placeAt(r, c, d.idx)
    }
  }

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="mx-auto w-full max-w-[40rem]">
        <Board game={game} pending={pending} onCell={clickCell} canPlace={myTurn && (selected != null || pending.length > 0)} colorOf={colorOf} />

        {game.phase === 'playing' && (
          <>
            <div className="mt-3 min-h-7 text-center text-sm font-semibold">
              {pv?.error && <span className="text-muted">{pv.error}</span>}
              {pv?.words && (
                <span>
                  {pv.words.map((w) => `${w.word} (${w.points})`).join(' + ')}
                  {pv.bingo && ' + 50 por usar las 7'} = <span className="font-display text-lg font-extrabold">{pv.score}</span>
                </span>
              )}
            </div>
            <Rack
              game={game}
              order={order}
              used={used}
              selected={selected}
              swap={swap}
              onSwapToggle={(i) => {
                const next = new Set(swap)
                next.has(i) ? next.delete(i) : next.add(i)
                setSwap(next)
              }}
              onPointerDown={onRackPointerDown}
              onPointerMove={onRackPointerMove}
              onPointerUp={onRackPointerUp}
              myTurn={myTurn}
            />
            <Controls
              game={game}
              myTurn={myTurn}
              pending={pending}
              pv={pv}
              swap={swap}
              onSubmit={submit}
              onRecall={() => setPending([])}
              onShuffle={() => setOrder([...order].sort(() => Math.random() - 0.5))}
              onSwapStart={() => {
                setPending([])
                setSwap(new Set())
              }}
              onSwapCancel={() => setSwap(null)}
              onSwapConfirm={() => send({ type: 'cw_exchange', letters: [...swap].map((i) => game.rack[i]) })}
              onPass={() => send({ type: 'cw_pass' })}
            />
          </>
        )}
        <p role="status" className="mt-2 min-h-6 text-center text-sm font-medium text-danger">{flash}</p>
      </div>

      <Side game={game} me={me} colorOf={colorOf} send={send} />

      {drag?.moved && (
        <div className="pointer-events-none fixed z-50" style={{ left: drag.x - 22, top: drag.y - 22 }}>
          <Tile letter={game.rack[drag.idx]} value={game.values[game.rack[drag.idx]]} size="h-11 w-11" lifted />
        </div>
      )}

      {blankAsk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setBlankAsk(null)}>
          <div className="pop w-full max-w-sm rounded-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-xl font-bold">¿Qué letra es el comodín?</p>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {ALPHABET.map((L) => (
                <button
                  key={L}
                  onClick={() => {
                    setPending([...pending, { r: blankAsk.r, c: blankAsk.c, letter: L, blank: true, idx: blankAsk.idx }])
                    setBlankAsk(null)
                    setSelected(null)
                  }}
                  className="rounded-lg bg-stone py-2 font-display font-bold hover:bg-line"
                >
                  {L}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
CrosswordsGame.showsErrors = true

/* --- tablero ------------------------------------------------------------ */

function Tile({ letter, value, blank, size = 'h-full w-full', pending, fresh, lifted, dim }) {
  return (
    <span
      className={`relative flex items-center justify-center rounded-[18%] font-display font-extrabold leading-none ${size} ${fresh ? 'pop' : ''}`}
      style={{
        background: pending ? 'hsl(46 95% 72%)' : 'hsl(42 60% 86%)',
        color: '#22252E',
        boxShadow: lifted ? '0 8px 18px rgba(0,0,0,.25)' : 'inset 0 -2px 0 rgba(0,0,0,.12)',
        opacity: dim ? 0.35 : 1,
        fontSize: 'min(1.15em, 100%)',
      }}
    >
      <span style={{ color: blank ? 'hsl(212 40% 50%)' : undefined }}>{letter === '?' ? '' : letter}</span>
      {!blank && letter !== '?' && value != null && (
        <span className="absolute bottom-[6%] right-[10%] text-[0.45em] font-bold">{value}</span>
      )}
    </span>
  )
}

function Board({ game, pending, onCell, canPlace }) {
  const prem = useMemo(() => new Map(game.premiums.map(([r, c, k]) => [`${r},${c}`, k])), [game.premiums])
  const fresh = new Set((game.last?.cells ?? []).map(([r, c]) => `${r},${c}`))
  const ref = useRef(null)
  return (
    <div
      ref={ref}
      className="grid aspect-square w-full gap-[2px] rounded-2xl p-1.5 text-[2.6vw] shadow-sm sm:text-base"
      style={{ background: 'hsl(40 18% 78%)', gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const r = Math.floor(i / SIZE)
        const c = i % SIZE
        const k = `${r},${c}`
        const tile = game.board[r][c]
        const pend = pending.find((p) => p.r === r && p.c === c)
        const p = prem.get(k)
        const style = p ? PREMIUM_STYLE[p] : null
        const center = r === 7 && c === 7
        return (
          <button
            key={k}
            type="button"
            data-cell={k}
            onClick={() => onCell(r, c)}
            className={`relative flex items-center justify-center overflow-hidden rounded-[3px] ${!tile && canPlace ? 'hover:brightness-95' : ''}`}
            style={{ background: style?.bg ?? BOARD_BG }}
            aria-label={`Fila ${r + 1}, columna ${c + 1}${tile ? `: ${tile.letter}` : ''}`}
          >
            {!tile && !pend && (center ? (
              <span className="text-[0.9em]" style={{ color: style?.fg }}>★</span>
            ) : style ? (
              <span className="text-[0.48em] font-bold" style={{ color: style.fg }}>{style.label}</span>
            ) : null)}
            {tile && <Tile letter={tile.letter} value={game.values[tile.letter]} blank={tile.blank} fresh={fresh.has(k)} />}
            {pend && <Tile letter={pend.letter} value={game.values[pend.letter]} blank={pend.blank} pending />}
          </button>
        )
      })}
    </div>
  )
}

/* --- atril y botones ---------------------------------------------------- */

function Rack({ game, order, used, selected, swap, onSwapToggle, onPointerDown, onPointerMove, onPointerUp, myTurn }) {
  return (
    <div className="mt-2 flex justify-center gap-1.5 rounded-2xl bg-paper p-2.5 sm:gap-2">
      {order.map((i) => {
        const letter = game.rack[i]
        if (letter === undefined) return null
        const isUsed = used.has(i)
        const isSel = selected === i
        const inSwap = swap?.has(i)
        return (
          <button
            key={i}
            type="button"
            className={`touch-none rounded-xl transition-transform ${isSel || inSwap ? '-translate-y-1.5' : ''}`}
            style={{ outline: isSel ? '3px solid var(--color-ink)' : inSwap ? '3px dashed var(--color-danger)' : 'none', outlineOffset: 2 }}
            onPointerDown={(e) => (swap ? null : onPointerDown(e, i))}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => (swap ? onSwapToggle(i) : onPointerUp(e, i))}
            disabled={isUsed || (!myTurn && !swap)}
            aria-label={letter === '?' ? 'Comodín' : `Letra ${letter}`}
          >
            <Tile letter={letter} value={game.values[letter]} size="h-11 w-11 text-2xl sm:h-12 sm:w-12" dim={isUsed} />
          </button>
        )
      })}
    </div>
  )
}

function Controls({ game, myTurn, pending, pv, swap, onSubmit, onRecall, onShuffle, onSwapStart, onSwapCancel, onSwapConfirm, onPass }) {
  const btn = 'rounded-2xl border border-line px-3 py-2.5 text-sm font-semibold hover:border-ink disabled:opacity-40'
  if (swap) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        <span className="text-sm text-muted">Toca las letras que quieres cambiar.</span>
        <button onClick={onSwapConfirm} disabled={!swap.size} className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          Cambiar {swap.size || ''}
        </button>
        <button onClick={onSwapCancel} className={btn}>Cancelar</button>
      </div>
    )
  }
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      <button onClick={onSubmit} disabled={!myTurn || !pv?.words} className="rounded-2xl bg-ink px-6 py-2.5 font-semibold text-white disabled:opacity-40">
        Jugar{pv?.words ? ` (${pv.score})` : ''}
      </button>
      <button onClick={onRecall} disabled={!pending.length} className={btn}>Recoger</button>
      <button onClick={onShuffle} className={btn}>Mezclar</button>
      <button onClick={onSwapStart} disabled={!myTurn || game.bag < 7} className={btn} title={game.bag < 7 ? 'Quedan menos de 7 letras en la bolsa' : ''}>Cambiar</button>
      <button onClick={onPass} disabled={!myTurn} className={btn}>Pasar</button>
    </div>
  )
}

/* --- panel lateral ------------------------------------------------------ */

function describe(h, me) {
  const you = h.player === me
  if (h.action === 'play') {
    const words = h.words.map((w) => w.word).join(', ')
    return `${you ? 'Jugaste' : `${h.player} jugó`} ${words}: ${h.score}${h.bingo ? ' ¡con las 7!' : ''}`
  }
  if (h.action === 'exchange') return `${you ? 'Cambiaste' : `${h.player} cambió`} ${h.count} ${h.count === 1 ? 'letra' : 'letras'}`
  return `${you ? 'Pasaste' : `${h.player} pasó`}`
}

function Side({ game, me, colorOf, send }) {
  const finished = game.phase === 'finished'
  let title
  if (finished) title = game.winner ? (game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`) : 'Empate'
  else title = game.turn === me ? 'Te toca' : `Juega ${game.turn}…`
  return (
    <aside className="rounded-[2rem] bg-paper p-5">
      <p className="font-display text-3xl font-extrabold" style={{ color: finished ? (game.winner ? colorOf(game.winner) : undefined) : colorOf(game.turn) }}>{title}</p>
      <div className="mt-4 space-y-2">
        {game.players.map((p) => (
          <div key={p} className="flex items-center justify-between rounded-2xl bg-stone px-4 py-2.5">
            <span className="font-semibold" style={{ color: colorOf(p) }}>
              {p}
              {p === me && ' (tú)'}
              <span className="ml-2 text-xs font-normal text-muted">{game.rackCounts[p]} letras</span>
            </span>
            <span className="font-display text-2xl font-extrabold tabular-nums">{game.scores[p]}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-muted">Quedan <span className="font-semibold text-ink">{game.bag}</span> letras en la bolsa.</p>

      {finished && game.racks && (
        <div className="mt-4 rounded-2xl bg-stone p-3 text-sm">
          <p className="font-semibold">{game.final.out ? `${game.final.out} se quedó sin letras y suma lo del otro.` : 'Cuatro turnos seguidos sin puntos: se acabó.'}</p>
          {game.players.map((p) => (
            <p key={p} className="mt-1 text-muted">
              <span style={{ color: colorOf(p) }} className="font-semibold">{p}</span>: le quedaron {game.racks[p].join(' ') || 'ninguna'} (−{game.final.left[p]})
            </p>
          ))}
        </div>
      )}

      <ol className="mt-4 max-h-64 space-y-1 overflow-y-auto border-t border-line pt-3 text-sm">
        {[...game.history].reverse().map((h, i) => (
          <li key={game.history.length - i} className={i === 0 ? 'pop font-semibold' : 'text-muted'}>
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(h.player) }} />
            {describe(h, me)}
          </li>
        ))}
        {!game.history.length && <li className="text-muted">La primera palabra pasa por la estrella del centro.</li>}
      </ol>
      {finished && <EndActions send={send} replay={{ type: 'start_game', game: 'crosswords', ...game.options }} />}
    </aside>
  )
}
