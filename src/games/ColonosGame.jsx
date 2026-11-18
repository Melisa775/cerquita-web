/**
 * Colonos (Catan-style), redesigned around a 3D board.
 *
 * Layout: the island fills a big stage with the essentials floating on top of
 * it (both players, what to do now, the dice and the actions), and a side
 * panel holds the hand, development cards, trading and the history. On
 * phones the panel simply goes below the stage.
 *
 * The server stays the same: every action is one of the co_* messages and
 * the board only lights up the spots the server says are legal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { animate } from 'animejs'
import Board3D from './colonos/Board3D'
import { useSoundOn } from '../hooks/useSoundOn'
import { MuteButton } from '../components/stage/hud'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import { EndActions } from '../components/EndActions'
import { DEV_META, RESOURCES, RES_META, ResourceIcon, TERRAIN } from '../lib/colonos'

const BUILDS = {
  road: { label: 'Camino', key: '1', cost: { wood: 1, brick: 1 }, points: 'Conecta tus pueblos' },
  settlement: { label: 'Pueblo', key: '2', cost: { wood: 1, brick: 1, wool: 1, grain: 1 }, points: '+1 punto' },
  city: { label: 'Ciudad', key: '3', cost: { grain: 2, ore: 3 }, points: '+1 punto, produce doble' },
}
const DEV_COST = { wool: 1, grain: 1, ore: 1 }
const resColor = (r) => TERRAIN[RES_META[r].terrain].fill
const canPay = (hand, cost) => !!hand && Object.entries(cost).every(([r, n]) => (hand[r] ?? 0) >= n)
const total = (o) => Object.values(o ?? {}).reduce((s, n) => s + n, 0)

// CSS colors like var(--color-p1) → a real color three.js understands
function cssColor(value) {
  const m = /var\((--[^)]+)\)/.exec(value ?? '')
  if (!m) return value
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888888'
}

export default function ColonosGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const order = game.order ?? game.players
  if (import.meta.env.DEV) window.__colonosGame = game // lets the browser tests read the game
  const isBot = (p) => (game.bots ?? []).includes(p)
  const finished = game.phase === 'finished'
  useSoundOn(finished, 'fanfare') // trumpets for the winner
  const myTurn = game.turn === me && !finished
  const [mode, setMode] = useState(null) // build mode chosen by the player: road | settlement | city
  const [picker, setPicker] = useState(null) // year_of_plenty | monopoly
  const [flash, setFlash] = useState(null)
  const [panel, setPanel] = useState('trade')
  const board = useRef(null)

  // The board lights up whatever the server allows right now
  const autoMode = myTurn && game.phase === 'setup' ? game.setupNeed : myTurn && game.phase === 'road_building' ? 'road' : null
  const activeMode = autoMode ?? (myTurn && game.phase === 'main' ? mode : null)
  const targets = useMemo(() => {
    if (myTurn && game.phase === 'robber') return { kind: 'robber', ids: game.legal.robber ?? [] }
    if (!activeMode) return null
    return { kind: activeMode, ids: game.legal[activeMode] ?? [] }
  }, [myTurn, game.phase, game.legal, activeMode])

  useEffect(() => setMode(null), [game.phase, game.turn])
  useEffect(() => {
    if (error) setFlash({ text: error, id: errorId })
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 3200)
    return () => clearTimeout(id)
  }, [flash])

  const colors = useMemo(() => Object.fromEntries(game.players.map((p) => [p, cssColor(colorOf(p))])), [game.players, colorOf])
  const sceneState = useMemo(
    () => ({ board: game.board, buildings: game.buildings, roads: game.roads, colors, me, targets }),
    [game.board, game.buildings, game.roads, colors, me, targets],
  )

  const onPick = useCallback(
    (kind, id) => {
      if (kind === 'robber') send({ type: 'co_robber', hex: id })
      else if (game.phase === 'setup') send({ type: 'co_place', target: id })
      else send({ type: 'co_build', what: kind, target: id })
      if (game.phase === 'main') setMode(null)
    },
    [send, game.phase],
  )

  // After every roll the producing tiles glow and their resources float up
  const lastRoll = useRef(game.rollId)
  useEffect(() => {
    if (game.rollId !== lastRoll.current && game.dice) board.current?.rolled(game.dice[0] + game.dice[1], game.board.robber)
    lastRoll.current = game.rollId
  }, [game.rollId, game.dice, game.board.robber])

  const chooseBuild = (k) => setMode((m) => (m === k ? null : k))

  // Keyboard: space rolls, Enter ends the turn, 1-3 build, 4 buys a card, Esc cancels, R resets the view
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (k === 'r') board.current?.resetView()
      if (!myTurn) return
      if ((k === ' ' || k === 'd') && game.phase === 'roll') {
        e.preventDefault()
        send({ type: 'co_roll' })
      } else if (k === 'enter' && game.phase === 'main' && !e.target.closest?.('button')) {
        send({ type: 'co_end' })
      } else if (game.phase === 'main' && ['1', '2', '3'].includes(k)) {
        const what = Object.keys(BUILDS).find((b) => BUILDS[b].key === k)
        if (canPay(game.hand, BUILDS[what].cost) && (game.legal[what] ?? []).length) chooseBuild(what)
      } else if (game.phase === 'main' && k === '4' && canPay(game.hand, DEV_COST) && game.devDeck) {
        send({ type: 'co_buy_dev' })
      } else if (k === 'escape') setMode(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [myTurn, game.phase, game.hand, game.legal, game.devDeck, send])

  return (
    <div className="mt-2 grid gap-4 lg:grid-cols-[minmax(0,1fr)_23rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
      {/* --- the stage: 3D island with the HUD on top --------------------- */}
      <section className="relative h-[min(72dvh,42rem)] min-h-[24rem] overflow-hidden rounded-[2rem] shadow-[0_24px_60px_-30px_rgba(34,37,46,.6)] lg:h-[calc(100dvh-7.5rem)] lg:max-h-none" style={{ background: 'linear-gradient(#BFE3F2, #8FCBE8)' }}>
        <Board3D ref={board} state={sceneState} onPick={onPick} />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3 sm:p-4">
          <div className="flex items-start justify-between gap-2">
            <Plates game={game} me={me} order={order} isBot={isBot} colorOf={colorOf} />
            <DiceTray game={game} />
          </div>

          <div className="flex flex-col items-center gap-2">
            <Banner game={game} me={me} colorOf={colorOf} mode={activeMode} />
            {myTurn && game.phase === 'steal' && (
              <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
                {(game.legal.steal ?? []).map((p) => (
                  <button
                    key={p}
                    onClick={() => send({ type: 'co_steal', victim: p })}
                    className="rounded-full px-5 py-2.5 font-bold text-white shadow-lg"
                    style={{ background: colorOf(p) }}
                  >
                    Robarle a {p} ({game.playersInfo[p].cards} 🂠)
                  </button>
                ))}
              </div>
            )}
            <AnimatePresence>
              {flash && (
                <motion.p
                  key={flash.id}
                  className="pointer-events-auto rounded-full bg-danger px-4 py-1.5 text-sm font-semibold text-white shadow-lg"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1, x: [0, -6, 6, -3, 0] }}
                  exit={{ opacity: 0 }}
                  role="alert"
                >
                  {flash.text}
                </motion.p>
              )}
            </AnimatePresence>
            {myTurn && !finished && (
              <ActionBar game={game} mode={mode} chooseBuild={chooseBuild} send={send} color={colorOf(me)} />
            )}
          </div>
        </div>

        <ViewButtons board={board} />
        {finished && <Finish game={game} me={me} send={send} colorOf={colorOf} />}
      </section>

      {/* --- side panel ------------------------------------------------------ */}
      <aside className="flex min-w-0 flex-col gap-3 lg:max-h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1">
        <Hand game={game} me={me} />
        <DevCards game={game} myTurn={myTurn} send={send} onPicker={setPicker} />
        <section className="rounded-[1.6rem] bg-paper p-1.5">
          <div className="grid grid-cols-2 gap-1 rounded-[1.2rem] bg-stone p-1" role="tablist">
            {[['trade', 'Comercio'], ['log', 'Historial']].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={panel === k} onClick={() => setPanel(k)} className={`rounded-xl py-1.5 text-sm font-semibold ${panel === k ? 'bg-paper shadow-sm' : 'text-muted'}`}>
                {l}
              </button>
            ))}
          </div>
          <div className="p-3">
            {panel === 'trade' ? <Trade game={game} me={me} myTurn={myTurn} send={send} /> : <Log game={game} me={me} colorOf={colorOf} />}
          </div>
        </section>
      </aside>

      <AnimatePresence>
        {game.offer && game.offer.from !== me && !game.offer.rejected?.includes(me) && !finished && <OfferSheet key="offer" game={game} send={send} />}
        {game.discardNeed?.[me] > 0 && <DiscardModal key="discard" game={game} me={me} send={send} />}
        {picker && <PickerModal key="picker" kind={picker} onClose={() => setPicker(null)} send={send} />}
      </AnimatePresence>
    </div>
  )
}
ColonosGame.showsErrors = true

