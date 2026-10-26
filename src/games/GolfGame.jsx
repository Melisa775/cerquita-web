import { useEffect, useRef, useState } from 'react'
import { EndActions } from '../components/EndActions'

const W = 100
const H = 150
const BALL_R = 2.2
const HOLE_R = 3.6
const PULL_MAX = 34 // unidades de arrastre para fuerza máxima

const C = {
  rough: 'hsl(140 32% 30%)',
  green: 'hsl(112 42% 50%)',
  stripe: 'hsl(112 44% 55%)',
  wall: 'hsl(28 42% 44%)',
  wallTop: 'hsl(30 48% 58%)',
  sand: 'hsl(42 62% 78%)',
  water: 'hsl(200 70% 54%)',
  bumper: 'hsl(346 70% 56%)',
  portal: 'hsl(268 60% 58%)',
}

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
  const [anim, setAnim] = useState(null) // { player, path, i }
  const [label, setLabel] = useState(null)
  const [aim, setAim] = useState(null) // mi apuntado: { angle, power, px, py }
  const [rivalAim, setRivalAim] = useState(null)
  const [flash, setFlash] = useState(null)
  const seenShot = useRef(game.lastShot?.id ?? 0)
  const svgRef = useRef(null)
  const lastSent = useRef(0)

  const animating = !!anim

  // Al empezar un hoyo nuevo, si el campo quedó fuera de la pantalla (en el
  // celular el botón "Siguiente hoyo" queda abajo), se vuelve a mostrar
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const box = el.getBoundingClientRect()
    if (box.top < 0 || box.bottom > window.innerHeight) el.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [game.hole])
  const myTurn = game.phase === 'playing' && game.turn === me && !animating

  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  // apuntado de la pareja, en vivo
  useEffect(
    () =>
      subscribe((ev) => {
        if (ev.kind === 'aim') setRivalAim(ev.power > 0 ? ev : null)
      }),
    [subscribe],
  )

  // animar cada tiro nuevo. Depende solo del id del tiro: cada actualización de
  // la sala trae un objeto nuevo y no debe cortar la animación a la mitad.
  const shotRef = useRef(game.lastShot)
  shotRef.current = game.lastShot
  const shotId = game.lastShot?.id
  const par = course.par
  useEffect(() => {
    const shot = shotRef.current
    if (!shot || shot.id === seenShot.current) return
    seenShot.current = shot.id
    setRivalAim(null)
    setLabel(null)
    let i = 0
    let raf
    let last = performance.now()
    const step = (now) => {
      // 60 cuadros por segundo, sin importar la tasa de refresco
      const advance = Math.max(1, Math.round((now - last) / (1000 / 60)))
      last = now
      i = Math.min(shot.path.length - 1, i + advance)
      setAnim({ player: shot.player, pos: shot.path[i], result: shot.result })
      if (i < shot.path.length - 1) raf = requestAnimationFrame(step)
      else {
        setAnim(null)
        setLabel({ text: resultLabel(shot, par), who: shot.player, id: shot.id })
      }
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      setAnim(null)
    }
  }, [shotId, par])

  useEffect(() => {
    if (!label) return
    const id = setTimeout(() => setLabel(null), 2200)
    return () => clearTimeout(id)
  }, [label])

  const myBall = game.balls[me]

  function toCourse(e) {
    const svg = svgRef.current
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM().inverse())
    return [p.x, p.y]
  }
  // Se jala desde donde se tocó (no desde la bola): así nunca se sale de la pantalla
  function aimFrom(e, origin) {
    const [px, py] = toCourse(e)
    const dx = origin[0] - px
    const dy = origin[1] - py
    const dist = Math.hypot(dx, dy)
    return { angle: Math.atan2(dy, dx), power: Math.min(1, dist / PULL_MAX), origin, px, py }
  }
  function sendAim(a, force = false) {
    const now = performance.now()
    if (!force && now - lastSent.current < 60) return
    lastSent.current = now
    send({ type: 'gf_aim', angle: a.angle, power: a.power })
  }
  function onDown(e) {
    if (!myTurn || game.done[me]) return
    svgRef.current.setPointerCapture(e.pointerId)
    setAim(aimFrom(e, toCourse(e)))
  }
  function onMove(e) {
    if (!aim) return
    const a = aimFrom(e, aim.origin)
    setAim(a)
    sendAim(a)
  }
  function onUp() {
    if (!aim) return
    const a = aim
    setAim(null)
    if (a.power >= 0.05) send({ type: 'gf_shoot', angle: a.angle, power: a.power })
    else sendAim({ angle: 0, power: 0 }, true)
  }

  const showAim = aim ?? (rivalAim && game.turn !== me ? { ...rivalAim, rival: true } : null)
  const aimOwner = aim ? me : game.turn
  const aimBall = game.balls[aimOwner]

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="relative mx-auto w-full max-w-[28rem]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className={`block w-full touch-none select-none rounded-[2rem] shadow-sm ${myTurn ? 'cursor-crosshair' : ''}`}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={() => setAim(null)}
          role="img"
          aria-label={`Hoyo ${game.hole + 1}: ${course.name}`}
        >
          <Course course={course} />
          {/* bolas */}
          {/* la bola de quien tira va encima */}
          {[...game.players].sort((a, b) => (a === (anim?.player ?? game.turn)) - (b === (anim?.player ?? game.turn))).map((p) => {
            if (game.done[p] && !(anim && anim.player === p)) return null
            const pos = anim && anim.player === p ? anim.pos : game.balls[p]
            const sinking = anim && anim.player === p && anim.result === 'holed'
            return (
              <g key={p}>
                <ellipse cx={pos[0] + 0.6} cy={pos[1] + 0.9} rx={BALL_R} ry={BALL_R * 0.8} fill="rgba(0,0,0,.22)" />
                <circle cx={pos[0]} cy={pos[1]} r={BALL_R} fill="white" stroke={colorOf(p)} strokeWidth="0.9" opacity={sinking ? 0.95 : 1} />
              </g>
            )
          })}
          {/* apuntado */}
          {showAim && aimBall && !animating && <Aim ball={aimBall} aim={showAim} color={colorOf(aimOwner)} />}
        </svg>

        {label?.text && (
          <div key={label.id} className="pop pointer-events-none absolute inset-x-0 top-1/3 flex justify-center">
            <span className="rounded-2xl bg-ink/85 px-5 py-2.5 font-display text-2xl font-extrabold text-white shadow-lg">{label.text}</span>
          </div>
        )}
        <p role="status" className="mt-2 min-h-5 text-center text-sm font-medium text-danger">{flash}</p>
      </div>

      <Side game={game} me={me} send={send} colorOf={colorOf} myTurn={myTurn} animating={animating} />
    </div>
  )
}
GolfGame.showsErrors = true

