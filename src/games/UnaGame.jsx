/**
 * Una on the 3D card table. Tap a raised card to play it, the pile to draw.
 * The buttons for "¡Una!", catching your partner and passing float over the
 * table when they apply; a wild card asks for the color in a sheet.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import PlayingCard, { CARD_COLORS } from '../components/PlayingCard'
import { EndActions } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, BigAction, Flash, LogList, Panel, Plates, Sheet, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'

const load = () => import('../lib/three/una3d.js')

function cardName(c) {
  if (c.color === null) return c.value === 'wild4' ? 'un +4' : 'un comodín'
  const v = { skip: 'Salta', reverse: 'Reversa', draw2: '+2' }[c.value] ?? c.value
  return `${v} ${CARD_COLORS[c.color].name.toLowerCase()}`
}

export default function UnaGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const playing = game.phase === 'playing'
  const myTurn = playing && game.turn === me
  const [wildFor, setWildFor] = useState(null)
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  const canSayUna =
    playing && !game.saidUna[me] && ((myTurn && game.hand.length === 2 && game.playable.length > 0) || (game.catchable === me && game.hand.length === 1))
  const canCatch = playing && game.catchable === other
  const canDraw = myTurn && game.drawn == null

  const onPick = useCallback(
    ({ kind, id }) => {
      if (!myTurn) return
      if (kind === 'pile') return canDraw && send({ type: 'un_draw' })
      if (kind !== 'card' || !game.playable.includes(id)) return
      const c = game.hand.find((x) => x.id === id)
      if (c.color === null) setWildFor(c)
      else send({ type: 'un_play', card: c.id })
    },
    [myTurn, canDraw, game.playable, game.hand, send],
  )

  const state = useMemo(() => ({ game, me }), [game, me])
  const last = game.log[game.log.length - 1]

  let title
  if (!playing) title = null
  else if (myTurn) title = game.pending ? `¡Te tiraron +${game.pending}! Responde o roba` : game.drawn != null ? 'Juega la que robaste o pasa' : 'Te toca'
  else title = `Juega ${game.turn}…`
  const hint = last ? describe(last, me) : myTurn ? 'Toca una carta que sobresalga, o el mazo para robar.' : null

  const goal = game.options.goal
  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: goal ? game.scores[p] : game.counts[p],
    max: goal || 0,
    stats: `${game.counts[p]} ${game.counts[p] === 1 ? 'carta' : 'cartas'}${goal ? ` · a ${goal}` : ''}`,
    badges: playing && game.counts[p] === 1 && game.saidUna[p] ? ['¡Una!'] : [],
    active: playing && game.turn === p,
  }))
  const color = CARD_COLORS[game.color]
  const secondary = 'pointer-events-auto rounded-full bg-paper/95 px-5 py-2.5 font-bold shadow-md backdrop-blur hover:bg-white'

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#E3E6F0, #C4CADC)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Mesa de Una en 3D" />}
      top={
        <>
          <Plates players={plates} />
          {playing && color && (
            <motion.div
              key={game.color}
              className="flex shrink-0 items-center gap-2 rounded-2xl bg-paper/90 px-3 py-2 shadow-sm backdrop-blur"
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}
            >
              <span className="h-5 w-5 rounded-full" style={{ background: color.fill }} />
              <span className="text-sm font-bold">{color.name}</span>
              {game.pending > 0 && <span className="rounded-full bg-ink px-2 text-sm font-extrabold text-white">+{game.pending}</span>}
            </motion.div>
          )}
        </>
      }
      bottom={
        playing ? (
          <>
            <Banner key={game.log.length} title={title} hint={hint} color={colorOf(game.turn)} />
            <Flash flash={flash} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              {canSayUna && (
                <BigAction onClick={() => send({ type: 'un_una' })} color={CARD_COLORS.r.fill}>¡Una!</BigAction>
              )}
              {canCatch && (
                <BigAction onClick={() => send({ type: 'un_catch' })} color="#22252E">¡{other} no dijo Una! (+2)</BigAction>
              )}
              {canDraw && (
                <button className={secondary} onClick={() => send({ type: 'un_draw' })}>{game.pending ? `Robar ${game.pending}` : 'Robar'}</button>
              )}
              {myTurn && game.drawn != null && (
                <button className={secondary} onClick={() => send({ type: 'un_pass' })}>Pasar</button>
              )}
            </div>
          </>
        ) : (
          <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
        )
      }
      aside={
        <>
          <Panel title="Partida">
            <p className="px-1 text-sm text-muted">
              {goal ? `Mano ${game.round} · a ${goal} puntos` : 'Una sola mano'}
              {game.options.stacking && ' · se acumulan +2 y +4'} · {game.pile} cartas en el mazo
            </p>
          </Panel>
          <Panel title="Historial">
            <LogList items={game.log} colorOf={colorOf} render={(l) => describe(l, me)} />
          </Panel>
          <Panel title="Cómo se juega">
            <ul className="space-y-1 px-1 text-sm text-muted">
              <li>Juega una carta del mismo color o número que la de la mesa.</li>
              <li>Los comodines sirven siempre y eligen el color.</li>
              <li>Con dos cartas, di «¡Una!» al jugar la penúltima, o te pueden pillar.</li>
            </ul>
          </Panel>
        </>
      }
      overlay={
        <AnimatePresence>
          {wildFor && (
            <Sheet onClose={() => setWildFor(null)} bottom>
              <p className="text-center font-display text-xl font-bold">¿Qué color pides?</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(CARD_COLORS).map(([k, c]) => (
                  <button
                    key={k}
                    onClick={() => {
                      send({ type: 'un_play', card: wildFor.id, color: k })
                      setWildFor(null)
                    }}
                    className="h-20 rounded-2xl font-semibold text-white shadow-sm hover:brightness-110"
                    style={{ background: c.fill }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </Sheet>
          )}
        </AnimatePresence>
      }
    />
  )
}
UnaGame.showsErrors = true

function describe(l, me) {
  const you = l.player === me
  switch (l.action) {
    case 'play':
      return `${you ? 'Jugaste' : `${l.player} jugó`} ${cardName(l.card)}${l.card.color === null ? ` y pidió ${CARD_COLORS[l.color].name.toLowerCase()}` : ''}`
    case 'drew':
      return l.forced ? `${you ? 'Robaste' : `${l.player} robó`} ${l.count} ${l.count === 1 ? 'carta' : 'cartas'} de castigo` : `${you ? 'Robaste' : `${l.player} robó`} una carta`
    case 'pass':
      return `${you ? 'Pasaste' : `${l.player} pasó`}`
    case 'una':
      return `${you ? 'Dijiste' : `${l.player} dijo`} ¡Una!`
    case 'catch':
      return `${you ? '¡Pillaste' : `¡${l.player} pilló`} a ${l.target === me ? 'ti' : l.target} sin decir Una! Roba ${l.count}`
    default:
      return ''
  }
}

function RoundOver({ game, me, send, colorOf }) {
  const r = game.result
  const finished = game.phase === 'finished'
  const loser = game.players.find((p) => p !== r.winner)
  return (
    <section className="pop pointer-events-auto max-h-[70%] w-full max-w-lg overflow-y-auto rounded-[2rem] bg-paper/95 p-5 shadow-xl backdrop-blur sm:p-6">
      <p className="font-display text-3xl font-extrabold" style={{ color: colorOf(r.winner) }}>
        {finished && game.options.goal ? (game.winner === me ? '¡Ganaste la partida!' : `${game.winner} ganó la partida`) : r.winner === me ? '¡Te quedaste sin cartas!' : `¡${r.winner} se quedó sin cartas!`}
      </p>
      <p className="mt-1 text-muted">
        {r.winner === me ? 'Sumas' : 'Suma'} {r.points} puntos por las cartas que le quedaron a {loser === me ? 'ti' : loser}.
      </p>
      <div className="mt-4 flex flex-wrap gap-1">
        {(game.hands?.[loser] ?? []).map((c) => (
          <PlayingCard key={c.id} card={c} width={46} />
        ))}
      </div>
      {finished ? (
        <EndActions send={send} replay={{ type: 'start_game', game: 'una', ...game.options }} />
      ) : (
        <button onClick={() => send({ type: 'next_round' })} autoFocus className="mt-5 rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
          Siguiente mano
        </button>
      )}
    </section>
  )
}
