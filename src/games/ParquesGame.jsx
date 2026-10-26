import { useEffect, useMemo, useState } from 'react'
import { EndActions } from '../components/EndActions'
import { ARM, N, jailOrigin, laneCell, pathCell, toView, viewRotation } from '../lib/parques'

const HOME = 71
const NEUTRAL = '#D9DBE0'
const CELL = '#FBFAF6'

const DIE_PIPS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
}

export default function ParquesGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const myTurn = game.turn === me && game.phase !== 'finished'
  const [die, setDie] = useState(0)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (game.unused.length) setDie(game.unused[0])
  }, [game.rollId, game.unused])
  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  // En computador: espacio o Enter para lanzar
  useEffect(() => {
    if (!(myTurn && game.phase === 'roll')) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, button')) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        send({ type: 'pa_roll' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [myTurn, game.phase, send])

  function clickPiece(player, i) {
    if (!myTurn || player !== me) return
    if (game.phase === 'bonus') {
      if (game.pieces[me][i] !== HOME) send({ type: 'pa_bonus', piece: i })
      return
    }
    const options = game.moves.filter((m) => m.piece === i)
    if (!options.length) return
    const pick = options.find((m) => m.die === die) ?? options[0]
    send({ type: 'pa_move', piece: i, die: pick.die })
  }

  const movable = new Set(
    game.phase === 'bonus' && myTurn
      ? game.pieces[me].map((p, i) => (p !== HOME ? i : null)).filter((i) => i !== null)
      : game.moves.filter((m) => m.die === die || !game.moves.some((x) => x.piece === m.piece && x.die === die)).map((m) => m.piece),
  )

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="mx-auto w-full max-w-[38rem]">
        <Board game={game} me={me} colorOf={colorOf} movable={myTurn ? movable : new Set()} onPiece={clickPiece} />
      </div>
      <aside className="rounded-[2rem] bg-paper p-5">
        <Status game={game} me={me} other={other} colorOf={colorOf} />
        <Dice game={game} me={me} myTurn={myTurn} die={die} setDie={setDie} colorOf={colorOf} />
        {myTurn && game.phase === 'roll' && (
          <button onClick={() => send({ type: 'pa_roll' })} autoFocus className="mt-4 w-full rounded-2xl bg-ink px-5 py-3.5 font-display text-xl font-extrabold text-white">
            Lanzar dados
          </button>
        )}
        {myTurn && game.canRelease && (
          <button onClick={() => send({ type: 'pa_release' })} className="mt-3 w-full rounded-2xl px-5 py-3 font-semibold text-white" style={{ background: colorOf(me) }}>
            Sacar de la cárcel (usa los pares)
          </button>
        )}
        {myTurn && game.phase === 'move' && (
          <p className="mt-3 text-sm text-muted">
            Elige un dado y toca la ficha que quieres mover. {game.moves.length === 0 && 'No tienes jugadas con estos dados.'}
          </p>
        )}
        {myTurn && game.phase === 'bonus' && (
          <p className="mt-3 rounded-2xl bg-ink px-4 py-3 text-sm font-semibold text-white">¡Tercer par seguido! Toca la ficha que quieres mandar al cielo.</p>
        )}
        <Progress game={game} me={me} colorOf={colorOf} />
        <Log game={game} me={me} colorOf={colorOf} />
        {game.phase === 'finished' && <EndActions send={send} replay={{ type: 'start_game', game: 'parques', ...game.options }} />}
        <p role="status" className="mt-2 min-h-5 text-sm font-medium text-danger">{flash}</p>
      </aside>
    </div>
  )
}
ParquesGame.showsErrors = true

/* --- tablero ------------------------------------------------------------ */