function Aim({ ball, aim, color }) {
  const len = 6 + aim.power * 34
  const ex = ball[0] + Math.cos(aim.angle) * len
  const ey = ball[1] + Math.sin(aim.angle) * len
  const hue = 120 - aim.power * 120 // verde → rojo
  const dots = []
  for (let d = 4; d < len; d += 3.2) dots.push([ball[0] + Math.cos(aim.angle) * d, ball[1] + Math.sin(aim.angle) * d])
  return (
    <g pointerEvents="none">
      {aim.origin && (
        <>
          <circle cx={aim.origin[0]} cy={aim.origin[1]} r="1.6" fill="rgba(255,255,255,.4)" />
          <line x1={aim.origin[0]} y1={aim.origin[1]} x2={aim.px} y2={aim.py} stroke="rgba(255,255,255,.35)" strokeWidth="0.8" strokeLinecap="round" />
        </>
      )}
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={0.75} fill={`hsl(${hue} 85% 55%)`} />
      ))}
      <path
        d={`M${ex} ${ey} l${-Math.cos(aim.angle - 0.5) * 3.2} ${-Math.sin(aim.angle - 0.5) * 3.2} M${ex} ${ey} l${-Math.cos(aim.angle + 0.5) * 3.2} ${-Math.sin(aim.angle + 0.5) * 3.2}`}
        stroke={`hsl(${hue} 85% 55%)`}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx={ball[0]} cy={ball[1]} r={BALL_R + 1.4} fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="1 1" />
    </g>
  )
}

