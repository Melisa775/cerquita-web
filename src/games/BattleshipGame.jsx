/**
 * Battleship on the 3D stage. While placing, pick a ship in the side panel
 * (or tap a placed one) and tap the sea to drop it there. In battle the sea
 * shows the enemy waters on your turn and your own fleet on theirs; you can
 * flip between them with the switch at the top.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Confetti } from '../lib/motion'
import { CONFETTI_COLORS, EndActions } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, BigAction, Flash, Panel, Plates, StageLayout, useFlash } from '../components/stage/hud'
import { cellsOf, clampShip, problems, randomFleet } from '../lib/battleship'

const HULL = 'hsl(214 16% 42%)'
const HIT = 'hsl(8 78% 52%)'
const load = () => import('../lib/three/battleship3d.js')

export default function BattleshipGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const flash = useFlash(error, errorId)
  return game.phase === 'placing' ? (
    <Placement game={game} me={me} send={send} colorOf={colorOf} flash={flash} />
  ) : (
    <Battle game={game} me={me} send={send} colorOf={colorOf} flash={flash} />
  )
}
BattleshipGame.showsErrors = true

const onGrid = (s) => s && s.kind === 'cell' ? s.id.split(',').map(Number) : null

/* --- fleet placement ---------------------------------------------------- */