function Board({ game, me, colorOf, movable, onPiece }) {
  const myArm = game.arms[me]
  const turns = viewRotation(myArm)
  const armOwner = useMemo(() => Object.fromEntries(Object.entries(game.arms).map(([p, k]) => [k, p])), [game.arms])
  const tint = (k, alpha = 0.22) => (armOwner[k] ? `color-mix(in srgb, ${colorOf(armOwner[k])} ${alpha * 100}%, white)` : NEUTRAL)
  const safe = new Set(game.safe)
  const place = (cell) => {
    const [r, c] = toView(cell, turns)
    return { gridRow: r + 1, gridColumn: c + 1 }
  }

  // fichas por casilla del circuito y de la llegada
  const byCell = new Map()
  const add = (key, entry) => byCell.set(key, [...(byCell.get(key) ?? []), entry])
  for (const p of game.players) {
    game.pieces[p].forEach((prog, i) => {
      if (prog >= 0 && prog <= 63) add(`p${game.squares[p][i]}`, { p, i })
      else if (prog >= 64 && prog < HOME) add(`l${game.arms[p]}-${prog - 64}`, { p, i })
    })
  }
  const last = [...game.log].reverse().find((l) => l.action === 'move')

  const cells = []
  for (let idx = 0; idx < 4 * ARM; idx++) {
    const k = Math.floor(idx / ARM)
    const o = idx % ARM
    const isExit = o === 13
    const isSafe = safe.has(idx)
    const bg = isExit ? tint(k, 0.55) : CELL
    cells.push(
      <div key={`p${idx}`} className="relative flex items-center justify-center rounded-[3px]" style={{ ...place(pathCell(idx)), background: bg, boxShadow: 'inset 0 0 0 1px rgba(34,37,46,.12)' }}>
        {isSafe && !isExit && <SafeMark />}
        <Stack entries={byCell.get(`p${idx}`)} colorOf={colorOf} movable={movable} me={me} onPiece={onPiece} last={last} />
      </div>,
    )
  }
  for (let k = 0; k < 4; k++) {
    for (let j = 0; j < 7; j++) {
      cells.push(
        <div key={`l${k}-${j}`} className="relative flex items-center justify-center rounded-[3px]" style={{ ...place(laneCell(k, j)), background: tint(k, 0.35), boxShadow: 'inset 0 0 0 1px rgba(34,37,46,.1)' }}>
          <Stack entries={byCell.get(`l${k}-${j}`)} colorOf={colorOf} movable={movable} me={me} onPiece={onPiece} last={last} />
        </div>,
      )
    }
  }

  // cárceles
  const jails = [0, 1, 2, 3].map((k) => {
    const [r0, c0] = jailOrigin(k)
    const a = toView([r0, c0], turns)
    const b = toView([r0 + 7, c0 + 7], turns)
    const owner = armOwner[k]
    const jailed = owner ? game.pieces[owner].map((p, i) => ({ p: owner, i, prog: p })).filter((x) => x.prog === -1) : []
    return (
      <div
        key={`j${k}`}
        className="m-[6%] flex flex-col items-center justify-center rounded-2xl"
        style={{
          gridRow: `${Math.min(a[0], b[0]) + 1} / span 8`,
          gridColumn: `${Math.min(a[1], b[1]) + 1} / span 8`,
          background: owner ? tint(k, 0.85) : NEUTRAL,
        }}
      >
        {owner && (
          <>
            <span className="mb-1 truncate px-2 text-xs font-bold text-white sm:text-sm">{owner}</span>
            <div className="grid grid-cols-2 gap-[8%] rounded-xl bg-white/85 p-[8%]" style={{ width: '62%' }}>
              {Array.from({ length: game.options.pieces }, (_, slot) => {
                const x = jailed[slot]
                return (
                  <div key={slot} className="flex aspect-square items-center justify-center rounded-full" style={{ background: 'rgba(34,37,46,.08)' }}>
                    {x && <Piece color={colorOf(owner)} active={owner === me && movable.has(x.i)} onClick={() => onPiece(owner, x.i)} />}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    )
  })

  // cielo
  const heaven = game.players.flatMap((p) => game.pieces[p].map((prog, i) => ({ p, i, prog })).filter((x) => x.prog === HOME))
  const ca = toView([8, 8], turns)
  const cb = toView([10, 10], turns)

  return (
    <div className="grid aspect-square w-full gap-[2px] rounded-[1.6rem] bg-paper p-2 shadow-sm" style={{ gridTemplateColumns: `repeat(${N}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${N}, minmax(0, 1fr))` }}>
      {jails}
      {cells}
      <div
        className="flex flex-wrap content-center items-center justify-center gap-[6%] rounded-xl p-1"
        style={{ gridRow: `${Math.min(ca[0], cb[0]) + 1} / span 3`, gridColumn: `${Math.min(ca[1], cb[1]) + 1} / span 3`, background: 'conic-gradient(from 45deg, #F7E3A1, #F3C4D3, #BFE3E0, #F7E3A1)' }}
        title="Cielo"
      >
        {heaven.map((x) => (
          <span key={`${x.p}${x.i}`} className="h-[22%] w-[22%] rounded-full" style={{ background: colorOf(x.p), boxShadow: '0 0 0 1.5px white' }} />
        ))}
        {!heaven.length && <span className="text-[0.55rem] font-bold text-ink/50 sm:text-xs">CIELO</span>}
      </div>
    </div>
  )
}

function SafeMark() {
  return (
    <svg viewBox="0 0 24 24" className="absolute h-[70%] w-[70%]" aria-hidden="true">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="rgba(34,37,46,.14)" />
    </svg>
  )
}

function Stack({ entries, colorOf, movable, me, onPiece, last }) {
  if (!entries?.length) return null
  if (entries.length === 1) {
    const { p, i } = entries[0]
    const fresh = last && last.player === p && last.piece === i
    return <Piece color={colorOf(p)} active={p === me && movable.has(i)} onClick={() => onPiece(p, i)} fresh={fresh} />
  }
  return (
    <div className="absolute inset-0 grid grid-cols-2 place-items-center p-[4%]">
      {entries.slice(0, 4).map(({ p, i }) => (
        <Piece key={`${p}${i}`} small color={colorOf(p)} active={p === me && movable.has(i)} onClick={() => onPiece(p, i)} />
      ))}
    </div>
  )
}

function Piece({ color, active, onClick, small, fresh }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!active}
      className={`relative z-10 rounded-full ${small ? 'h-[90%] w-[90%]' : 'h-[78%] w-[78%]'} ${active ? 'parques-ready cursor-pointer' : ''} ${fresh ? 'pop' : ''}`}
      style={{ background: color, boxShadow: `inset 0 -2px 0 rgba(0,0,0,.25), 0 0 0 ${small ? 1 : 2}px white` }}
      aria-label={active ? 'Mover esta ficha' : 'Ficha'}
    />
  )
}

/* --- panel ---------------------------------------------------------------- */

function Status({ game, me, other, colorOf }) {
  let title
  if (game.phase === 'finished') title = game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`
  else if (game.turn === me) title = game.phase === 'roll' ? (game.pairsInRow ? '¡Pares! Tira otra vez' : 'Te toca') : game.phase === 'bonus' ? '¡Premio!' : 'Mueve tus fichas'
  else title = `Juega ${game.turn}…`
  return (
    <div>
      <p className="font-display text-3xl font-extrabold" style={{ color: colorOf(game.phase === 'finished' ? game.winner : game.turn) }}>{title}</p>
      {game.attemptsLeft != null && game.phase === 'roll' && game.phase !== 'finished' && (
        <p className="mt-1 text-sm text-muted">
          {game.turn === me ? 'Necesitas pares para salir de la cárcel.' : `${other} necesita pares para salir.`} Intentos: {game.attemptsLeft}
        </p>
      )}
    </div>
  )
}

function DieFace({ value, used, selected, rolling, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl p-0 transition-transform ${rolling ? 'parques-roll' : ''} ${selected ? '-translate-y-1' : ''}`}
      style={{ opacity: used ? 0.3 : 1 }}
      aria-label={`Dado ${value}${used ? ', usado' : ''}`}
    >
      <svg viewBox="0 0 100 100" className="h-16 w-16 sm:h-[4.5rem] sm:w-[4.5rem]">
        <rect x="4" y="4" width="92" height="92" rx="20" fill="white" stroke={selected ? color : '#CDCFD5'} strokeWidth={selected ? 7 : 3} />
        {DIE_PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="8.5" fill="#22252E" />)}
      </svg>
    </button>
  )
}

function Dice({ game, me, myTurn, die, setDie, colorOf }) {
  if (!game.dice) return <p className="mt-4 text-sm text-muted">Nadie ha lanzado todavía.</p>
  const pair = game.dice[0] === game.dice[1]
  const choosing = myTurn && game.phase === 'move'
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        {game.dice.map((v, i) => (
          <DieFace
            key={`${game.rollId}-${i}`}
            value={v}
            rolling
            used={game.phase === 'move' ? !game.unused.includes(i) : false}
            selected={choosing && die === i && game.unused.includes(i)}
            onClick={choosing && game.unused.includes(i) ? () => setDie(i) : undefined}
            color={colorOf(me)}
          />
        ))}
        {pair && <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">¡Pares!</span>}
      </div>
    </div>
  )
}

function Progress({ game, me, colorOf }) {
  return (
    <div className="mt-5 space-y-2">
      {game.players.map((p) => {
        const pcs = game.pieces[p]
        const home = pcs.filter((x) => x === HOME).length
        const jail = pcs.filter((x) => x === -1).length
        return (
          <div key={p} className="flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</span>
            <span className="text-muted">
              {home}/{pcs.length} en el cielo · {jail} en la cárcel
            </span>
          </div>
        )
      })}
    </div>
  )
}

function describe(l, me) {
  const you = l.player === me
  const who = you ? '' : `${l.player} `
  switch (l.action) {
    case 'roll':
      return `${you ? 'Sacaste' : `${l.player} sacó`} ${l.dice[0]} y ${l.dice[1]}`
    case 'release':
      return `${you ? 'Sacaste' : `${who}sacó`} ${l.count} ${l.count === 1 ? 'ficha' : 'fichas'} de la cárcel`
    case 'move':
      return l.to === HOME ? `${you ? '¡Metiste' : `¡${who}metió`} una ficha al cielo!` : `${you ? 'Moviste' : `${who}movió`} ${l.steps}`
    case 'capture':
      return `${you ? '¡Te comiste' : `¡${who}se comió`} ${l.count === 1 ? 'una ficha' : `${l.count} fichas`}!`
    case 'lost':
      return `${you ? 'Perdiste' : `${who}perdió`} ${l.dice.length === 1 ? `el ${l.dice[0]}` : 'los dos dados'}: no había jugada`
    case 'no_luck':
      return `${you ? 'No sacaste' : `${who}no sacó`} pares en tres intentos`
    case 'bonus':
      return `${you ? 'Mandaste' : `${who}mandó`} una ficha directo al cielo`
    default:
      return ''
  }
}

function Log({ game, me, colorOf }) {
  const items = [...game.log].reverse().slice(0, 5)
  if (!items.length) return null
  return (
    <ul className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
      {items.map((l, i) => (
        <li key={`${game.log.length}-${i}`} className={i === 0 ? 'pop font-semibold' : 'text-muted'}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(l.player) }} />
          {describe(l, me)}
        </li>
      ))}
    </ul>
  )
}