function Course({ course }) {
  const outline = course.walls[0]
  const poly = outline.map(([x, y]) => `${x},${y}`).join(' ')
  const [hx, hy] = course.hole
  return (
    <g>
      <defs>
        <pattern id="gf-stripes" width="12" height="12" patternUnits="userSpaceOnUse">
          <rect width="12" height="12" fill={C.green} />
          <rect width="12" height="6" fill={C.stripe} />
        </pattern>
        <pattern id="gf-waves" width="8" height="5" patternUnits="userSpaceOnUse">
          <rect width="8" height="5" fill={C.water} />
          <path d="M0 3 q2 -2 4 0 t4 0" fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={C.rough} />
      <polygon points={poly} fill="url(#gf-stripes)" />
      {(course.slopes ?? []).map(([x, y, w, h, ax, ay], i) => (
        <Slope key={i} x={x} y={y} w={w} h={h} ax={ax} ay={ay} />
      ))}
      {(course.sand ?? []).map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="4" fill={C.sand} stroke="hsl(40 45% 68%)" strokeWidth="0.5" />
      ))}
      {(course.water ?? []).map(([x, y, w, h], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} rx="2.5" fill="url(#gf-waves)" />
      ))}
      {(course.portals ?? []).map(([ax, ay, bx, by], i) => (
        <g key={i}>
          <circle cx={ax} cy={ay} r="4" fill="hsl(268 60% 30% / .55)" stroke={C.portal} strokeWidth="1.2" />
          <circle cx={ax} cy={ay} r="2" fill="none" stroke={C.portal} strokeWidth="0.6" />
          <circle cx={bx} cy={by} r="4" fill="none" stroke={C.portal} strokeWidth="0.9" strokeDasharray="1.4 1.2" />
        </g>
      ))}
      {/* hoyo y bandera */}
      <circle cx={hx} cy={hy} r={HOLE_R + 0.6} fill="hsl(112 30% 38%)" />
      <circle cx={hx} cy={hy} r={HOLE_R} fill="#1d2420" />
      <line x1={hx + 0.4} y1={hy} x2={hx + 0.4} y2={hy - 13} stroke="white" strokeWidth="0.7" />
      <path d={`M${hx + 0.7} ${hy - 13} l7 2.2 l-7 2.4 z`} fill="hsl(2 75% 55%)" />
      {/* salida */}
      <rect x={course.tee[0] - 3} y={course.tee[1] - 3} width="6" height="6" rx="1.2" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="0.5" />
      {(course.bumpers ?? []).map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x + 0.5} cy={y + 0.8} r={r} fill="rgba(0,0,0,.2)" />
          <circle cx={x} cy={y} r={r} fill={C.bumper} stroke="white" strokeWidth="0.8" />
          <circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.3} fill="rgba(255,255,255,.35)" />
        </g>
      ))}
      {course.walls.map((line, i) => {
        const pts = line.map(([x, y]) => `${x},${y}`).join(' ')
        return (
          <g key={i}>
            <polyline points={pts} fill="none" stroke={C.wall} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={pts} fill="none" stroke={C.wallTop} strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        )
      })}
    </g>
  )
}

function Slope({ x, y, w, h, ax, ay }) {
  const angle = (Math.atan2(ay, ax) * 180) / Math.PI
  const arrows = []
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) arrows.push([x + (w * (i + 0.5)) / 4, y + (h * (j + 0.5)) / 3])
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="rgba(20,60,20,.16)" />
      {arrows.map(([cx, cy], i) => (
        <path key={i} d="M-2.4 -1.6 L0 0 L-2.4 1.6" transform={`translate(${cx} ${cy}) rotate(${angle})`} fill="none" stroke="rgba(255,255,255,.45)" strokeWidth="0.8" strokeLinecap="round" />
      ))}
    </g>
  )
}

function Side({ game, me, send, colorOf, myTurn, animating }) {
  const course = game.course
  const finished = game.phase === 'finished'
  const over = game.phase === 'hole_over' || finished
  let title
  if (finished) title = game.winner ? (game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`) : 'Empate'
  else if (game.phase === 'hole_over') title = 'Hoyo terminado'
  else if (animating) title = '…'
  else title = game.turn === me ? 'Te toca' : `Tira ${game.turn}…`

  return (
    <aside className="rounded-[2rem] bg-paper p-5">
      <p className="text-sm font-semibold text-muted">
        Hoyo {game.hole + 1} de {game.holes} · {course.name} · par {course.par}
      </p>
      <p className="mt-1 font-display text-3xl font-extrabold" style={{ color: finished && game.winner ? colorOf(game.winner) : !over && game.turn ? colorOf(game.turn) : undefined }}>
        {title}
      </p>
      {myTurn && !over && <p className="mt-1 text-sm text-muted">Toca en cualquier parte y jala hacia atrás, como una cauchera: la bola sale al lado contrario y mientras más jalas, más fuerte.</p>}

      <div className="mt-4 space-y-2">
        {game.players.map((p) => (
          <div key={p} className="flex items-center justify-between rounded-2xl bg-stone px-4 py-2.5">
            <span className="flex items-center gap-2 font-semibold" style={{ color: colorOf(p) }}>
              <span className="h-3 w-3 rounded-full bg-white" style={{ boxShadow: `0 0 0 2px ${colorOf(p)}` }} />
              {p}
              {p === me && ' (tú)'}
            </span>
            <span className="text-sm text-muted">
              {game.done[p] ? '✓ ' : ''}
              <span className="font-display text-xl font-extrabold text-ink tabular-nums">{game.strokes[p]}</span> {game.strokes[p] === 1 ? 'golpe' : 'golpes'}
            </span>
          </div>
        ))}
      </div>

      {game.card.length > 0 && <Scorecard game={game} me={me} colorOf={colorOf} />}

      {game.phase === 'hole_over' && (
        <button onClick={() => send({ type: 'next_round' })} autoFocus className="mt-4 w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
          Siguiente hoyo
        </button>
      )}
      {finished && <EndActions send={send} replay={{ type: 'start_game', game: 'golf', ...game.options }} />}
    </aside>
  )
}

function Scorecard({ game, me, colorOf }) {
  return (
    <table className="mt-4 w-full text-sm tabular-nums">
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
