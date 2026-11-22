import { useEffect, useMemo, useState } from 'react'
import { EndActions } from '../components/EndActions'
import { COLS, cellsOf, clampShip, problems, randomFleet } from '../lib/battleship'

const SEA = 'hsl(200 58% 90%)'
const SEA_LINE = 'hsl(200 40% 78%)'
const HULL = 'hsl(214 16% 42%)'
const HIT = 'hsl(8 78% 52%)'

export default function BattleshipGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const [flash, setFlash] = useState(null)
  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  return (
    <div className="mt-4">
      {game.phase === 'placing' ? (
        <Placement game={game} me={me} send={send} colorOf={colorOf} />
      ) : (
        <Battle game={game} me={me} send={send} colorOf={colorOf} />
      )}
      <p role="status" className="mt-3 min-h-6 text-center text-sm font-medium text-danger">{flash}</p>
    </div>
  )
}
BattleshipGame.showsErrors = true

/* --- cuadrícula --------------------------------------------------------- */

function Grid({ size, ships = [], lengths, shots = [], autoWater = [], preview, onCell, onHover, clickable, lastShot, label, compact }) {
  const shotMap = useMemo(() => new Map(shots.map(([r, c, v]) => [`${r},${c}`, v])), [shots])
  const autoSet = useMemo(() => new Set(autoWater.map(([r, c]) => `${r},${c}`)), [autoWater])
  const previewSet = useMemo(() => new Set((preview?.cells ?? []).map(([r, c]) => `${r},${c}`)), [preview])
  const cellPct = 100 / size

  return (
    <div className={`select-none ${compact ? 'text-[0.55rem]' : 'text-[0.65rem] sm:text-xs'}`} aria-label={label}>
      <div className="grid font-semibold text-muted" style={{ gridTemplateColumns: `1.2rem repeat(${size}, minmax(0, 1fr))` }}>
        <span />
        {Array.from({ length: size }, (_, c) => (
          <span key={c} className="pb-0.5 text-center">{COLS[c]}</span>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: `1.2rem minmax(0, 1fr)` }}>
        <div className="grid font-semibold text-muted" style={{ gridTemplateRows: `repeat(${size}, minmax(0, 1fr))` }}>
          {Array.from({ length: size }, (_, r) => (
            <span key={r} className="flex items-center justify-center">{r + 1}</span>
          ))}
        </div>
        <div
          className="relative aspect-square overflow-hidden rounded-lg"
          style={{ background: SEA, boxShadow: `inset 0 0 0 1px ${SEA_LINE}` }}
          onMouseLeave={() => onHover?.(null)}
        >
          {/* barcos */}
          {ships.map((s) => {
            const len = s.length ?? lengths[s.id]
            return (
              <Ship key={s.id} ship={s} length={len} cellPct={cellPct} />
            )
          })}
          {/* vista previa al ubicar */}
          {preview && (
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                left: `${preview.col * cellPct}%`,
                top: `${preview.row * cellPct}%`,
                width: `${(preview.dir === 'h' ? preview.length : 1) * cellPct}%`,
                height: `${(preview.dir === 'v' ? preview.length : 1) * cellPct}%`,
                padding: `${cellPct * 0.12}%`,
              }}
            >
              <div className="h-full w-full rounded-full" style={{ background: preview.bad ? 'rgba(214,48,49,.45)' : 'rgba(34,37,46,.35)' }} />
            </div>
          )}
          {/* casillas */}
          <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${size}, 1fr)`, gridTemplateRows: `repeat(${size}, 1fr)` }}>
            {Array.from({ length: size * size }, (_, i) => {
              const r = Math.floor(i / size)
              const c = i % size
              const k = `${r},${c}`
              const shot = shotMap.get(k)
              const auto = autoSet.has(k)
              const canClick = clickable && !shot && !auto
              const isLast = lastShot && lastShot.row === r && lastShot.col === c
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!onCell || (clickable !== undefined && !canClick)}
                  onClick={() => onCell?.(r, c)}
                  onMouseEnter={() => onHover?.([r, c])}
                  className={`relative flex items-center justify-center ${canClick ? 'cursor-crosshair hover:bg-ink/10' : ''} ${previewSet.has(k) ? '' : ''}`}
                  style={{ boxShadow: `inset -1px -1px 0 ${SEA_LINE}` }}
                  aria-label={`${COLS[c]}${r + 1}${shot === 'hit' ? ', tocado' : shot === 'water' ? ', agua' : ''}`}
                >
                  {shot === 'water' && <span key={isLast ? 'last' : 'w'} className={`h-[26%] w-[26%] rounded-full ${isLast ? 'bn-splash' : ''}`} style={{ background: 'hsl(205 45% 55%)' }} />}
                  {auto && <span className="h-[18%] w-[18%] rounded-full" style={{ background: 'hsl(205 30% 70%)' }} />}
                  {shot === 'hit' && (
                    <span key={isLast ? 'last' : 'h'} className={`flex h-[62%] w-[62%] items-center justify-center rounded-full ${isLast ? 'bn-boom' : ''}`} style={{ background: HIT, boxShadow: '0 0 0 2px rgba(255,255,255,.7)' }}>
                      <svg viewBox="0 0 10 10" className="h-[60%] w-[60%]" aria-hidden="true">
                        <path d="M2 2l6 6M8 2l-6 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </span>
                  )}
                  {isLast && <span className="pointer-events-none absolute inset-[6%] rounded-md" style={{ boxShadow: '0 0 0 2px var(--color-ink)' }} />}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Ship({ ship, length, cellPct }) {
  const horizontal = ship.dir === 'h'
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: `${ship.col * cellPct}%`,
        top: `${ship.row * cellPct}%`,
        width: `${(horizontal ? length : 1) * cellPct}%`,
        height: `${(horizontal ? 1 : length) * cellPct}%`,
        padding: `${cellPct * 0.1}%`,
      }}
    >
      <div
        className="flex h-full w-full items-center justify-around"
        style={{
          background: ship.sunk ? 'hsl(214 10% 30%)' : HULL,
          borderRadius: 9999,
          flexDirection: horizontal ? 'row' : 'column',
          opacity: ship.sunk ? 0.75 : 1,
        }}
      >
        {Array.from({ length }, (_, i) => (
          <span key={i} className="rounded-full" style={{ width: '22%', aspectRatio: 1, maxWidth: 10, background: 'rgba(255,255,255,.35)' }} />
        ))}
      </div>
    </div>
  )
}

/* --- ubicar la flota ---------------------------------------------------- */

function Placement({ game, me, send, colorOf }) {
  const { size, fleet } = game
  const noTouch = game.options.noTouch
  const lengths = useMemo(() => Object.fromEntries(fleet.map((s) => [s.id, s.length])), [fleet])
  const mineOnServer = game.boards[me]?.ships ?? []
  const [placed, setPlaced] = useState(() => mineOnServer.map(({ id, row, col, dir }) => ({ id, row, col, dir })))
  const [selected, setSelected] = useState(() => fleet.find((s) => !mineOnServer.some((p) => p.id === s.id))?.id ?? null)
  const [dir, setDir] = useState('h')
  const [hover, setHover] = useState(null)
  const ready = game.ready[me]
  const other = game.players.find((p) => p !== me)
  const bad = problems(placed, lengths, size, noTouch)
  const allPlaced = placed.length === fleet.length

  useEffect(() => {
    if (ready) return
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'r' && !e.target.closest?.('input, textarea, select')) setDir((d) => (d === 'h' ? 'v' : 'h'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready])

  function nextUnplaced(list) {
    return fleet.find((s) => !list.some((p) => p.id === s.id))?.id ?? null
  }

  function onCell(r, c) {
    if (ready) return
    const hit = placed.find((s) => cellsOf(s, lengths[s.id]).some(([rr, cc]) => rr === r && cc === c))
    if (hit && !selected) {
      // recoger un barco ya ubicado
      setPlaced(placed.filter((s) => s.id !== hit.id))
      setSelected(hit.id)
      setDir(hit.dir)
      return
    }
    if (!selected) return
    const ship = { id: selected, ...clampShip(r, c, dir, lengths[selected], size) }
    const list = [...placed.filter((s) => s.id !== selected), ship]
    setPlaced(list)
    setSelected(nextUnplaced(list))
  }

  const preview = !ready && selected && hover
    ? (() => {
        const s = { id: selected, ...clampShip(hover[0], hover[1], dir, lengths[selected], size) }
        const others = placed.filter((p) => p.id !== selected)
        const isBad = problems([...others, s], lengths, size, noTouch).has(selected)
        return { ...s, length: lengths[selected], cells: cellsOf(s, lengths[selected]), bad: isBad }
      })()
    : null

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
      <div className="mx-auto w-full max-w-[34rem]">
        <Grid
          size={size}
          ships={placed.map((s) => ({ ...s, length: lengths[s.id], sunk: false }))}
          lengths={lengths}
          preview={preview}
          onCell={ready ? undefined : onCell}
          onHover={setHover}
          label="Tu tablero"
        />
        {bad.size > 0 && (
          <p className="mt-2 text-center text-sm font-medium text-danger">
            {noTouch ? 'Hay barcos encima de otros o tocándose.' : 'Hay barcos encima de otros.'}
          </p>
        )}
      </div>

      <aside className="rounded-[2rem] bg-paper p-5">
        <h1 className="font-display text-3xl font-extrabold">{ready ? '¡Flota lista!' : 'Ubica tu flota'}</h1>
        <p className="mt-1 text-sm text-muted">
          {ready
            ? `Esperando a que ${other} termine…`
            : 'Elige un barco y tócalo en el tablero. Toca uno ya ubicado para moverlo.'}
          {!ready && noTouch && ' Los barcos no se pueden tocar, ni en diagonal.'}
        </p>

        <ul className="mt-4 space-y-1.5">
          {fleet.map((s) => {
            const isPlaced = placed.some((p) => p.id === s.id)
            const isSel = selected === s.id
            return (
              <li key={s.id}>
                <button
                  disabled={ready}
                  onClick={() => {
                    setPlaced(placed.filter((p) => p.id !== s.id))
                    setSelected(isSel ? null : s.id)
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left font-semibold ${isSel ? 'bg-ink text-white' : 'bg-stone'} ${bad.has(s.id) ? 'text-danger' : ''}`}
                >
                  <span className="flex items-center gap-2">
                    {isPlaced && !isSel && <span aria-hidden="true">✓</span>}
                    {s.name}
                  </span>
                  <span className="flex gap-0.5">
                    {Array.from({ length: s.length }, (_, i) => (
                      <span key={i} className="h-3 w-3 rounded-sm" style={{ background: isSel ? 'rgba(255,255,255,.8)' : isPlaced ? HULL : 'var(--color-line)' }} />
                    ))}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>

        {!ready && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <button onClick={() => setDir(dir === 'h' ? 'v' : 'h')} className="rounded-2xl border border-line px-2 py-2.5 text-sm font-semibold hover:border-ink">
                Girar {dir === 'h' ? '↔' : '↕'}
              </button>
              <button
                onClick={() => {
                  const list = randomFleet(fleet, size, noTouch)
                  setPlaced(list)
                  setSelected(null)
                }}
                className="rounded-2xl border border-line px-2 py-2.5 text-sm font-semibold hover:border-ink"
              >
                Al azar
              </button>
              <button
                onClick={() => {
                  setPlaced([])
                  setSelected(fleet[0].id)
                }}
                className="rounded-2xl border border-line px-2 py-2.5 text-sm font-semibold hover:border-ink"
              >
                Limpiar
              </button>
            </div>
            <p className="mt-2 hidden text-xs text-muted sm:block">Atajo: R para girar.</p>
            <button
              onClick={() => send({ type: 'bn_place', ships: placed })}
              disabled={!allPlaced || bad.size > 0}
              className="mt-4 w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"
            >
              ¡Listo!
            </button>
          </>
        )}
        {ready && (
          <button onClick={() => send({ type: 'bn_unready' })} className="mt-4 w-full rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink">
            Cambiar la ubicación
          </button>
        )}
        <p className="mt-4 text-sm">
          <span className="font-semibold" style={{ color: colorOf(other) }}>{other}</span>{' '}
          <span className="text-muted">{game.ready[other] ? 'ya tiene su flota lista.' : 'todavía está ubicando.'}</span>
        </p>
      </aside>
    </div>
  )
}

