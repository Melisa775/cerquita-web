/**
 * Crosswords on the 3D stage. Pick a letter in the rack and tap a square (or
 * drag it onto the board); tap one of your yellow letters to take it back.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AnimatedNumber, Confetti, spring } from '../lib/motion'
import { CONFETTI_COLORS } from '../components/EndActions'
import { EndActions } from '../components/EndActions'
import { preview } from '../lib/crosswords'
import Stage3D from '../components/stage/Stage3D'
import { Banner, Flash, Plates, Sheet, StageLayout } from '../components/stage/hud'

const load = () => import('../lib/three/crosswords3d.js')

const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')

export default function CrosswordsGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const myTurn = game.phase === 'playing' && game.turn === me
  const [pending, setPending] = useState([]) // {r, c, letter, blank, idx}
  const [selected, setSelected] = useState(null) // rack index
  const [order, setOrder] = useState(() => game.rack.map((_, i) => i))
  const [blankAsk, setBlankAsk] = useState(null) // {r, c, idx}
  const [swap, setSwap] = useState(null) // Set of indices to exchange
  const [drag, setDrag] = useState(null) // {idx, x, y}
  const [flash, setFlash] = useState(null)
  const rackKey = game.rack.join('')
  const stageRef = useRef(null)

  // If the rack changes (you played, exchanged, or it's a new game) local state resets
  useEffect(() => {
    setPending([])
    setSelected(null)
    setSwap(null)
    setOrder(game.rack.map((_, i) => i))
  }, [rackKey, game.rack])
  useEffect(() => {
    if (error) setFlash({ text: error, id: errorId })
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

  // drag from the rack to the board
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
    const cell = stageRef.current?.call('cellAtScreen', e.clientX, e.clientY)
    if (cell) placeAt(cell[0], cell[1], d.idx)
  }

  const onPick = ({ kind, id }) => {
    if (kind !== 'cell' && kind !== 'pending') return
    const [r, c] = id.split(',').map(Number)
    clickCell(r, c)
  }
  const pickRef = useRef(onPick)
  pickRef.current = onPick
  const stablePick = useCallback((ev) => pickRef.current(ev), [])
  const state = useMemo(
    () => ({ board: game.board, premiums: game.premiums, values: game.values, pending, last: game.last, canPlace: myTurn && selected != null && !used.has(selected) }),
    [game.board, game.premiums, game.values, pending, game.last, myTurn, selected], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const finished = game.phase === 'finished'
  let title
  if (finished) title = game.winner ? (game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`) : 'Empate'
  else if (myTurn) title = selected != null ? 'Toca una casilla del tablero' : pending.length ? 'Sigue armando tu palabra' : 'Te toca: elige una letra'
  else title = `Juega ${game.turn}…`
  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: game.scores[p],
    max: 0,
    stats: `${game.rackCounts[p]} letras`,
    active: !finished && game.turn === p,
  }))

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#EFE9DF, #D8CDBB)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={stablePick} label="Tablero de palabras cruzadas en 3D" />}
      overlay={
        <>
          {game.last?.bingo && <Confetti key={game.history?.length} colors={CONFETTI_COLORS} count={45} />}
          {drag?.moved && (
            <div className="pointer-events-none fixed z-50" style={{ left: drag.x - 22, top: drag.y - 22 }}>
              <Tile letter={game.rack[drag.idx]} value={game.values[game.rack[drag.idx]]} size="h-11 w-11 text-2xl" lifted />
            </div>
          )}
        </>
      }
      top={
        <>
          <Plates players={plates} />
          <div className="shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur">
            <p className="font-display text-xl font-extrabold tabular-nums leading-tight">{game.bag}</p>
            <p className="text-xs font-semibold text-muted">en la bolsa</p>
          </div>
        </>
      }
      bottom={
        <>
          <Banner title={title} color={finished ? (game.winner ? colorOf(game.winner) : undefined) : colorOf(game.turn)}>
            {game.phase === 'playing' && (pv?.error || pv?.words) && (
              <p className="text-xs font-semibold sm:text-sm">
                {pv?.error && <span className="text-muted">{pv.error}</span>}
                {pv?.words && (
                  <>
                    {pv.words.map((w) => `${w.word} (${w.points})`).join(' + ')}
                    {pv.bingo && ' + 50 por usar las 7'} = <span className="font-display text-base font-extrabold">{pv.score}</span>
                  </>
                )}
              </p>
            )}
          </Banner>
          <Flash flash={flash} />
          {game.phase === 'playing' && (
            <div className="pointer-events-auto flex w-full max-w-xl flex-col items-center gap-2">
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
            </div>
          )}
        </>
      }
      aside={
        <>
          <Side game={game} me={me} colorOf={colorOf} send={send} />
          <AnimatePresence>
            {blankAsk && (
              <Sheet onClose={() => setBlankAsk(null)}>
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
              </Sheet>
            )}
          </AnimatePresence>
        </>
      }
    />
  )
}
CrosswordsGame.showsErrors = true

/* --- board -------------------------------------------------------------- */