function Placement({ game, me, send, colorOf, flash }) {
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
  const stageRef = useRef(null)

  useEffect(() => {
    if (ready) return
    const onKey = (e) => {
      if (e.key.toLowerCase() === 'r' && !e.target.closest?.('input, textarea, select')) setDir((d) => (d === 'h' ? 'v' : 'h'))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ready])

  const nextUnplaced = (list) => fleet.find((s) => !list.some((p) => p.id === s.id))?.id ?? null

  const onPick = useCallback(
    (data) => {
      const rc = onGrid(data)
      if (ready || !rc) return
      const [r, c] = rc
      const hit = placed.find((s) => cellsOf(s, lengths[s.id]).some(([rr, cc]) => rr === r && cc === c))
      if (hit && !selected) {
        // pick up an already placed ship
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
    },
    [ready, placed, selected, dir, lengths, size], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const onHover = useCallback((data) => setHover(onGrid(data)), [])

  const preview = useMemo(() => {
    if (ready || !selected || !hover) return null
    const s = { id: selected, ...clampShip(hover[0], hover[1], dir, lengths[selected], size) }
    const others = placed.filter((p) => p.id !== selected)
    return { ...s, length: lengths[selected], bad: problems([...others, s], lengths, size, noTouch).has(selected) }
  }, [ready, selected, hover, dir, lengths, size, placed, noTouch])

  const state = useMemo(
    () => ({ size, lengths, ships: placed.map((s) => ({ ...s, length: lengths[s.id], sunk: false })), preview, interactive: !ready }),
    [size, lengths, placed, preview, ready],
  )

  const selName = fleet.find((s) => s.id === selected)?.name
  let title
  let hint
  if (ready) {
    title = '¡Flota lista!'
    hint = game.ready[other] ? 'Empieza la batalla…' : `Esperando a que ${other} termine…`
  } else if (selected) {
    title = `Ubica tu ${selName.toLowerCase()}`
    hint = `Toca el mar. Va ${dir === 'h' ? 'horizontal ↔' : 'vertical ↕'}.${noTouch ? ' Sin tocarse, ni en diagonal.' : ''}`
  } else if (allPlaced && !bad.size) {
    title = 'Todo en su lugar'
    hint = 'Toca un barco para moverlo, o confirma.'
  } else {
    title = 'Ubica tu flota'
    hint = bad.size ? (noTouch ? 'Hay barcos encima de otros o tocándose.' : 'Hay barcos encima de otros.') : 'Elige un barco en la lista.'
  }

  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: p === me ? placed.length : game.ready[p] ? fleet.length : 0,
    max: fleet.length,
    stats: game.ready[p] ? 'Flota lista' : 'Ubicando…',
    active: !game.ready[p],
  }))

  const smallBtn = 'pointer-events-auto rounded-full bg-paper/95 px-4 py-2 text-sm font-bold shadow-md backdrop-blur hover:bg-white'

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#DDEFF8, #B5D9EE)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} onHover={onHover} label="Tu mar en 3D" />}
      top={<Plates players={plates} />}
      bottom={
        <>
          <Banner title={title} hint={hint} color={colorOf(me)} />
          <Flash flash={flash} />
          {!ready && (
            <div className="flex flex-wrap justify-center gap-2">
              <button className={smallBtn} onClick={() => setDir(dir === 'h' ? 'v' : 'h')}>Girar {dir === 'h' ? '↕' : '↔'}</button>
              <button
                className={smallBtn}
                onClick={() => {
                  setPlaced(randomFleet(fleet, size, noTouch))
                  setSelected(null)
                }}
              >
                🎲 Al azar
              </button>
            </div>
          )}
          {!ready && allPlaced && !bad.size && (
            <BigAction onClick={() => send({ type: 'bn_place', ships: placed })} color={colorOf(me)}>¡Listo!</BigAction>
          )}
          {ready && <BigAction onClick={() => send({ type: 'bn_unready' })} color={colorOf(me)} pulse={false}>Cambiar la ubicación</BigAction>}
        </>
      }
      aside={
        <>
          <Panel title="Tu flota" right={<span className="text-xs font-semibold text-muted">{placed.length}/{fleet.length}</span>}>
            <ul className="space-y-1.5">
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
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-2 text-left font-semibold transition-colors ${isSel ? 'bg-ink text-white' : 'bg-stone hover:bg-line'} ${bad.has(s.id) ? 'text-danger' : ''}`}
                    >
                      <span className="flex items-center gap-2">
                        {isPlaced && !isSel && <span aria-hidden="true">✓</span>}
                        {s.name}
                      </span>
                      <ShipDots length={s.length} color={isSel ? 'rgba(255,255,255,.8)' : isPlaced ? HULL : 'var(--color-line)'} />
                    </button>
                  </li>
                )
              })}
            </ul>
            {!ready && (
              <button
                onClick={() => {
                  setPlaced([])
                  setSelected(fleet[0].id)
                }}
                className="mt-3 w-full rounded-2xl border border-line px-3 py-2 text-sm font-semibold hover:border-ink"
              >
                Limpiar
              </button>
            )}
            <p className="mt-2 hidden text-xs text-muted sm:block">Atajo: R para girar.</p>
          </Panel>
          <Panel title="Cómo se juega">
            <ul className="space-y-1 text-sm text-muted">
              <li>Ubica tus barcos sin que el otro los vea.</li>
              <li>Por turnos, disparen a una casilla del mar enemigo.</li>
              <li>Si aciertas, sigues disparando.</li>
              <li>Gana quien hunda primero toda la flota contraria.</li>
            </ul>
          </Panel>
        </>
      }
    />
  )
}

function ShipDots({ length, color, size = 'h-3 w-3' }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length }, (_, i) => <span key={i} className={`${size} rounded-sm`} style={{ background: color }} />)}
    </span>
  )
}

/* --- battle ------------------------------------------------------------- */

function shotText(last, me, fleet) {
  if (!last) return null
  const you = last.by === me
  if (last.result === 'water') return you ? 'Agua.' : `${last.by} disparó al agua.`
  if (last.result === 'hit') return you ? '¡Tocado! Dispara otra vez.' : `${last.by} te dio en un barco.`
  const ship = fleet.find((s) => s.id === last.ship)?.name.toLowerCase() ?? 'barco'
  return you ? `¡Hundiste su ${ship}!` : `${last.by} hundió tu ${ship}.`
}

function Battle({ game, me, send, colorOf, flash }) {
  const other = game.players.find((p) => p !== me)
  const finished = game.phase === 'finished'
  const myTurn = !finished && game.turn === me
  const lengths = useMemo(() => Object.fromEntries(game.fleet.map((s) => [s.id, s.length])), [game.fleet])
  const last = game.lastShot
  const stageRef = useRef(null)

  // the sea follows the turn: theirs when you shoot, yours when they shoot
  // you choose which sea to look at; it starts on the enemy's when it's your turn
  const [view, setView] = useState(myTurn ? 'enemy' : 'mine')
  const showing = view
  const board = showing === 'enemy' ? game.boards[other] : game.boards[me]

  const state = useMemo(
    () => ({
      size: game.size,
      lengths,
      ships: board.ships,
      shots: board.shots,
      autoWater: board.autoWater,
      lastShot: last && (showing === 'enemy' ? last.by === me : last.by !== me) ? last : null,
      interactive: showing === 'enemy' && myTurn,
      skipShot: true,
      key: showing,
    }),
    [game.size, lengths, board, last, showing, myTurn, me],
  )

  const onPick = useCallback(
    (data) => {
      const rc = onGrid(data)
      if (rc && myTurn && showing === 'enemy') send({ type: 'bn_fire', row: rc[0], col: rc[1] })
    },
    [myTurn, showing, send],
  )

  const bonusTurn = last && last.by === me && last.result !== 'water' && myTurn
  let title
  if (finished) title = game.winner === me ? '¡Ganaste la batalla!' : `Ganó ${game.winner}`
  else if (myTurn) title = bonusTurn ? '¡Sigue disparando!' : '¡Te toca disparar!'
  else title = `Dispara ${game.turn}…`
  const hint = shotText(last, me, game.fleet) ?? (myTurn ? 'Toca una casilla del mar enemigo.' : null)

  const plates = game.players.map((p) => {
    const ships = game.boards[p].ships
    const sunk = ships.filter((s) => s.sunk).length
    return {
      name: p,
      you: p === me,
      color: colorOf(p),
      value: game.fleet.length - sunk,
      max: game.fleet.length,
      stats: `${game.fleet.length - sunk} barcos a flote`,
      active: game.turn === p && !finished,
    }
  })

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#DDEFF8, #B5D9EE)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label={showing === 'enemy' ? `Mar de ${other} en 3D` : 'Tu mar en 3D'} />}
      overlay={finished && game.winner === me && <Confetti colors={CONFETTI_COLORS} />}
      top={
        <>
          <Plates players={plates} />
          <div className="pointer-events-auto flex shrink-0 rounded-full bg-paper/95 p-1 text-sm font-bold shadow-md backdrop-blur" role="tablist" aria-label="Qué mar ver">
            {[
              ['enemy', '🎯 Su mar', other],
              ['mine', '⚓ Tu mar', me],
            ].map(([k, label, who]) => (
              <button
                key={k}
                role="tab"
                aria-selected={showing === k}
                onClick={() => setView(k)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${showing === k ? 'text-white' : 'text-muted hover:text-ink'}`}
                style={showing === k ? { background: colorOf(who) } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      }
      bottom={
        <>
          <Banner key={`${last?.row}-${last?.col}-${last?.by}`} title={title} hint={hint} color={colorOf(finished ? game.winner : game.turn)} />
          <Flash flash={flash} />
          {myTurn && showing !== 'enemy' && (
            <BigAction onClick={() => setView('enemy')} color={colorOf(me)}>🎯 Ir a disparar</BigAction>
          )}
        </>
      }
      aside={
        <>
          {finished && (
            <Panel title="Fin de la batalla">
              <div className="grid grid-cols-2 gap-2">
                {game.players.map((p) => {
                  const s = game.stats[p]
                  const pct = s.shots ? Math.round((s.hits / s.shots) * 100) : 0
                  return (
                    <div key={p} className="rounded-2xl bg-stone px-3 py-2">
                      <p className="truncate text-sm font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
                      <p className="font-display text-3xl font-extrabold tabular-nums">{pct}%</p>
                      <p className="text-xs text-muted">{s.hits} aciertos en {s.shots} disparos</p>
                    </div>
                  )
                })}
              </div>
              <EndActions send={send} replay={{ type: 'start_game', game: 'battleship', ...game.options }} />
            </Panel>
          )}
          {[
            [`Flota de ${other}`, other],
            ['Tu flota', me],
          ].map(([t, p]) => {
            const sunkIds = new Set(game.boards[p].ships.filter((s) => s.sunk).map((s) => s.id))
            return (
              <Panel key={p} title={<span style={{ color: colorOf(p) }}>{t}</span>}>
                <ul className="space-y-1">
                  {game.fleet.map((s) => (
                    <li key={s.id} className={`flex items-center justify-between gap-2 text-sm ${sunkIds.has(s.id) ? 'text-muted line-through' : 'font-semibold'}`}>
                      {s.name}
                      <ShipDots length={s.length} size="h-2.5 w-2.5" color={sunkIds.has(s.id) ? HIT : HULL} />
                    </li>
                  ))}
                </ul>
              </Panel>
            )
          })}
        </>
      }
    />
  )
}