/* --- batalla ------------------------------------------------------------ */

function shotText(last, me, fleet) {
  if (!last) return null
  const you = last.by === me
  if (last.result === 'water') return you ? 'Agua.' : `${last.by} disparó al agua.`
  if (last.result === 'hit') return you ? '¡Tocado! Dispara otra vez.' : `${last.by} te dio en un barco.`
  const ship = fleet.find((s) => s.id === last.ship)?.name.toLowerCase() ?? 'barco'
  return you ? `¡Hundiste su ${ship}!` : `${last.by} hundió tu ${ship}.`
}

function Battle({ game, me, send, colorOf }) {
  const other = game.players.find((p) => p !== me)
  const finished = game.phase === 'finished'
  const myTurn = !finished && game.turn === me
  const lengths = Object.fromEntries(game.fleet.map((s) => [s.id, s.length]))
  const enemy = game.boards[other]
  const mine = game.boards[me]
  const last = game.lastShot
  const text = shotText(last, me, game.fleet)
  const bonusTurn = last && last.by === me && last.result !== 'water' && myTurn

  let title
  if (finished) title = game.winner === me ? '¡Ganaste la batalla!' : `Ganó ${game.winner}`
  else if (myTurn) title = bonusTurn ? '¡Sigue disparando!' : '¡Te toca disparar!'
  else title = `Dispara ${game.turn}…`

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl" style={{ color: finished ? colorOf(game.winner) : colorOf(game.turn) }}>
            {title}
          </h1>
          <p key={`${last?.row}-${last?.col}-${last?.by}`} className="pop mt-1 min-h-6 font-semibold text-muted">{text}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <section className={`rounded-[2rem] bg-paper p-4 sm:p-5 transition-shadow ${myTurn ? 'ring-4' : ''}`} style={myTurn ? { '--tw-ring-color': colorOf(me) } : undefined}>
          <BoardHeader title={`Flota de ${other}`} color={colorOf(other)} board={enemy} fleet={game.fleet} />
          <Grid
            size={game.size}
            ships={enemy.ships}
            lengths={lengths}
            shots={enemy.shots}
            autoWater={enemy.autoWater}
            onCell={myTurn ? (r, c) => send({ type: 'bn_fire', row: r, col: c }) : undefined}
            clickable={myTurn}
            lastShot={last && last.by === me ? last : null}
            label={`Tablero de ${other}`}
          />
          {myTurn && <p className="mt-2 text-center text-sm text-muted">Toca una casilla para disparar.</p>}
        </section>

        <section className="mx-auto w-full max-w-[24rem] rounded-[2rem] bg-paper p-4 sm:p-5 lg:max-w-none">
          <BoardHeader title="Tu flota" color={colorOf(me)} board={mine} fleet={game.fleet} />
          <Grid
            size={game.size}
            ships={mine.ships}
            lengths={lengths}
            shots={mine.shots}
            autoWater={mine.autoWater}
            lastShot={last && last.by !== me ? last : null}
            label="Tu tablero"
            compact
          />
        </section>
      </div>

      {finished && (
        <div className="mt-6">
          <div className="flex flex-wrap gap-3">
            {game.players.map((p) => {
              const s = game.stats[p]
              const pct = s.shots ? Math.round((s.hits / s.shots) * 100) : 0
              return (
                <div key={p} className="rounded-2xl bg-paper px-5 py-3">
                  <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
                  <p className="font-display text-3xl font-extrabold tabular-nums">{pct}%</p>
                  <p className="text-xs text-muted">{s.hits} aciertos en {s.shots} disparos</p>
                </div>
              )
            })}
          </div>
          <EndActions send={send} replay={{ type: 'start_game', game: 'battleship', ...game.options }} />
        </div>
      )}
    </div>
  )
}

function BoardHeader({ title, color, board, fleet }) {
  const sunkIds = new Set(board.ships.filter((s) => s.sunk).map((s) => s.id))
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold" style={{ color }}>{title}</h2>
      <ul className="flex flex-wrap gap-1.5" aria-label="Barcos">
        {fleet.map((s) => (
          <li key={s.id} title={`${s.name}${sunkIds.has(s.id) ? ' (hundido)' : ''}`} className="flex gap-0.5" style={{ opacity: sunkIds.has(s.id) ? 0.35 : 1 }}>
            {Array.from({ length: s.length }, (_, i) => (
              <span key={i} className="h-2 w-2 rounded-sm" style={{ background: sunkIds.has(s.id) ? HIT : HULL }} />
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}
