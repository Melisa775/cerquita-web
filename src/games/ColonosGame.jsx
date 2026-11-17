import { useEffect, useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, spring } from '../lib/motion'
import { EndActions } from '../components/EndActions'
import { DEV_META, RESOURCES, RES_META, ResourceIcon, TERRAIN, TerrainArt, pips } from '../lib/colonos'

const S = 46 // size of a hexagon in the drawing
const SEA = 'hsl(204 62% 56%)'

const DIE = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
}

const COST_LABEL = {
  road: ['Camino', { wood: 1, brick: 1 }],
  settlement: ['Pueblo', { wood: 1, brick: 1, wool: 1, grain: 1 }],
  city: ['Ciudad', { grain: 2, ore: 3 }],
}

const canPay = (hand, cost) => hand && Object.entries(cost).every(([r, n]) => hand[r] >= n)

export default function ColonosGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const myTurn = game.turn === me && game.phase !== 'finished'
  const [mode, setMode] = useState(null) // 'road' | 'settlement' | 'city'
  const [picker, setPicker] = useState(null) // 'year_of_plenty' | 'monopoly'
  const [flash, setFlash] = useState(null)

  // automatic build mode during initial placement and with free roads
  const autoMode = myTurn && game.phase === 'setup' ? game.setupNeed : myTurn && game.phase === 'road_building' ? 'road' : null
  const activeMode = autoMode ?? (myTurn && game.phase === 'main' ? mode : null)

  useEffect(() => setMode(null), [game.phase, game.turn])
  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(id)
  }, [flash])

  function onTarget(kind, target) {
    if (game.phase === 'setup') send({ type: 'co_place', target })
    else send({ type: 'co_build', what: kind, target })
    if (game.phase === 'main') setMode(null)
  }

  return (
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
      <div>
        <Header game={game} me={me} other={other} colorOf={colorOf} />
        <Board
          game={game}
          colorOf={colorOf}
          mode={activeMode}
          robberMode={myTurn && game.phase === 'robber'}
          onTarget={onTarget}
          onRobber={(hex) => send({ type: 'co_robber', hex })}
        />
        <p role="status" className="mt-2 min-h-6 text-center text-sm font-medium text-danger">{flash}</p>
      </div>

      <aside className="space-y-4">
        <Status game={game} me={me} other={other} colorOf={colorOf} mode={activeMode} send={send} />
        {game.phase === 'finished' ? (
          <div className="rounded-[2rem] bg-paper p-5">
            <EndActions send={send} replay={{ type: 'start_game', game: 'colonos', ...game.options }} />
          </div>
        ) : (
          <>
            <Hand game={game} me={me} />
            {myTurn && game.phase === 'main' && (
              <Build game={game} mode={mode} setMode={setMode} send={send} />
            )}
            <Devs game={game} me={me} myTurn={myTurn} send={send} onPicker={setPicker} />
            {myTurn && game.phase === 'main' && <Trade game={game} me={me} other={other} send={send} />}
          </>
        )}
        <Log game={game} me={me} colorOf={colorOf} />
      </aside>

      {game.offer && game.offer.from !== me && game.phase !== 'finished' && <OfferModal game={game} send={send} />}
      {game.discardNeed?.[me] > 0 && <DiscardModal game={game} me={me} send={send} />}
      {picker && <PickerModal kind={picker} game={game} onClose={() => setPicker(null)} send={send} />}
    </div>
  )
}
ColonosGame.showsErrors = true

/* --- header with both players ------------------------------------------- */

