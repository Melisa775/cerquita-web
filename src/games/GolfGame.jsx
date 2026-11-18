/**
 * Mini golf on the 3D stage. On your turn, press anywhere and pull back like
 * a slingshot: the ball goes the other way, harder the more you pull. Your
 * partner sees your aim live.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AnimatedNumber, Confetti } from '../lib/motion'
import { CONFETTI_COLORS, EndActions } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, BigAction, Flash, Panel, Plates, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/golf3d.js')

function resultLabel(shot, par) {
  if (!shot) return null
  if (shot.result === 'water') return '¡Al agua! +1 golpe'
  if (shot.pickedUp) return 'Bola levantada'
  if (shot.result !== 'holed') return null
  const diff = shot.strokes - par
  if (shot.strokes === 1) return '¡Hoyo en uno!'
  return { '-3': '¡Albatros!', '-2': '¡Águila!', '-1': '¡Birdie!', 0: '¡Par!', 1: 'Bogey', 2: 'Doble bogey' }[diff] ?? `+${diff}`
}

export default function GolfGame({ room, me, send, colorOf, error, errorId, subscribe }) {
  const game = room.game
  const course = game.course
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  const [rivalAim, setRivalAim] = useState(null)
  const [label, setLabel] = useState(null)
  // the shot whose animation already ended (the one in place when you arrive counts as seen)
  const [doneShot, setDoneShot] = useState(game.lastShot?.id ?? null)
  const shot = game.lastShot
  const animating = !!shot && shot.id !== doneShot
  const myTurn = game.phase === 'playing' && game.turn === me && !animating
  const canShoot = myTurn && !game.done[me]

  // partner's aim, live
  useEffect(
    () =>
      subscribe((ev) => {
        if (ev.kind === 'aim') setRivalAim(ev.power > 0 ? ev : null)
      }),
    [subscribe],
  )

  const finishShot = useCallback(
    (id) => {
      setDoneShot((d) => (d === id ? d : id))
      const s = game.lastShot
      if (s && s.id === id) {
        const text = resultLabel(s, course.par)
        if (text) setLabel({ text, id })
      }
    },
    [game.lastShot, course.par],
  )

  // a new shot: clear the partner's aim; never wait forever for the animation
  useEffect(() => {
    if (!animating) return
    setRivalAim(null)
    const id = setTimeout(() => finishShot(shot.id), (shot.path.length / 60) * 1000 + 1500)
    return () => clearTimeout(id)
  }, [animating, shot?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!label) return
    const id = setTimeout(() => setLabel(null), 2200)
    return () => clearTimeout(id)
  }, [label])

  const onPick = useCallback(
    (ev) => {
      if (ev.kind === 'shotDone') return finishShot(ev.id)
      if (ev.kind === 'aim') return send({ type: 'gf_aim', angle: ev.angle, power: ev.power })
      if (ev.kind === 'shoot') send({ type: 'gf_shoot', angle: ev.angle, power: ev.power })
    },
    [finishShot, send],
  )

  const colors = useMemo(() => Object.fromEntries(game.players.map((p) => [p, cssColor(colorOf(p))])), [game.players, colorOf])
  const state = useMemo(() => ({ game, me, colors, rivalAim, canShoot }), [game, me, colors, rivalAim, canShoot])

  const finished = game.phase === 'finished'
  const over = game.phase === 'hole_over' || finished
  let title
  if (finished) title = game.winner ? (game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`) : 'Empate'
  else if (game.phase === 'hole_over') title = 'Hoyo terminado'
  else if (animating) title = shot.player === me ? 'Va tu bola…' : `Va la bola de ${shot.player}…`
  else title = game.turn === me ? 'Te toca' : `Tira ${game.turn}…`
  const hint = canShoot ? 'Toca en cualquier parte y jala hacia atrás, como una cauchera.' : null

  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: game.strokes[p],
    max: 0,
    stats: `${game.done[p] ? '✓ En el hoyo · ' : ''}total ${game.totals[p] ?? 0}`,
    active: !over && game.turn === p,
  }))
  const big = label && /^¡(Hoyo en uno|Albatros|Águila|Birdie)/.test(label.text)

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#E3F1E6, #BFDCC6)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label={`Hoyo ${game.hole + 1}: ${course.name}`} />}
      overlay={
        <>
          {finished && game.winner === me && <Confetti colors={CONFETTI_COLORS} />}
          <AnimatePresence>
            {label && (
              <motion.div
                key={label.id}
                className="pointer-events-none absolute inset-x-0 top-1/3 flex justify-center"
                initial={{ scale: 0.4, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              >
                {big && <Confetti colors={CONFETTI_COLORS} count={50} />}
                <span className="rounded-2xl bg-ink/85 px-5 py-2.5 font-display text-2xl font-extrabold text-white shadow-lg">{label.text}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      }
      top={
        <>
          <Plates players={plates} />
          <div className="shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur">
            <p className="font-display text-lg font-extrabold leading-tight">Hoyo {game.hole + 1}<span className="text-sm font-semibold text-muted">/{game.holes}</span></p>
            <p className="text-xs font-semibold text-muted">par {course.par}</p>
          </div>
        </>
      }
      bottom={
        <>
          <Banner title={title} hint={hint} color={finished && game.winner ? colorOf(game.winner) : !over && game.turn ? colorOf(game.turn) : undefined} />
          <Flash flash={flash} />
          {game.phase === 'hole_over' && <BigAction onClick={() => send({ type: 'next_round' })} color={colorOf(me)}>Siguiente hoyo ⛳</BigAction>}
        </>
      }
      aside={<Side game={game} me={me} send={send} colorOf={colorOf} />}
    />
  )
}
GolfGame.showsErrors = true

function Side({ game, me, send, colorOf }) {
  const course = game.course
  const finished = game.phase === 'finished'
  return (
    <>
      {finished && (
        <Panel title="Fin del recorrido">
          <EndActions send={send} replay={{ type: 'start_game', game: 'golf', ...game.options }} />
        </Panel>
      )}
      <Panel title={course.name} right={<span className="text-xs font-semibold text-muted">Hoyo {game.hole + 1} de {game.holes} · par {course.par}</span>}>
        <div className="space-y-2">
          {game.players.map((p) => (
            <div key={p} className="flex items-center justify-between rounded-2xl bg-stone px-4 py-2.5">
              <span className="flex items-center gap-2 font-semibold" style={{ color: colorOf(p) }}>
                <span className="h-3 w-3 rounded-full bg-white" style={{ boxShadow: `0 0 0 2px ${colorOf(p)}` }} />
                {p}
                {p === me && ' (tú)'}
              </span>
              <span className="text-sm text-muted">
                {game.done[p] ? '✓ ' : ''}
                <AnimatedNumber value={game.strokes[p]} className="font-display text-xl font-extrabold text-ink" /> {game.strokes[p] === 1 ? 'golpe' : 'golpes'}
              </span>
            </div>
          ))}
        </div>
      </Panel>
      {game.card.length > 0 && (
        <Panel title="Tarjeta">
          <Scorecard game={game} me={me} colorOf={colorOf} />
        </Panel>
      )}
      <Panel title="Cómo se juega">
        <ul className="space-y-1 px-1 text-sm text-muted">
          <li>Toca y jala hacia atrás: la bola sale al lado contrario.</li>
          <li>Arena frena, el agua suma un golpe y las flechas empujan la bola.</li>
          <li>Los portales morados te llevan al anillo punteado.</li>
          <li>Gana quien termine el recorrido con menos golpes.</li>
        </ul>
      </Panel>
    </>
  )
}

function Scorecard({ game, me, colorOf }) {
  return (
    <table className="w-full text-sm tabular-nums">
      <thead>
        <tr className="text-muted">
          <th className="py-1 text-left font-semibold">Hoyo</th>
          <th className="font-semibold">Par</th>
          {game.players.map((p) => (
            <th key={p} className="font-semibold" style={{ color: colorOf(p) }}>{p === me ? 'Tú' : p}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {game.card.map((h) => (
          <tr key={h.hole} className="border-t border-line">
            <td className="py-1">{h.hole}</td>
            <td className="text-center text-muted">{h.par}</td>
            {game.players.map((p) => (
              <td key={p} className={`text-center font-semibold ${h.strokes[p] < h.par ? 'text-[hsl(146_52%_34%)]' : h.strokes[p] > h.par ? 'text-danger' : ''}`}>
                {h.strokes[p]}
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t-2 border-ink font-bold">
          <td className="py-1">Total</td>
          <td className="text-center text-muted">{game.card.reduce((s, h) => s + h.par, 0)}</td>
          {game.players.map((p) => (
            <td key={p} className="text-center">{game.totals[p]}</td>
          ))}
        </tr>
      </tbody>
    </table>
  )
}