/* --- HUD: players ------------------------------------------------------------- */

function Plates({ game, me, order, isBot, colorOf }) {
  // you first, then the others in turn order
  const list = [me, ...order.slice(order.indexOf(me) + 1), ...order.slice(0, Math.max(0, order.indexOf(me)))].filter((p) => game.playersInfo[p])
  const many = list.length > 2
  return (
    // information only: taps go through to the board
    <div className={`flex min-w-0 gap-1.5 ${many ? 'flex-wrap' : ''}`}>
      {list.map((p) => {
        const info = game.playersInfo[p]
        const active = game.turn === p && game.phase !== 'finished'
        const pct = Math.min(1, info.points / game.goal)
        return (
          <motion.div
            key={p}
            layout
            className="flex min-w-0 items-center gap-2 rounded-2xl bg-paper/90 py-1 pl-1 pr-2.5 shadow-sm backdrop-blur sm:gap-2.5 sm:py-1.5 sm:pl-1.5 sm:pr-3"
            animate={{ scale: active ? 1 : 0.94, opacity: active ? 1 : 0.85 }}
            style={active ? { boxShadow: `0 0 0 3px ${colorOf(p)}` } : undefined}
            transition={softSpring}
          >
            {/* points as a ring that fills up toward the goal */}
            <div className="relative h-9 w-9 shrink-0 sm:h-11 sm:w-11">
              <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                <circle cx="22" cy="22" r="19" fill="none" stroke="var(--color-line)" strokeWidth="4" />
                <motion.circle
                  cx="22" cy="22" r="19" fill="none" stroke={colorOf(p)} strokeWidth="4" strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 19}
                  animate={{ strokeDashoffset: 2 * Math.PI * 19 * (1 - pct) }}
                  transition={{ duration: 0.8 }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-extrabold">
                <AnimatedNumber value={info.points} />
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold" style={{ color: colorOf(p) }}>
                {p}{p === me && ' (tú)'}{isBot(p) && <span className="ml-1 rounded-full bg-stone px-1.5 text-[0.6rem] font-bold text-muted">bot</span>}
              </p>
              <p className={`hidden gap-2 text-xs text-muted ${many ? 'xl:flex' : 'sm:flex'}`} aria-label={`${info.cards} cartas, ${info.devCount} de desarrollo, ${info.knights} soldados, camino de ${info.road}`}>
                <span title="Cartas de recurso">🂠 {info.cards}</span>
                <span title="Cartas de desarrollo">✦ {info.devCount}</span>
                <span title="Soldados jugados">⚔ {info.knights}</span>
                <span title="Camino más largo">↝ {info.road}</span>
              </p>
              {(game.longest === p || game.army === p) && (
                <p className="mt-0.5 flex gap-1 text-[0.65rem] font-bold">
                  {game.longest === p && <span className="rounded-full bg-ink px-1.5 text-white">Camino +2</span>}
                  {game.army === p && <span className="rounded-full bg-ink px-1.5 text-white">Ejército +2</span>}
                </p>
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

/* --- HUD: what to do now ----------------------------------------------------- */

function phaseText(game, me, mode) {
  const myTurn = game.turn === me
  if (game.phase === 'finished') return [game.winner === me ? '¡Ganaste!' : `Ganó ${game.winner}`, null]
  if (game.phase === 'setup') {
    if (!myTurn) return [`${game.turn} está poniendo`, 'Colocación inicial: dos pueblos con su camino cada uno.']
    return game.setupNeed === 'settlement'
      ? ['Pon un pueblo', 'Toca un punto brillante. Los números con más puntitos salen más seguido.']
      : ['Pon un camino', 'Sale del pueblo que acabas de poner.']
  }
  if (game.phase === 'discard') return [game.discardNeed?.[me] ? `Bota ${game.discardNeed[me]} cartas` : `${Object.keys(game.discardNeed ?? {}).join(' y ')} ${Object.keys(game.discardNeed ?? {}).length > 1 ? 'están' : 'está'} botando cartas`, 'Salió 7: quien tiene más de 7 cartas bota la mitad.']
  if (game.phase === 'steal') return myTurn ? ['¿A quién le robas?', 'El ladrón quedó junto a varios: elige a quién quitarle una carta.'] : [`${game.turn} está eligiendo a quién robarle`, null]
  if (game.phase === 'robber') return myTurn ? ['Mueve el ladrón', 'Toca un hexágono brillante: deja de producir y robas una carta.'] : [`${game.turn} mueve el ladrón`, null]
  if (game.phase === 'road_building') return myTurn ? [`Pon ${game.freeRoads} ${game.freeRoads === 1 ? 'camino gratis' : 'caminos gratis'}`, null] : [`${game.turn} está construyendo`, null]
  if (game.phase === 'roll') return myTurn ? ['Te toca: lanza los dados', 'Espacio para lanzar.'] : [`Turno de ${game.turn}`, null]
  if (mode) return [`¿Dónde va el ${BUILDS[mode].label.toLowerCase()}?`, 'Toca un lugar brillante. Esc para cancelar.']
  return myTurn ? ['Construye, comercia o termina', null] : [`Juega ${game.turn}…`, null]
}

function Banner({ game, me, colorOf, mode }) {
  const [title, hint] = phaseText(game, me, mode)
  const who = game.phase === 'finished' ? game.winner : game.turn
  const stolen = game.stolen?.res && game.log.at(-1)?.action === 'steal' ? game.stolen : null
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={`${title}-${stolen ? 's' : ''}`}
        className="max-w-[min(100%,34rem)] rounded-2xl bg-paper/92 px-4 py-2 text-center shadow-md backdrop-blur"
        initial={{ y: 16, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -10, opacity: 0, transition: { duration: 0.15 } }}
        transition={spring}
        aria-live="polite"
      >
        <p className="font-display text-lg font-extrabold sm:text-xl" style={{ color: colorOf(who) }}>{title}</p>
        {hint && <p className="text-xs text-muted sm:text-sm">{hint}</p>}
        {stolen && (
          <p className="mt-0.5 text-sm font-semibold">
            {stolen.thief === me ? `Le robaste 1 de ${RES_META[stolen.res].label.toLowerCase()} a ${stolen.victim}.` : `${stolen.thief} te robó 1 de ${RES_META[stolen.res].label.toLowerCase()}.`}
          </p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}

/* --- HUD: dice ------------------------------------------------------------------ */

const PIPS = {
  1: [[50, 50]],
  2: [[27, 27], [73, 73]],
  3: [[27, 27], [50, 50], [73, 73]],
  4: [[27, 27], [73, 27], [27, 73], [73, 73]],
  5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[27, 25], [73, 25], [27, 50], [73, 50], [27, 75], [73, 75]],
}

function Die({ value, red }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-md">
      <rect x="3" y="3" width="94" height="94" rx="22" fill="white" />
      <rect x="3" y="3" width="94" height="94" rx="22" fill="none" stroke="rgba(0,0,0,.12)" strokeWidth="3" />
      {PIPS[value].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill={red ? '#C0392B' : '#22252E'} />)}
    </svg>
  )
}

function DiceTray({ game }) {
  const refs = [useRef(null), useRef(null)]
  const [faces, setFaces] = useState(game.dice ?? null)
  const first = useRef(true)

  // Each roll tumbles the dice with anime.js, flicking through faces before landing
  useEffect(() => {
    if (!game.dice) return
    if (first.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      first.current = false
      setFaces(game.dice)
      return
    }
    let n = 0
    const tick = setInterval(() => {
      n++
      setFaces([1 + ((n * 5 + 2) % 6), 1 + ((n * 3 + 4) % 6)])
    }, 70)
    const stop = setTimeout(() => {
      clearInterval(tick)
      setFaces(game.dice)
    }, 650)
    refs.forEach((r, i) =>
      r.current && animate(r.current, { rotate: [i ? 420 : -480, 0], translateY: [-40, 0], scale: [0.6, 1], duration: 900, ease: 'outBounce' }),
    )
    return () => {
      clearInterval(tick)
      clearTimeout(stop)
    }
  }, [game.rollId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!faces) return null
  const sum = game.dice ? game.dice[0] + game.dice[1] : null
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-2xl bg-paper/90 p-1 pr-2 shadow-sm backdrop-blur sm:gap-1.5 sm:p-1.5 sm:pr-3" aria-label={sum ? `Dados: ${sum}` : 'Dados'}>
      {faces.map((v, i) => (
        <div key={i} ref={refs[i]} className="h-8 w-8 sm:h-11 sm:w-11">
          <Die value={v} red={sum === 7} />
        </div>
      ))}
      {sum && <span className={`ml-1 font-display text-2xl font-extrabold tabular-nums ${sum === 7 ? 'text-danger' : ''}`}>{sum}</span>}
    </div>
  )
}

/* --- HUD: actions --------------------------------------------------------------- */

function BuildIcon({ kind }) {
  if (kind === 'road') return <svg viewBox="0 0 24 24" className="h-6 w-6"><rect x="3" y="10" width="18" height="5" rx="2.5" fill="currentColor" transform="rotate(-25 12 12)" /></svg>
  if (kind === 'settlement') return <svg viewBox="0 0 24 24" className="h-6 w-6"><path d="M5 20V11l7-6 7 6v9z" fill="currentColor" /></svg>
  if (kind === 'city') return <svg viewBox="0 0 24 24" className="h-6 w-6"><path d="M3 20v-8l5-4 5 4v-6h8v14z" fill="currentColor" /></svg>
  return <svg viewBox="0 0 24 24" className="h-6 w-6"><rect x="6" y="3" width="12" height="18" rx="2.5" fill="currentColor" /><path d="M12 8l1.3 2.7 3 .4-2.2 2 .6 3-2.7-1.5-2.7 1.5.6-3-2.2-2 3-.4z" fill="white" /></svg>
}

function CostDots({ cost, hand }) {
  return (
    <span className="flex gap-0.5">
      {Object.entries(cost).flatMap(([r, n]) =>
        Array.from({ length: n }, (_, i) => (
          <span
            key={`${r}${i}`}
            className="h-2.5 w-2.5 rounded-full ring-1 ring-white/70"
            style={{ background: resColor(r), opacity: (hand?.[r] ?? 0) > i ? 1 : 0.3 }}
            title={RES_META[r].label}
          />
        )),
      )}
    </span>
  )
}

function ActionBar({ game, mode, chooseBuild, send, color }) {
  const hand = game.hand
  if (game.phase === 'roll') {
    return (
      <motion.button
        onClick={() => send({ type: 'co_roll' })}
        className="pointer-events-auto rounded-full px-8 py-3.5 font-display text-xl font-extrabold text-white shadow-xl"
        style={{ background: color }}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [1, 1.05, 1], opacity: 1 }}
        transition={{ scale: { duration: 1.6, repeat: Infinity }, opacity: { duration: 0.2 } }}
        autoFocus
      >
        🎲 Lanzar dados
      </motion.button>
    )
  }
  if (game.phase !== 'main') return null
  return (
    <motion.div
      className="pointer-events-auto flex max-w-full items-stretch gap-1.5 overflow-x-auto rounded-[1.4rem] bg-paper/92 p-1.5 shadow-xl backdrop-blur"
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
    >
      {Object.entries(BUILDS).map(([k, b]) => {
        const ok = canPay(hand, b.cost) && (game.legal[k] ?? []).length > 0
        const active = mode === k
        return (
          <button
            key={k}
            onClick={() => chooseBuild(k)}
            disabled={!ok}
            aria-pressed={active}
            title={`${b.label} (${b.key}) · ${b.points}`}
            className={`flex min-w-[4.6rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-xs font-bold disabled:opacity-35 ${active ? 'text-white' : 'hover:bg-stone'}`}
            style={active ? { background: color } : undefined}
          >
            <BuildIcon kind={k} />
            {b.label}
            <CostDots cost={b.cost} hand={hand} />
          </button>
        )
      })}
      <button
        onClick={() => send({ type: 'co_buy_dev' })}
        disabled={!canPay(hand, DEV_COST) || !game.devDeck}
        title="Carta de desarrollo (4)"
        className="flex min-w-[4.6rem] flex-col items-center gap-1 rounded-2xl px-2.5 py-1.5 text-xs font-bold hover:bg-stone disabled:opacity-35"
      >
        <BuildIcon kind="dev" />
        Carta
        <CostDots cost={DEV_COST} hand={hand} />
      </button>
      <span className="mx-0.5 w-px self-stretch bg-line" />
      <button
        onClick={() => send({ type: 'co_end' })}
        title="Terminar turno (Enter)"
        className="min-w-[5.5rem] rounded-2xl bg-ink px-3 text-sm font-bold text-white"
      >
        Terminar turno
      </button>
    </motion.div>
  )
}

function ViewButtons({ board }) {
  const btn = 'flex h-9 w-9 items-center justify-center rounded-full bg-paper/90 text-lg font-bold shadow-sm backdrop-blur hover:bg-paper'
  return (
    <div className="absolute bottom-3 left-3 hidden flex-col gap-1.5 sm:flex">
      <button className={btn} onClick={() => board.current?.zoom(1)} aria-label="Acercar">+</button>
      <button className={btn} onClick={() => board.current?.zoom(-1)} aria-label="Alejar">−</button>
      <button className={btn} onClick={() => board.current?.resetView()} aria-label="Centrar la vista (R)" title="Centrar la vista (R)">⟲</button>
      <MuteButton className={btn} />
    </div>
  )
}

/* --- side panel: hand ------------------------------------------------------------ */

function Hand({ game, me }) {
  const hand = game.hand
  // what the last roll gave me, shown as a short "+1" over each card
  const gain = useMemo(() => {
    const last = [...game.log].reverse().find((l) => l.action === 'produce' || l.action === 'roll')
    return last?.action === 'produce' ? last.got?.[me] ?? {} : {}
  }, [game.log, me])
  if (!hand) return null
  const count = total(hand)
  return (
    <section className="rounded-[1.6rem] bg-paper p-3">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="font-bold">Tu mano</h2>
        <span className={`text-sm ${count > 7 ? 'font-semibold text-danger' : 'text-muted'}`} title={count > 7 ? 'Si sale 7, botas la mitad' : undefined}>
          {count} {count === 1 ? 'carta' : 'cartas'}{count > 7 && ' · ¡cuidado con el 7!'}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {RESOURCES.map((r) => (
          <ResourceCard key={r} res={r} n={hand[r] ?? 0} gain={gain[r]} rollId={game.rollId} />
        ))}
      </div>
    </section>
  )
}

function ResourceCard({ res, n, gain, rollId }) {
  return (
    <motion.div
      className="relative flex aspect-[3/4] flex-col items-center justify-between overflow-hidden rounded-xl p-1.5 text-white shadow-sm"
      style={{ background: `linear-gradient(160deg, ${resColor(res)}, color-mix(in srgb, ${resColor(res)} 70%, black))` }}
      animate={{ opacity: n ? 1 : 0.4, y: 0 }}
      whileHover={{ y: -4 }}
      transition={spring}
      title={RES_META[res].label}
    >
      <ResourceIcon res={res} className="mt-1 h-8 w-8 rounded-lg ring-2 ring-white/40" />
      <AnimatedNumber value={n} className="font-display text-2xl font-extrabold drop-shadow" />
      <span className="text-[0.6rem] font-semibold uppercase tracking-wide opacity-90">{RES_META[res].label}</span>
      <AnimatePresence>
        {gain > 0 && (
          <motion.span
            key={rollId}
            className="absolute right-1 top-1 rounded-full bg-white px-1.5 text-xs font-extrabold text-ink"
            initial={{ scale: 0, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.6 }}
          >
            +{gain}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* --- side panel: development cards ----------------------------------------------- */

const DEV_ICON = { knight: '⚔', road_building: '🛤', year_of_plenty: '🌾', monopoly: '👑', victory_point: '★' }

function DevCards({ game, myTurn, send, onPicker }) {
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
    <section className="rounded-[1.6rem] bg-paper p-3">
      <h2 className="mb-2 px-1 font-bold">Cartas de desarrollo</h2>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(groups).map(([kind, g], i) => (
          <motion.div
            key={kind}
            className="flex flex-col rounded-2xl bg-[hsl(258_32%_40%)] p-2.5 text-white"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            transition={{ ...spring, delay: i * 0.05 }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl" aria-hidden="true">{DEV_ICON[kind]}</span>
              {g.n > 1 && <span className="rounded-full bg-white/20 px-2 text-xs font-bold">×{g.n}</span>}
            </div>
            <p className="mt-1 font-bold leading-tight">{DEV_META[kind].label}</p>
            <p className="mt-0.5 flex-1 text-[0.7rem] leading-snug text-white/75">
              {g.ready < g.n && kind !== 'victory_point' ? 'La nueva se juega desde el próximo turno. ' : ''}
              {DEV_META[kind].text}
            </p>
            {kind !== 'victory_point' && (
              <button
                disabled={!canPlay(kind)}
                onClick={() => (kind === 'year_of_plenty' || kind === 'monopoly' ? onPicker(kind) : send({ type: 'co_play_dev', card: kind }))}
                className="mt-2 rounded-xl bg-white py-1.5 text-sm font-bold text-ink disabled:opacity-35"
              >
                Jugar
              </button>
            )}
          </motion.div>
        ))}
      </div>
    </section>
  )
}

/* --- side panel: trade ------------------------------------------------------------ */

function ResPicker({ value, onChange, rates, hand, disabledFor }) {
  return (
    <div className="grid grid-cols-5 gap-1">
      {RESOURCES.map((r) => {
        const off = disabledFor?.(r)
        return (
          <button
            key={r}
            onClick={() => onChange(r)}
            disabled={off}
            aria-pressed={value === r}
            className={`flex flex-col items-center rounded-xl p-1 text-[0.65rem] font-semibold disabled:opacity-30 ${value === r ? 'bg-ink text-white' : 'bg-stone hover:bg-line'}`}
            title={RES_META[r].label}
          >
            <ResourceIcon res={r} className="h-7 w-7" />
            {rates ? `${rates[r]}:1` : hand ? `tienes ${hand[r]}` : RES_META[r].label}
          </button>
        )
      })}
    </div>
  )
}

function Stepper({ value, onChange, max }) {
  return (
    <div className="flex items-center gap-1">
      <button className="h-7 w-7 rounded-lg bg-stone font-bold disabled:opacity-30" disabled={value <= 0} onClick={() => onChange(value - 1)} aria-label="Menos">−</button>
      <span className="w-5 text-center font-bold tabular-nums">{value}</span>
      <button className="h-7 w-7 rounded-lg bg-stone font-bold disabled:opacity-30" disabled={max != null && value >= max} onClick={() => onChange(value + 1)} aria-label="Más">+</button>
    </div>
  )
}

function Trade({ game, me, myTurn, send }) {
  const others = game.players.filter((p) => p !== me)
  const [tab, setTab] = useState('bank')
  const [give, setGive] = useState(null)
  const [get, setGet] = useState(null)
  const [offerGive, setOfferGive] = useState({})
  const [offerGet, setOfferGet] = useState({})
  const hand = game.hand
  if (!hand) return null
  if (!myTurn || game.phase !== 'main') {
    return <p className="py-2 text-sm text-muted">Se comercia durante tu turno, después de lanzar los dados.</p>
  }
  const rate = give ? game.rates?.[give] ?? 4 : null
  const myOffer = game.offer && game.offer.from === me ? game.offer : null

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone p-1">
        {[['bank', 'Banco y puertos'], ['player', others.length === 1 ? `Con ${others[0]}` : 'Con los demás']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-1 font-semibold ${tab === k ? 'bg-paper shadow-sm' : 'text-muted'}`}>{l}</button>
        ))}
      </div>
      {tab === 'bank' ? (
        <>
          <p className="font-semibold">Doy</p>
          <ResPicker value={give} onChange={setGive} rates={game.rates} disabledFor={(r) => hand[r] < game.rates[r]} />
          <p className="font-semibold">Recibo</p>
          <ResPicker value={get} onChange={setGet} disabledFor={(r) => r === give || !game.bank[r]} />
          <button
            onClick={() => {
              send({ type: 'co_bank', give, get })
              setGet(null)
            }}
            disabled={!give || !get || give === get}
            className="w-full rounded-xl bg-ink py-2.5 font-bold text-white disabled:opacity-35"
          >
            {give && get ? `Cambiar ${rate} de ${RES_META[give].label.toLowerCase()} por 1 de ${RES_META[get].label.toLowerCase()}` : 'Elige qué das y qué recibes'}
          </button>
          <p className="text-xs text-muted">4 por 1 con el banco. Un pueblo en un puerto lo baja a 3:1 o a 2:1 de su recurso.</p>
        </>
      ) : myOffer ? (
        <div className="space-y-2">
          <p>{others.length === 1 ? `Le ofreciste a ${others[0]}:` : 'Ofreciste a todos:'}</p>
          <OfferSummary offer={myOffer} />
          {myOffer.rejected?.length > 0 && <p className="text-muted">Dijeron que no: {myOffer.rejected.join(', ')}</p>}
          <p className="animate-pulse text-muted">{others.length === 1 ? 'Esperando su respuesta…' : 'El primero que acepte se queda con el cambio…'}</p>
          <button onClick={() => send({ type: 'co_cancel' })} className="w-full rounded-xl border border-line py-2 font-semibold">Cancelar oferta</button>
        </div>
      ) : (
        <>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-muted"><th className="text-left font-semibold">Recurso</th><th className="font-semibold">Doy</th><th className="font-semibold">Pido</th></tr>
            </thead>
            <tbody>
              {RESOURCES.map((r) => (
                <tr key={r}>
                  <td className="py-0.5"><span className="flex items-center gap-1.5"><ResourceIcon res={r} className="h-6 w-6" />{RES_META[r].label}</span></td>
                  <td><div className="flex justify-center"><Stepper value={offerGive[r] ?? 0} max={hand[r]} onChange={(n) => setOfferGive({ ...offerGive, [r]: n })} /></div></td>
                  <td><div className="flex justify-center"><Stepper value={offerGet[r] ?? 0} onChange={(n) => setOfferGet({ ...offerGet, [r]: n })} /></div></td>
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
            disabled={!total(offerGive) || !total(offerGet)}
            className="w-full rounded-xl bg-ink py-2.5 font-bold text-white disabled:opacity-35"
          >
            Proponer cambio
          </button>
        </>
      )}
    </div>
  )
}

function OfferSummary({ offer, flip }) {
  const line = (o) =>
    Object.entries(o).filter(([, n]) => n).map(([r, n]) => (
      <span key={r} className="inline-flex items-center gap-1 rounded-lg bg-stone px-2 py-0.5 font-semibold">
        {n} <ResourceIcon res={r} className="h-4 w-4" />
      </span>
    ))
  const [a, b] = flip ? [offer.get, offer.give] : [offer.give, offer.get]
  return (
    <div className="space-y-1">
      <p className="flex flex-wrap items-center gap-1"><span className="w-16 text-muted">Das</span>{line(a)}</p>
      <p className="flex flex-wrap items-center gap-1"><span className="w-16 text-muted">Recibes</span>{line(b)}</p>
    </div>
  )
}

/* --- side panel: history ---------------------------------------------------------- */

const WHAT = { road: 'un camino', settlement: 'un pueblo', city: 'una ciudad' }

function describe(l, me) {
  const you = l.player === me
  const who = you ? '' : `${l.player} `
  switch (l.action) {
    case 'settlement': return `${you ? 'Pusiste' : `${who}puso`} un pueblo`
    case 'road': return `${you ? 'Pusiste' : `${who}puso`} un camino`
    case 'initial': return `${you ? 'Recibiste' : `${who}recibió`} ${l.got.length} cartas iniciales`
    case 'roll': return `${you ? 'Sacaste' : `${who}sacó`} ${l.dice[0] + l.dice[1]}`
    case 'produce': {
      const mine = l.got?.[me] ?? {}
      const parts = Object.entries(mine).map(([r, n]) => `${n} de ${RES_META[r].label.toLowerCase()}`)
      return parts.length ? `Produjiste ${parts.join(', ')}` : 'Esta vez no produjiste nada'
    }
    case 'discard': return `${you ? 'Botaste' : `${who}botó`} ${l.count} cartas`
    case 'robber': return `${you ? 'Moviste' : `${who}movió`} el ladrón`
    case 'steal': return `${you ? 'Le robaste' : `${who}le robó`} una carta a ${l.victim === me ? 'ti' : l.victim}`
    case 'build': return `${you ? 'Construiste' : `${who}construyó`} ${WHAT[l.what]}`
    case 'bank': return `${you ? 'Cambiaste' : `${who}cambió`} ${l.rate} de ${RES_META[l.give].label.toLowerCase()} por 1 de ${RES_META[l.get].label.toLowerCase()}`
    case 'offer': return `${you ? 'Propusiste' : `${who}propuso`} un cambio`
    case 'accept': return `${you ? 'Aceptaste' : `${who}aceptó`} el cambio`
    case 'reject': return `${you ? 'Rechazaste' : `${who}rechazó`} el cambio`
    case 'buy_dev': return `${you ? 'Compraste' : `${who}compró`} una carta de desarrollo`
    case 'dev': return `${you ? 'Jugaste' : `${who}jugó`} ${DEV_META[l.card].label}`
    case 'monopoly': return `${you ? 'Te llevaste' : `${who}se llevó`} ${l.count} de ${RES_META[l.resource].label.toLowerCase()}`
    case 'win': return `¡${you ? 'Ganaste' : `${l.player} ganó`}!`
    default: return ''
  }
}

function Log({ game, me, colorOf }) {
  const items = [...game.log].reverse()
  if (!items.length) return <p className="py-2 text-sm text-muted">Aquí aparece lo que va pasando.</p>
  return (
    <ul className="max-h-72 space-y-1.5 overflow-y-auto text-sm">
      {items.map((l, i) => (
        <motion.li
          key={game.log.length - i}
          className={`flex items-start gap-2 ${i === 0 ? 'font-semibold' : 'text-muted'}`}
          initial={i === 0 ? { opacity: 0, x: -10 } : false}
          animate={{ opacity: 1, x: 0 }}
        >
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: colorOf(l.player) }} />
          {describe(l, me)}
        </motion.li>
      ))}
    </ul>
  )
}

/* --- modals ----------------------------------------------------------------------- */

function Sheet({ children, onClose, bottom = false }) {
  return (
    <motion.div
      className={`fixed inset-0 z-50 flex justify-center bg-ink/35 p-4 ${bottom ? 'items-end sm:items-center' : 'items-center'}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-3xl bg-paper p-5 shadow-2xl"
        initial={{ y: 60, scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function OfferSheet({ game, send }) {
  const o = game.offer
  const can = Object.entries(o.get).every(([r, n]) => (game.hand?.[r] ?? 0) >= n)
  return (
    <Sheet bottom>
      <p className="font-display text-xl font-bold">{o.from} te propone un cambio</p>
      <div className="mt-3 text-sm"><OfferSummary offer={o} flip /></div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={() => send({ type: 'co_accept' })} disabled={!can} className="rounded-2xl bg-ink py-3 font-bold text-white disabled:opacity-40">
          {can ? 'Aceptar' : 'No te alcanza'}
        </button>
        <button onClick={() => send({ type: 'co_reject' })} className="rounded-2xl border border-line py-3 font-bold">No, gracias</button>
      </div>
    </Sheet>
  )
}

function DiscardModal({ game, me, send }) {
  const need = game.discardNeed[me]
  const [pick, setPick] = useState({})
  const chosen = total(pick)
  return (
    <Sheet>
      <p className="font-display text-xl font-bold">Salió 7: bota {need} cartas</p>
      <p className="text-sm text-muted">Tienes más de 7, así que botas la mitad.</p>
      <div className="mt-3 space-y-1.5">
        {RESOURCES.map((r) => (
          <div key={r} className="flex items-center justify-between rounded-xl bg-stone px-3 py-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold"><ResourceIcon res={r} className="h-7 w-7" />{RES_META[r].label} <span className="font-normal text-muted">({game.hand[r]})</span></span>
            <Stepper value={pick[r] ?? 0} max={Math.min(game.hand[r], (pick[r] ?? 0) + need - chosen)} onChange={(n) => setPick({ ...pick, [r]: n })} />
          </div>
        ))}
      </div>
      <button onClick={() => send({ type: 'co_discard', cards: pick })} disabled={chosen !== need} className="mt-4 w-full rounded-2xl bg-ink py-3 font-bold text-white disabled:opacity-40">
        Botar {chosen}/{need}
      </button>
    </Sheet>
  )
}

function PickerModal({ kind, onClose, send }) {
  const [picks, setPicks] = useState([])
  const plenty = kind === 'year_of_plenty'
  const need = plenty ? 2 : 1
  return (
    <Sheet onClose={onClose}>
      <p className="font-display text-xl font-bold">{plenty ? 'Elige dos recursos del banco' : '¿Qué recurso le quitas a tu pareja?'}</p>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {RESOURCES.map((r) => {
          const n = picks.filter((x) => x === r).length
          return (
            <button key={r} onClick={() => setPicks(picks.length < need ? [...picks, r] : [r])} className={`relative flex flex-col items-center rounded-xl py-2 ${n ? 'bg-ink text-white' : 'bg-stone hover:bg-line'}`}>
              <ResourceIcon res={r} className="h-9 w-9" />
              <span className="mt-1 text-[0.65rem] font-semibold">{RES_META[r].label}</span>
              {n > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-danger px-1.5 text-xs font-bold text-white">×{n}</span>}
            </button>
          )
        })}
      </div>
      <button
        disabled={picks.length !== need}
        onClick={() => {
          send(plenty ? { type: 'co_play_dev', card: 'year_of_plenty', resources: picks } : { type: 'co_play_dev', card: 'monopoly', resource: picks[0] })
          onClose()
        }}
        className="mt-4 w-full rounded-2xl bg-ink py-3 font-bold text-white disabled:opacity-40"
      >
        Jugar
      </button>
    </Sheet>
  )
}

function Finish({ game, me, send, colorOf }) {
  const won = game.winner === me
  return (
    <motion.div
      className="absolute inset-0 z-20 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
    >
      <motion.div
        className="w-full max-w-sm rounded-3xl bg-paper p-6 text-center shadow-2xl"
        initial={{ scale: 0.6, y: 40, rotate: -3 }}
        animate={{ scale: 1, y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.7 }}
      >
        <p className="text-5xl" aria-hidden="true">🏆</p>
        <p className="mt-2 font-display text-3xl font-extrabold" style={{ color: colorOf(game.winner) }}>{won ? '¡Ganaste!' : `Ganó ${game.winner}`}</p>
        <p className="mt-1 text-muted">
          {game.players.map((p) => `${p}: ${game.playersInfo[p].points}`).join(' · ')}
        </p>
        <div className="flex justify-center"><EndActions send={send} replay={{ type: 'start_game', game: 'colonos', ...game.options }} /></div>
      </motion.div>
    </motion.div>
  )
}