function Header({ game, me, other, colorOf }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-2">
      {[me, other].map((p) => {
        const info = game.playersInfo[p]
        return (
          <div key={p} className="rounded-2xl bg-paper px-4 py-2.5" style={game.turn === p && game.phase !== 'finished' ? { boxShadow: `inset 0 0 0 3px ${colorOf(p)}` } : undefined}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</span>
              <span className="text-sm text-muted">
                <span className="font-display text-2xl font-extrabold text-ink tabular-nums">{info.points}</span>/{game.goal}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted">
              {info.cards} cartas · {info.devCount} desarrollo · {info.knights} soldados · camino {info.road}
            </p>
            <div className="mt-1 flex flex-wrap gap-1 text-[0.7rem] font-semibold">
              {game.longest === p && <span className="rounded-full bg-ink px-2 py-0.5 text-white">Camino más largo +2</span>}
              {game.army === p && <span className="rounded-full bg-ink px-2 py-0.5 text-white">Ejército más grande +2</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* --- board -------------------------------------------------------------- */

function hexPoints(cx, cy, r) {
  const pts = []
  for (let i = 0; i < 6; i++) {
    const a = ((60 * i - 30) * Math.PI) / 180
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

function House({ x, y, color, city }) {
  const s = city ? 1.15 : 1
  return city ? (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-11 9 V-1 L-5 -7 L1 -1 V-3 H11 V9 Z" fill={color} stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
      <rect x="4" y="1" width="4" height="4" fill="white" opacity=".7" />
    </g>
  ) : (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-7 7 V-2 L0 -8 L7 -2 V7 Z" fill={color} stroke="white" strokeWidth="2.2" strokeLinejoin="round" />
    </g>
  )
}

function Board({ game, colorOf, mode, robberMode, onTarget, onRobber }) {
  const b = game.board
  const V = b.vertices.map(([x, y]) => [x * S, y * S])
  const legalV = new Set(mode && mode !== 'road' ? game.legal[mode] ?? [] : [])
  const legalE = new Set(mode === 'road' ? game.legal.road ?? [] : [])
  const legalH = new Set(robberMode ? game.legal.robber ?? [] : [])
  const last = [...game.log].reverse().find((l) => l.action === 'roll')
  const rolled = last ? last.dice[0] + last.dice[1] : null

  const pad = S * 0.95
  const minX = -5 * S * 0.87 - pad
  const W = -2 * minX
  const H = 2 * (4 * S + pad)

  return (
    <svg viewBox={`${minX} ${-H / 2} ${W} ${H}`} className="block w-full select-none rounded-[2rem] shadow-sm" role="img" aria-label="Tablero de la isla">
      <rect x={minX} y={-H / 2} width={W} height={H} fill={SEA} />
      <polygon points={hexPoints(0, 0, S * 5.55)} fill="hsl(204 55% 64%)" transform="rotate(30)" />

      {/* ports */}
      {b.ports.map((p, i) => {
        const [a, c] = p.vertices.map((v) => V[v])
        const mx = (a[0] + c[0]) / 2
        const my = (a[1] + c[1]) / 2
        const len = Math.hypot(mx, my)
        const px = mx + (mx / len) * S * 0.55
        const py = my + (my / len) * S * 0.55
        return (
          <g key={i}>
            <line x1={a[0]} y1={a[1]} x2={px} y2={py} stroke="hsl(30 35% 45%)" strokeWidth="3" />
            <line x1={c[0]} y1={c[1]} x2={px} y2={py} stroke="hsl(30 35% 45%)" strokeWidth="3" />
            <circle cx={px} cy={py} r={S * 0.3} fill="hsl(40 40% 94%)" stroke="hsl(30 35% 45%)" strokeWidth="2" />
            {p.kind === '3:1' ? (
              <text x={px} y={py + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#22252E">3:1</text>
            ) : (
              <g>
                <g transform={`translate(${px} ${py - 3}) scale(${S * 0.13})`}>
                  <rect x="-1" y="-1" width="2" height="2" rx="0.4" fill={TERRAIN[RES_META[p.kind].terrain].fill} />
                </g>
                <text x={px} y={py + 11} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="#22252E">2:1</text>
              </g>
            )}
          </g>
        )
      })}

      {/* hexagons */}
      {b.hexes.map((h, i) => {
        const [cx, cy] = [h.center[0] * S, h.center[1] * S]
        const t = TERRAIN[h.terrain]
        const hot = h.number === 6 || h.number === 8
        const isRolled = rolled && h.number === rolled
        return (
          // the island is laid out tile by tile from the center
          <motion.g
            key={i}
            onClick={() => legalH.has(i) && onRobber(i)}
            className={legalH.has(i) ? 'cursor-pointer' : ''}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring, delay: 0.035 * i }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            <polygon points={hexPoints(cx, cy, S - 1.5)} fill={t.fill} stroke="hsl(40 40% 92%)" strokeWidth="3" />
            {isRolled && <polygon key={game.rollId} points={hexPoints(cx, cy, S - 1.5)} fill="white" className="colonos-flash" />}
            <g transform={`translate(${cx} ${cy - S * 0.36}) scale(${S * 0.42})`} opacity=".9">
              <TerrainArt terrain={h.terrain} />
            </g>
            {h.number && (
              <g>
                <circle cx={cx} cy={cy + S * 0.22} r={S * 0.27} fill={isRolled ? 'hsl(48 100% 70%)' : 'hsl(40 45% 94%)'} stroke="rgba(0,0,0,.15)" />
                <text x={cx} y={cy + S * 0.28} textAnchor="middle" fontSize={S * 0.27} fontWeight="800" fill={hot ? 'hsl(2 70% 45%)' : '#22252E'}>
                  {h.number}
                </text>
                <g fill={hot ? 'hsl(2 70% 45%)' : '#22252E'}>
                  {Array.from({ length: pips(h.number) }, (_, k) => (
                    <circle key={k} cx={cx + (k - (pips(h.number) - 1) / 2) * 3.4} cy={cy + S * 0.39} r="1.25" />
                  ))}
                </g>
              </g>
            )}
            {legalH.has(i) && <polygon points={hexPoints(cx, cy, S - 5)} fill="rgba(255,255,255,.18)" stroke="white" strokeWidth="3" strokeDasharray="6 5" className="colonos-pulse" />}
          </motion.g>
        )
      })}

      {/* robber: hops from hex to hex */}
      {b.robber != null && b.hexes[b.robber] && (
        <motion.g
          initial={false}
          animate={{ x: b.hexes[b.robber].center[0] * S + S * 0.38, y: b.hexes[b.robber].center[1] * S + S * 0.05 }}
          transition={{ type: 'spring', stiffness: 160, damping: 16 }}
          className="pointer-events-none"
        >
          <motion.g key={b.robber} initial={{ y: -14 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 10, delay: 0.25 }}>
            <ellipse cx="0" cy="12" rx="8" ry="3" fill="rgba(0,0,0,.3)" />
            <path d="M-7 12 C-7 2 -5 -2 0 -2 C5 -2 7 2 7 12 Z" fill="#2A2D36" />
            <circle cx="0" cy="-6" r="5" fill="#2A2D36" />
          </motion.g>
        </motion.g>
      )}

      {/* roads */}
      {Object.entries(game.roads).map(([e, owner]) => {
        const [a, c] = b.edges[e].map((v) => V[v])
        const sx = a[0] + (c[0] - a[0]) * 0.16
        const sy = a[1] + (c[1] - a[1]) * 0.16
        const ex = a[0] + (c[0] - a[0]) * 0.84
        const ey = a[1] + (c[1] - a[1]) * 0.84
        return (
          // a new road is laid from one end to the other
          <g key={e}>
            <motion.line x1={sx} y1={sy} x2={ex} y2={ey} stroke="white" strokeWidth="9" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
            <motion.line x1={sx} y1={sy} x2={ex} y2={ey} stroke={colorOf(owner)} strokeWidth="5.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4 }} />
          </g>
        )
      })}
      {/* available edges */}
      {[...legalE].map((e) => {
        const [a, c] = b.edges[e].map((v) => V[v])
        return (
          <g key={`le${e}`} onClick={() => onTarget('road', e)} className="cursor-pointer">
            <line x1={a[0]} y1={a[1]} x2={c[0]} y2={c[1]} stroke="transparent" strokeWidth="16" />
            <line x1={a[0] + (c[0] - a[0]) * 0.2} y1={a[1] + (c[1] - a[1]) * 0.2} x2={a[0] + (c[0] - a[0]) * 0.8} y2={a[1] + (c[1] - a[1]) * 0.8} stroke="white" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 6" className="colonos-pulse" />
          </g>
        )
      })}

      {/* settlements and cities */}
      {Object.entries(game.buildings).map(([v, bld]) => (
        <motion.g
          key={`${v}-${bld.kind}`}
          initial={{ scale: 0, y: -12 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 13 }}
          style={{ transformOrigin: `${V[v][0]}px ${V[v][1]}px` }}
        >
          <House x={V[v][0]} y={V[v][1]} color={colorOf(bld.owner)} city={bld.kind === 'city'} />
        </motion.g>
      ))}
      {/* available vertices */}
      {[...legalV].map((v) => (
        <g key={`lv${v}`} onClick={() => onTarget(mode, v)} className="cursor-pointer">
          <circle cx={V[v][0]} cy={V[v][1]} r="13" fill="transparent" />
          <circle cx={V[v][0]} cy={V[v][1]} r={mode === 'city' ? 12 : 7} fill={mode === 'city' ? 'none' : 'white'} stroke="white" strokeWidth="2.5" className="colonos-pulse" />
        </g>
      ))}
    </svg>
  )
}

/* --- panel ---------------------------------------------------------------- */

function Dice({ game }) {
  if (!game.dice) return null
  return (
    <div className="flex items-center gap-2">
      {game.dice.map((v, i) => (
        <svg key={`${game.rollId}-${i}`} viewBox="0 0 100 100" className="parques-roll h-12 w-12">
          <rect x="4" y="4" width="92" height="92" rx="20" fill="white" stroke="#CDCFD5" strokeWidth="3" />
          {DIE[v].map(([x, y], k) => <circle key={k} cx={x} cy={y} r="8.5" fill={game.dice[0] + game.dice[1] === 7 ? 'hsl(2 70% 45%)' : '#22252E'} />)}
        </svg>
      ))}
      <span className="font-display text-2xl font-extrabold">= {game.dice[0] + game.dice[1]}</span>
    </div>
  )
}

function Status({ game, me, other, colorOf, mode, send }) {
  const myTurn = game.turn === me
  let title
  let hint = null
  if (game.phase === 'finished') title = game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`
  else if (game.phase === 'setup') {
    title = myTurn ? (game.setupNeed === 'settlement' ? 'Pon un pueblo' : 'Pon un camino') : `${game.turn} está poniendo`
    hint = myTurn
      ? game.setupNeed === 'settlement'
        ? 'Toca uno de los puntos blancos. Busca números con más puntitos: salen más.'
        : 'El camino sale del pueblo que acabas de poner.'
      : 'Colocación inicial: cada uno pone dos pueblos con su camino.'
  } else if (game.phase === 'discard') {
    title = game.discardNeed[me] ? `Bota ${game.discardNeed[me]} cartas` : `${other} está botando cartas`
    hint = 'Salió 7: quien tenga más de 7 cartas bota la mitad.'
  } else if (game.phase === 'robber') {
    title = myTurn ? 'Mueve el ladrón' : `${game.turn} mueve el ladrón`
    hint = myTurn ? 'Toca un hexágono: deja de producir y le robas una carta a tu pareja si tiene algo ahí.' : null
  } else if (game.phase === 'road_building') title = myTurn ? `Pon ${game.freeRoads} ${game.freeRoads === 1 ? 'camino gratis' : 'caminos gratis'}` : `${game.turn} está construyendo`
  else if (game.phase === 'roll') title = myTurn ? 'Lanza los dados' : `Juega ${game.turn}…`
  else title = myTurn ? (mode ? `Elige dónde va el ${COST_LABEL[mode][0].toLowerCase()}` : 'Construye, comercia o termina') : `Juega ${game.turn}…`

  const stolen = game.stolen
  return (
    <div className="rounded-[2rem] bg-paper p-5">
      <p className="font-display text-2xl font-extrabold" style={{ color: game.phase === 'finished' ? colorOf(game.winner) : colorOf(game.turn) }}>{title}</p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      {stolen?.res && game.log[game.log.length - 1]?.action === 'robber' && (
        <p className="mt-2 rounded-xl bg-stone px-3 py-2 text-sm">
          {stolen.thief === me ? `Le robaste 1 de ${RES_META[stolen.res].label.toLowerCase()} a ${stolen.victim}.` : `${stolen.thief} te robó 1 de ${RES_META[stolen.res].label.toLowerCase()}.`}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <Dice game={game} />
        {myTurn && game.phase === 'roll' && (
          <button onClick={() => send({ type: 'co_roll' })} autoFocus className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
            Lanzar dados
          </button>
        )}
        {myTurn && game.phase === 'main' && (
          <button onClick={() => send({ type: 'co_end' })} className="rounded-2xl border border-line px-4 py-2.5 font-semibold hover:border-ink">
            Terminar turno
          </button>
        )}
      </div>
    </div>
  )
}

function Hand({ game, me }) {
  const hand = game.hand
  if (!hand) return null
  return (
    <div className="rounded-[2rem] bg-paper p-4">
      <p className="mb-2 text-sm font-semibold text-muted">Tus cartas</p>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => (
          <div key={r} className={`flex flex-col items-center rounded-xl bg-stone py-2 transition-opacity ${hand[r] ? '' : 'opacity-45'}`} title={RES_META[r].label}>
            <ResourceIcon res={r} className="h-9 w-9" />
            <AnimatedNumber value={hand[r]} className="mt-1 font-display text-xl font-extrabold" />
            <span className="text-[0.62rem] text-muted">{RES_META[r].label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function CostChips({ cost }) {
  return (
    <span className="flex gap-0.5">
      {Object.entries(cost).flatMap(([r, n]) => Array.from({ length: n }, (_, i) => <ResourceIcon key={`${r}${i}`} res={r} className="h-4 w-4" />))}
    </span>
  )
}

function Build({ game, mode, setMode, send }) {
  const hand = game.hand
  const devCost = { wool: 1, grain: 1, ore: 1 }
  return (
    <div className="rounded-[2rem] bg-paper p-4">
      <p className="mb-2 text-sm font-semibold text-muted">Construir</p>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(COST_LABEL).map(([k, [label, cost]]) => {
          const ok = canPay(hand, cost) && (game.legal[k] ?? []).length > 0
          return (
            <button
              key={k}
              onClick={() => setMode(mode === k ? null : k)}
              disabled={!ok}
              className={`flex flex-col items-start gap-1 rounded-2xl border px-3 py-2 text-left text-sm font-semibold disabled:opacity-40 ${mode === k ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}
            >
              {label}
              <CostChips cost={cost} />
            </button>
          )
        })}
        <button
          onClick={() => send({ type: 'co_buy_dev' })}
          disabled={!canPay(hand, devCost) || !game.devDeck}
          className="flex flex-col items-start gap-1 rounded-2xl border border-line px-3 py-2 text-left text-sm font-semibold hover:border-ink disabled:opacity-40"
        >
          Carta de desarrollo
          <CostChips cost={devCost} />
        </button>
      </div>
    </div>
  )
}

function Devs({ game, me, myTurn, send, onPicker }) {
  const cards = game.devs ?? []
  if (!cards.length) return null
  const groups = {}
  for (const c of cards) {
    groups[c.kind] = groups[c.kind] ?? { n: 0, ready: 0 }
    groups[c.kind].n += 1
    if (!c.fresh) groups[c.kind].ready += 1
  }
  const canPlay = (kind) =>
    myTurn && !game.devPlayed && kind !== 'victory_point' && groups[kind].ready > 0 && (game.phase === 'main' || (game.phase === 'roll' && kind === 'knight'))
  return (
    <div className="rounded-[2rem] bg-paper p-4">
      <p className="mb-2 text-sm font-semibold text-muted">Tus cartas de desarrollo</p>
      <ul className="space-y-1.5">
        {Object.entries(groups).map(([kind, g]) => (
          <li key={kind} className="flex items-center justify-between gap-2 rounded-xl bg-stone px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {DEV_META[kind].label} {g.n > 1 && `×${g.n}`}
              </p>
              <p className="text-xs text-muted">{g.ready < g.n && kind !== 'victory_point' ? 'La de este turno se juega desde el próximo. ' : ''}{DEV_META[kind].text}</p>
            </div>
            {kind !== 'victory_point' && (
              <button
                disabled={!canPlay(kind)}
                onClick={() => (kind === 'year_of_plenty' || kind === 'monopoly' ? onPicker(kind) : send({ type: 'co_play_dev', card: kind }))}
                className="shrink-0 rounded-xl bg-ink px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-35"
              >
                Jugar
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Counter({ value, onChange, max }) {
  return (
    <div className="flex items-center gap-1">
      <button className="h-6 w-6 rounded-md bg-stone font-bold disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(value - 1)}>−</button>
      <span className="w-4 text-center font-semibold tabular-nums">{value}</span>
      <button className="h-6 w-6 rounded-md bg-stone font-bold disabled:opacity-30" disabled={max != null && value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

function Trade({ game, me, other, send }) {
  const [tab, setTab] = useState('bank')
  const [give, setGive] = useState('wood')
  const [get, setGet] = useState('ore')
  const [offerGive, setOfferGive] = useState({})
  const [offerGet, setOfferGet] = useState({})
  const hand = game.hand
  const rate = game.rates?.[give] ?? 4
  const myOffer = game.offer && game.offer.from === me ? game.offer : null
  const sum = (o) => Object.values(o).reduce((s, n) => s + n, 0)

  return (
    <div className="rounded-[2rem] bg-paper p-4">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1">
        {[['bank', 'Banco y puertos'], ['player', `Con ${other}`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-xl px-2 py-1.5 text-sm font-semibold ${tab === k ? 'bg-paper shadow-sm' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {tab === 'bank' ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-10 text-muted">Doy</span>
            <select value={give} onChange={(e) => setGive(e.target.value)} className="flex-1 rounded-xl border border-line bg-stone px-2 py-1.5">
              {RESOURCES.map((r) => <option key={r} value={r}>{game.rates[r]} de {RES_META[r].label.toLowerCase()}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-10 text-muted">Pido</span>
            <select value={get} onChange={(e) => setGet(e.target.value)} className="flex-1 rounded-xl border border-line bg-stone px-2 py-1.5">
              {RESOURCES.map((r) => <option key={r} value={r}>1 de {RES_META[r].label.toLowerCase()}</option>)}
            </select>
          </div>
          <button
            onClick={() => send({ type: 'co_bank', give, get })}
            disabled={give === get || hand[give] < rate || !game.bank[get]}
            className="w-full rounded-xl bg-ink py-2 font-semibold text-white disabled:opacity-35"
          >
            Cambiar {rate} por 1
          </button>
          <p className="text-xs text-muted">Con un pueblo en un puerto cambias 3 a 1 o 2 a 1 de su recurso.</p>
        </div>
      ) : myOffer ? (
        <div className="space-y-2 text-sm">
          <p>Le ofreciste a {other}:</p>
          <OfferSummary offer={myOffer} />
          <p className="text-muted">Esperando su respuesta…</p>
          <button onClick={() => send({ type: 'co_cancel' })} className="w-full rounded-xl border border-line py-2 font-semibold">Cancelar oferta</button>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted"><th className="text-left font-semibold">Recurso</th><th className="font-semibold">Doy</th><th className="font-semibold">Pido</th></tr>
            </thead>
            <tbody>
              {RESOURCES.map((r) => (
                <tr key={r}>
                  <td className="py-0.5"><span className="flex items-center gap-1.5"><ResourceIcon res={r} className="h-5 w-5" />{RES_META[r].label}</span></td>
                  <td><div className="flex justify-center"><Counter value={offerGive[r] ?? 0} max={hand[r]} onChange={(n) => setOfferGive({ ...offerGive, [r]: n })} /></div></td>
                  <td><div className="flex justify-center"><Counter value={offerGet[r] ?? 0} onChange={(n) => setOfferGet({ ...offerGet, [r]: n })} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            onClick={() => {
              send({ type: 'co_offer', give: offerGive, get: offerGet })
              setOfferGive({})
              setOfferGet({})
            }}
            disabled={!sum(offerGive) || !sum(offerGet)}
            className="w-full rounded-xl bg-ink py-2 font-semibold text-white disabled:opacity-35"
          >
            Proponer cambio
          </button>
        </div>
      )}
    </div>
  )
}

function OfferSummary({ offer, flip }) {
  const line = (o) =>
    Object.entries(o).map(([r, n]) => (
      <span key={r} className="inline-flex items-center gap-1 rounded-lg bg-stone px-2 py-0.5">
        {n} <ResourceIcon res={r} className="h-4 w-4" /> {RES_META[r].label.toLowerCase()}
      </span>
    ))
  const [a, b] = flip ? [offer.get, offer.give] : [offer.give, offer.get]
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-1"><span className="w-10 text-muted">Das</span>{line(a)}</p>
      <p className="flex flex-wrap items-center gap-1"><span className="w-10 text-muted">Recibes</span>{line(b)}</p>
    </div>
  )
}

function OfferModal({ game, send }) {
  const o = game.offer
  const can = Object.entries(o.get).every(([r, n]) => game.hand[r] >= n)
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 sm:bottom-6">
      <div className="pop w-full max-w-md rounded-3xl bg-paper p-5 shadow-2xl ring-1 ring-line">
        <p className="font-display text-xl font-bold">{o.from} te propone un cambio</p>
        <div className="mt-3 text-sm"><OfferSummary offer={o} flip /></div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => send({ type: 'co_accept' })} disabled={!can} className="rounded-2xl bg-ink py-2.5 font-semibold text-white disabled:opacity-40">
            {can ? 'Aceptar' : 'No te alcanza'}
          </button>
          <button onClick={() => send({ type: 'co_reject' })} className="rounded-2xl border border-line py-2.5 font-semibold">No, gracias</button>
        </div>
      </div>
    </div>
  )
}

function DiscardModal({ game, me, send }) {
  const need = game.discardNeed[me]
  const [pick, setPick] = useState({})
  const total = Object.values(pick).reduce((s, n) => s + n, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="pop w-full max-w-md rounded-3xl bg-paper p-5">
        <p className="font-display text-xl font-bold">Salió 7: bota {need} cartas</p>
        <p className="text-sm text-muted">Tienes más de 7, así que botas la mitad.</p>
        <div className="mt-3 space-y-1.5">
          {RESOURCES.map((r) => (
            <div key={r} className="flex items-center justify-between rounded-xl bg-stone px-3 py-1.5">
              <span className="flex items-center gap-2 text-sm font-semibold"><ResourceIcon res={r} className="h-6 w-6" />{RES_META[r].label} <span className="font-normal text-muted">({game.hand[r]})</span></span>
              <Counter value={pick[r] ?? 0} max={Math.min(game.hand[r], (pick[r] ?? 0) + need - total)} onChange={(n) => setPick({ ...pick, [r]: n })} />
            </div>
          ))}
        </div>
        <button onClick={() => send({ type: 'co_discard', cards: pick })} disabled={total !== need} className="mt-4 w-full rounded-2xl bg-ink py-3 font-semibold text-white disabled:opacity-40">
          Botar {total}/{need}
        </button>
      </div>
    </div>
  )
}

function PickerModal({ kind, onClose, send }) {
  const [picks, setPicks] = useState([])
  const title = kind === 'year_of_plenty' ? 'Elige dos recursos del banco' : '¿Qué recurso le quitas a tu pareja?'
  const need = kind === 'year_of_plenty' ? 2 : 1
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={onClose}>
      <div className="pop w-full max-w-sm rounded-3xl bg-paper p-5" onClick={(e) => e.stopPropagation()}>
        <p className="font-display text-xl font-bold">{title}</p>
        <div className="mt-3 grid grid-cols-5 gap-2">
          {RESOURCES.map((r) => (
            <button key={r} onClick={() => setPicks(picks.length < need ? [...picks, r] : [r])} className="flex flex-col items-center rounded-xl bg-stone py-2 hover:bg-line">
              <ResourceIcon res={r} className="h-9 w-9" />
              <span className="mt-1 text-[0.65rem]">{RES_META[r].label}</span>
              {picks.filter((x) => x === r).length > 0 && <span className="text-xs font-bold">×{picks.filter((x) => x === r).length}</span>}
            </button>
          ))}
        </div>
        <button
          disabled={picks.length !== need}
          onClick={() => {
            send(kind === 'year_of_plenty' ? { type: 'co_play_dev', card: 'year_of_plenty', resources: picks } : { type: 'co_play_dev', card: 'monopoly', resource: picks[0] })
            onClose()
          }}
          className="mt-4 w-full rounded-2xl bg-ink py-3 font-semibold text-white disabled:opacity-40"
        >
          Jugar
        </button>
      </div>
    </div>
  )
}

/* --- log ------------------------------------------------------------------ */

const WHAT = { road: 'un camino', settlement: 'un pueblo', city: 'una ciudad' }

function describe(l, me) {
  const you = l.player === me
  const who = you ? '' : `${l.player} `
  switch (l.action) {
    case 'settlement':
      return `${you ? 'Pusiste' : `${who}puso`} un pueblo`
    case 'road':
      return `${you ? 'Pusiste' : `${who}puso`} un camino`
    case 'initial':
      return `${you ? 'Recibiste' : `${who}recibió`} ${l.got.length} cartas iniciales`
    case 'roll':
      return `${you ? 'Sacaste' : `${who}sacó`} ${l.dice[0] + l.dice[1]}`
    case 'produce': {
      const mine = l.got?.[me] ?? {}
      const parts = Object.entries(mine).map(([r, n]) => `${n} de ${RES_META[r].label.toLowerCase()}`)
      return parts.length ? `Produjiste ${parts.join(', ')}` : 'Esta vez no produjiste nada'
    }
    case 'discard':
      return `${you ? 'Botaste' : `${who}botó`} ${l.count} cartas`
    case 'robber':
      return `${you ? 'Moviste' : `${who}movió`} el ladrón${l.stole ? ' y robó una carta' : ''}`
    case 'build':
      return `${you ? 'Construiste' : `${who}construyó`} ${WHAT[l.what]}`
    case 'bank':
      return `${you ? 'Cambiaste' : `${who}cambió`} ${l.rate} de ${RES_META[l.give].label.toLowerCase()} por 1 de ${RES_META[l.get].label.toLowerCase()}`
    case 'offer':
      return `${you ? 'Propusiste' : `${who}propuso`} un cambio`
    case 'accept':
      return `${you ? 'Aceptaste' : `${who}aceptó`} el cambio`
    case 'reject':
      return `${you ? 'Rechazaste' : `${who}rechazó`} el cambio`
    case 'buy_dev':
      return `${you ? 'Compraste' : `${who}compró`} una carta de desarrollo`
    case 'dev':
      return `${you ? 'Jugaste' : `${who}jugó`} ${DEV_META[l.card].label}`
    case 'monopoly':
      return `${you ? 'Te llevaste' : `${who}se llevó`} ${l.count} de ${RES_META[l.resource].label.toLowerCase()}`
    case 'win':
      return `¡${you ? 'Ganaste' : `${l.player} ganó`}!`
    default:
      return ''
  }
}

function Log({ game, me, colorOf }) {
  const items = useMemo(() => [...game.log].reverse().slice(0, 7), [game.log])
  if (!items.length) return null
  return (
    <ul className="space-y-1 rounded-[2rem] bg-paper p-4 text-sm">
      {items.map((l, i) => (
        <li key={`${game.log.length}-${i}`} className={i === 0 ? 'pop font-semibold' : 'text-muted'}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(l.player) }} />
          {describe(l, me)}
        </li>
      ))}
    </ul>
  )
}
