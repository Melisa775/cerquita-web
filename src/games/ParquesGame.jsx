/**
 * Parqués on the 3D stage. Tap one of your glowing pawns to move it; with two
 * usable dice, pick which one first in the dice tray (or let the first one go).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Stage3D from '../components/stage/Stage3D'
import { Banner, BigAction, DiceTray, Flash, LogList, Panel, Plates, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'
import { EndActions } from '../components/EndActions'
import { cssColor } from '../lib/three/kit'

const HOME = 71
const load = () => import('../lib/three/parques3d.js')

export default function ParquesGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const finished = game.phase === 'finished'
  const myTurn = game.turn === me && !finished
  const [die, setDie] = useState(0)
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  useEffect(() => {
    if (game.unused.length) setDie(game.unused[0])
  }, [game.rollId, game.unused])

  // On desktop: space or Enter rolls
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

  const movable = useMemo(() => {
    if (!myTurn) return new Set()
    if (game.phase === 'bonus') return new Set(game.pieces[me].map((p, i) => (p !== HOME ? i : null)).filter((i) => i !== null))
    return new Set(game.moves.filter((m) => m.die === die || !game.moves.some((x) => x.piece === m.piece && x.die === die)).map((m) => m.piece))
  }, [myTurn, game.phase, game.pieces, game.moves, die, me])

  const onPick = useCallback(
    ({ kind, id: i }) => {
      if (kind !== 'piece' || !myTurn) return
      if (game.phase === 'bonus') return send({ type: 'pa_bonus', piece: i })
      const options = game.moves.filter((m) => m.piece === i)
      if (!options.length) return
      const pick = options.find((m) => m.die === die) ?? options[0]
      send({ type: 'pa_move', piece: i, die: pick.die })
    },
    [myTurn, game.phase, game.moves, die, send],
  )

  const colors = useMemo(() => Object.fromEntries(game.players.map((p) => [p, cssColor(colorOf(p))])), [game.players, colorOf])
  const state = useMemo(() => ({ game, me, colors, movable }), [game, me, colors, movable])

  let title
  let hint = null
  if (finished) title = game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`
  else if (!myTurn) title = `Juega ${game.turn}…`
  else if (game.phase === 'roll') {
    title = game.pairsInRow ? '¡Pares! Tira otra vez' : 'Te toca: lanza los dados'
    if (game.attemptsLeft != null) hint = `Necesitas pares para salir de la cárcel. Intentos: ${game.attemptsLeft}`
  } else if (game.phase === 'bonus') {
    title = '¡Tercer par seguido!'
    hint = 'Toca la ficha que quieres mandar directo al cielo.'
  } else {
    title = 'Mueve tus fichas'
    hint = game.moves.length ? 'Toca una ficha que brille. Con dos dados, elige primero cuál usar arriba.' : 'No tienes jugadas con estos dados.'
  }
  if (!myTurn && !finished && game.attemptsLeft != null && game.phase === 'roll') hint = `${other} necesita pares para salir.`

  const plates = game.players.map((p) => {
    const pcs = game.pieces[p]
    return {
      name: p,
      you: p === me,
      color: colorOf(p),
      value: pcs.filter((x) => x === HOME).length,
      max: pcs.length,
      stats: `${pcs.filter((x) => x === HOME).length} en el cielo · ${pcs.filter((x) => x === -1).length} en la cárcel`,
      active: game.turn === p && !finished,
    }
  })

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#F3EAD9, #E2D3B6)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Tablero de parqués en 3D" />}
      top={
        <>
          <Plates players={plates} />
          <DiceTray
            dice={game.dice}
            rollId={game.rollId}
            selected={myTurn && game.phase === 'move' ? die : undefined}
            used={game.phase === 'move' ? [0, 1].filter((i) => !game.unused.includes(i)) : []}
            onPick={myTurn && game.phase === 'move' && game.unused.length > 1 ? setDie : undefined}
            ringColor={colorOf(me)}
          />
        </>
      }
      bottom={
        <>
          <Banner title={title} hint={hint} color={colorOf(finished ? game.winner : game.turn)}>
            {game.dice && game.dice[0] === game.dice[1] && !finished && <p className="text-sm font-bold">¡Pares!</p>}
          </Banner>
          <Flash flash={flash} />
          {myTurn && game.phase === 'roll' && <BigAction onClick={() => send({ type: 'pa_roll' })} color={colorOf(me)}>🎲 Lanzar dados</BigAction>}
          {myTurn && game.canRelease && (
            <BigAction onClick={() => send({ type: 'pa_release' })} color={colorOf(me)} pulse={false}>Sacar de la cárcel</BigAction>
          )}
        </>
      }
      aside={
        <>
          {finished && (
            <Panel title="Fin de la partida">
              <EndActions send={send} replay={{ type: 'start_game', game: 'parques', ...game.options }} />
            </Panel>
          )}
          <Panel title="Cómo se juega">
            <ul className="space-y-1 text-sm text-muted">
              <li>Se sale de la cárcel con pares.</li>
              <li>Cada dado mueve una ficha por separado.</li>
              <li>En las casillas sin ★ te pueden comer y mandarte a la cárcel.</li>
              <li>Al cielo se entra con el número exacto. Tercer par seguido: una ficha directo al cielo.</li>
            </ul>
          </Panel>
          <Panel title="Historial">
            <LogList items={game.log} colorOf={colorOf} render={(l) => describe(l, me)} />
          </Panel>
        </>
      }
    />
  )
}
ParquesGame.showsErrors = true

function describe(l, me) {
  const you = l.player === me
  const who = you ? '' : `${l.player} `
  switch (l.action) {
    case 'roll': return `${you ? 'Sacaste' : `${l.player} sacó`} ${l.dice[0]} y ${l.dice[1]}`
    case 'release': return `${you ? 'Sacaste' : `${who}sacó`} ${l.count} ${l.count === 1 ? 'ficha' : 'fichas'} de la cárcel`
    case 'move': return l.to === HOME ? `${you ? '¡Metiste' : `¡${who}metió`} una ficha al cielo!` : `${you ? 'Moviste' : `${who}movió`} ${l.steps}`
    case 'capture': return `${you ? '¡Te comiste' : `¡${who}se comió`} ${l.count === 1 ? 'una ficha' : `${l.count} fichas`}!`
    case 'lost': return `${you ? 'Perdiste' : `${who}perdió`} ${l.dice.length === 1 ? `el ${l.dice[0]}` : 'los dos dados'}: no había jugada`
    case 'no_luck': return `${you ? 'No sacaste' : `${who}no sacó`} pares en tres intentos`
    case 'bonus': return `${you ? 'Mandaste' : `${who}mandó`} una ficha directo al cielo`
    default: return ''
  }
}