function Tile({ letter, value, blank, size = 'h-full w-full', pending, fresh, freshIndex = 0, lifted, dim }) {
  return (
    <span
      className={`relative flex items-center justify-center rounded-[18%] font-display font-extrabold leading-none ${size} ${fresh ? 'cw-drop' : pending ? 'cw-place' : ''}`}
      style={{
        animationDelay: fresh ? `${freshIndex * 70}ms` : undefined,
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

/* --- rack and buttons --------------------------------------------------- */

function Rack({ game, order, used, selected, swap, onSwapToggle, onPointerDown, onPointerMove, onPointerUp, myTurn }) {
  return (
    <div className="flex justify-center gap-1.5 rounded-2xl bg-paper/90 p-2 shadow-md backdrop-blur sm:gap-2">
      {order.map((i) => {
        const letter = game.rack[i]
        if (letter === undefined) return null
        const isUsed = used.has(i)
        const isSel = selected === i
        const inSwap = swap?.has(i)
        return (
          // tiles slide to their new place when shuffled and come up from the bag when drawn
          <motion.button
            key={`${i}-${letter}`}
            layout
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...spring, delay: 0.04 * order.indexOf(i) }}
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
          </motion.button>
        )
      })}
    </div>
  )
}

function Controls({ game, myTurn, pending, pv, swap, onSubmit, onRecall, onShuffle, onSwapStart, onSwapCancel, onSwapConfirm, onPass }) {
  const btn = 'rounded-2xl bg-paper/95 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-white disabled:opacity-40'
  if (swap) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full bg-paper/90 px-3 py-1 text-sm text-muted">Toca las letras que quieres cambiar.</span>
        <button onClick={onSwapConfirm} disabled={!swap.size} className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
          Cambiar {swap.size || ''}
        </button>
        <button onClick={onSwapCancel} className={btn}>Cancelar</button>
      </div>
    )
  }
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
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

/* --- side panel --------------------------------------------------------- */

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
    <section className="rounded-[1.6rem] bg-paper p-4">
      <p className="font-display text-2xl font-extrabold" style={{ color: finished ? (game.winner ? colorOf(game.winner) : undefined) : colorOf(game.turn) }}>{title}</p>
      <div className="mt-3 space-y-2">
        {game.players.map((p) => (
          <div key={p} className="relative flex items-center justify-between rounded-2xl bg-stone px-4 py-2.5">
            <span className="font-semibold" style={{ color: colorOf(p) }}>
              {p}
              {p === me && ' (tú)'}
              <span className="ml-2 text-xs font-normal text-muted">{game.rackCounts[p]} letras</span>
            </span>
            <AnimatedNumber value={game.scores[p]} className="font-display text-2xl font-extrabold" duration={0.9} />
            {/* the points of the last play float up next to the score */}
            <AnimatePresence>
              {game.last?.player === p && game.last.action === 'play' && (
                <motion.span
                  key={game.history?.length}
                  className="pointer-events-none absolute -top-2 right-3 rounded-full px-2 py-0.5 text-sm font-bold text-white"
                  style={{ background: colorOf(p) }}
                  initial={{ y: 10, opacity: 0, scale: 0.6 }}
                  animate={{ y: -8, opacity: [0, 1, 1, 0], scale: 1 }}
                  transition={{ duration: 1.8, times: [0, 0.15, 0.75, 1] }}
                >
                  +{game.last.score}
                </motion.span>
              )}
            </AnimatePresence>
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
    </section>
  )
}
