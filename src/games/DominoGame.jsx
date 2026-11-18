/**
 * Dominoes on the 3D stage. Tap a glowing tile in your hand to play it; if it
 * fits both ends, tap the end where it goes. With no move, draw from the boneyard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import DominoTile from '../components/DominoTile'
import { EndActions } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, BigAction, Flash, LogList, Panel, Plates, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'

const sameTile = (t, u) => t && u && t[0] === u[0] && t[1] === u[1]
const load = () => import('../lib/three/domino3d.js')

export default function DominoGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const [selected, setSelected] = useState(null) // tile that fits on both ends
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  useEffect(() => setSelected(null), [game.line.length, game.phase, game.handNo])

  const myTurn = game.phase === 'playing' && game.turn === me
  const onPick = useCallback(
    ({ kind, id }) => {
      if (!myTurn) return
      if (kind === 'pile') return send({ type: 'dm_draw' })
      if (kind === 'end') return selected && send({ type: 'dm_play', tile: selected, side: id })
      if (kind !== 'tile') return
      const tile = id.split('-').map(Number)
      const m = game.moves.find((x) => sameTile(x.tile, tile))
      if (!m) return
      // If both ends show the same number, the side doesn't matter: don't ask
      if (m.sides.length === 1 || game.ends[0] === game.ends[1]) send({ type: 'dm_play', tile, side: m.sides[m.sides.length - 1] })
      else setSelected((s) => (sameTile(s, tile) ? null : tile))
    },
    [myTurn, game.moves, game.ends, selected, send],
  )

  const state = useMemo(() => ({ game, me, selected }), [game, me, selected])
  const finished = game.phase === 'finished'
  const last = game.log[game.log.length - 1]
  let title
  let hint = null
  if (game.phase !== 'playing') title = finished ? (game.winner === me ? '¡Ganaste la partida!' : `${game.winner} ganó la partida`) : 'Fin de la mano'
  else if (myTurn) {
    title = game.mustDraw ? 'No tienes jugada: roba' : selected ? '¿En qué punta va?' : 'Te toca'
    hint = game.mustDraw ? 'Toca el pozo (o el botón) para robar.' : selected ? 'Toca la punta que brilla.' : game.forced ? `Sales con el ${game.forced[0]}|${game.forced[1]}.` : 'Toca una ficha que brille.'
  } else title = `Juega ${game.turn}…`
  if (game.phase === 'playing' && !hint) hint = describe(last, me)

  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: game.scores[p],
    max: game.goal,
    stats: `${game.counts[p] ?? 0} fichas · meta ${game.goal}`,
    active: game.turn === p && game.phase === 'playing',
  }))

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#DCE8E1, #BFD3C8)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Mesa de dominó en 3D" />}
      top={
        <>
          <Plates players={plates} />
          {game.options.boneyard && (
            <span className="rounded-xl bg-paper/90 px-2.5 py-1 text-xs font-semibold shadow-sm backdrop-blur">Pozo: {game.pool}</span>
          )}
        </>
      }
      bottom={
        <>
          <Banner title={title} hint={hint} color={colorOf(game.phase === 'playing' ? game.turn : game.winner)} />
          <Flash flash={flash} />
          {myTurn && game.mustDraw && <BigAction onClick={() => send({ type: 'dm_draw' })} color={colorOf(me)}>Robar del pozo ({game.pool})</BigAction>}
        </>
      }
      aside={
        <>
          {game.phase !== 'playing' && <HandOver game={game} me={me} send={send} colorOf={colorOf} />}
          <Panel title="Historial">
            <LogList items={game.log} colorOf={colorOf} render={(l) => describe(l, me)} />
          </Panel>
          {other && game.phase === 'playing' && (
            <Panel title="Cómo se juega">
              <p className="text-sm text-muted">Pon fichas que coincidan con una de las dos puntas. Gana la mano quien se quede sin fichas; si nadie puede jugar, es tranque y gana quien tenga menos puntos.</p>
            </Panel>
          )}
        </>
      }
    />
  )
}
DominoGame.showsErrors = true

function describe(entry, me) {
  if (!entry) return null
  const who = entry.player === me ? 'Pusiste' : `${entry.player} puso`
  if (entry.action === 'play') return `${who} el ${entry.tile[0]}|${entry.tile[1]}.`
  if (entry.action === 'draw') return entry.player === me ? 'Robaste del pozo.' : `${entry.player} robó del pozo.`
  return entry.player === me ? 'No tenías jugada: pasaste.' : `${entry.player} no tenía jugada y pasó.`
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
