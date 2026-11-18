/**
 * Caras y gestos on the 3D card table: the actor sees the card face up, the
 * guesser sees its back. Guessed cards fly to the right pile, passed ones to
 * the left.
 */
import { useEffect, useMemo, useRef } from 'react'
import TimerBar from '../components/TimerBar'
import { useCountdown } from '../hooks/useCountdown'
import { EndActions, winnerTitle } from '../components/EndActions'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import Stage3D from '../components/stage/Stage3D'
import { Panel, Plates, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/cards3d.js')

const HIT = 'hsl(148 42% 38%)'

export default function CharadesGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play room={room} me={me} send={send} colorOf={colorOf} />
}

function Play({ room, me, send, colorOf }) {
  const game = room.game
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  const mine = game.actor === me
  const acting = game.phase === 'acting'
  const actorColor = useMemo(() => cssColor(colorOf(game.actor)), [colorOf, game.actor])
  const last = game.played.at(-1)
  const state = useMemo(() => {
    const showWord = mine && acting && game.card
    return {
      key: acting ? `${game.turn}-${game.played.length}` : `ready-${game.turn}`,
      text: showWord ? game.card.text : mine ? 'Te toca actuar' : '¿Qué está haciendo?',
      label: showWord && game.card.category ? `${game.card.category}${game.card.level === 'hard' ? ' · difícil' : ''}` : '',
      sub: showWord ? 'Sin hablar ni hacer sonidos' : mine ? '' : 'Adivina en voz alta',
      bg: actorColor,
      ink: '#FFFFFF',
      faceDown: !showWord,
      back: { color: actorColor, word: '?' },
      result: last?.result,
      hits: game.phase === 'ready' ? 0 : game.played.filter((c) => c.result === 'hit').length,
      passes: game.phase === 'ready' ? 0 : game.played.filter((c) => c.result === 'pass').length,
      table: '#2F4858',
    }
  }, [mine, acting, game.card, game.turn, game.played, game.phase, actorColor, last])

  const plates = Object.entries(game.scores).map(([p, n]) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: n,
    max: 0,
    stats: `Turno ${game.turn} de ${game.totalTurns}`,
    active: game.actor === p,
  }))

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#EFE7DF, #D8C8BA)"
      stage={<Stage3D ref={stageRef} load={load} state={state} label="Mesa de cartas en 3D" />}
      top={<Plates players={plates} />}
      bottom={
        <div className="pointer-events-auto w-full max-w-xl">
          {game.phase === 'ready' && <Ready game={game} me={me} send={send} colorOf={colorOf} />}
          {acting && <Acting room={room} me={me} send={send} colorOf={colorOf} />}
          {game.phase === 'turn_over' && <TurnOver game={game} me={me} send={send} colorOf={colorOf} />}
        </div>
      }
      aside={
        <Panel title="Este turno" right={<span className="font-display text-2xl font-extrabold tabular-nums" style={{ color: HIT }}>{game.hits}</span>}>
          <ul className="space-y-1.5 px-1">
            {[...game.played].reverse().map((c, i) => (
              <motion.li
                key={game.played.length - i}
                className={`text-sm ${c.result === 'hit' ? 'font-semibold' : 'text-muted line-through'}`}
                initial={i === 0 ? { opacity: 0, x: c.result === 'hit' ? 16 : -16 } : false}
                animate={{ opacity: 1, x: 0 }}
                transition={spring}
              >
                {c.text}
              </motion.li>
            ))}
            {!game.played.length && <li className="text-sm text-muted">Aquí aparecen las cartas que van saliendo.</li>}
          </ul>
        </Panel>
      }
    />
  )
}

function Ready({ game, me, send, colorOf }) {
  const mine = game.actor === me
  const color = colorOf(game.actor)
  return (
    <section className="rounded-[2rem] p-5 text-white shadow-xl sm:p-6" style={{ background: color }}>
      {mine ? (
        <>
          <h1 className="font-display text-3xl font-extrabold">Te toca actuar</h1>
          <ul className="mt-2 space-y-1 text-sm text-white/90">
            <li>Ponte donde tu pareja te vea bien en la videollamada.</li>
            <li>Nada de hablar, hacer sonidos ni señalar letras. Se vale todo lo demás.</li>
            <li>Tienes {game.seconds} segundos para todas las que puedas.</li>
          </ul>
          <button onClick={() => send({ type: 'cg_start' })} className="mt-4 rounded-2xl bg-white px-8 py-3.5 font-display text-2xl font-extrabold text-ink">
            ¡Empezar!
          </button>
        </>
      ) : (
        <>
          <h1 className="font-display text-3xl font-extrabold">{game.actor} va a actuar</h1>
          <p className="mt-2 text-white/90">Mírale por la videollamada y grita lo que creas que es. Cuando le dé a empezar, corre el reloj.</p>
        </>
      )}
    </section>
  )
}

function Acting({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)
  const mine = game.actor === me
  const color = colorOf(game.actor)

  // On desktop: Enter or space = guessed, P = pass
  useEffect(() => {
    if (!mine) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        send({ type: 'cg_hit' })
      } else if (e.key.toLowerCase() === 'p') send({ type: 'cg_pass' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mine, send])

  const urgent = left != null && left <= 10
  return (
    <div className="space-y-2">
      <div className="rounded-2xl bg-paper/95 px-4 py-2 shadow-md backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold" style={{ color }}>{mine ? 'Actúas tú' : `Actúa ${game.actor}: adivina en voz alta`}</p>
          <motion.span
            key={left}
            className={`font-display text-4xl font-extrabold tabular-nums ${urgent ? 'text-danger' : ''}`}
            initial={urgent ? { scale: 1.45 } : false}
            animate={{ scale: 1 }}
            transition={spring}
          >
            {left ?? game.seconds}
          </motion.span>
        </div>
        <TimerBar seconds={game.seconds} resetKey={game.turn} msLeft={room.phaseEndsInMs} color={color} />
      </div>
      {mine && (
        <div className="grid grid-cols-[2fr_1fr] gap-2">
          <button onClick={() => send({ type: 'cg_hit' })} className="rounded-2xl py-4 font-display text-2xl font-extrabold text-white shadow-lg" style={{ background: HIT }}>
            ¡Adivinó!
          </button>
          <button onClick={() => send({ type: 'cg_pass' })} className="rounded-2xl bg-paper py-4 font-display text-xl font-bold shadow-lg">
            Pasar
          </button>
        </div>
      )}
    </div>
  )
}

function TurnOver({ game, me, send, colorOf }) {
  const last = game.turn >= game.totalTurns
  const hits = game.played.filter((c) => c.result === 'hit')
  const passed = game.played.filter((c) => c.result === 'pass')
  return (
    <section className="pop max-h-[75vh] overflow-y-auto rounded-[2rem] bg-paper p-5 shadow-xl sm:p-6">
      <p className="font-semibold" style={{ color: colorOf(game.actor) }}>
        {game.actor === me ? 'Actuaste tú' : `Actuó ${game.actor}`}
      </p>
      <h1 className="font-display text-3xl font-extrabold">
        ¡Se acabó el tiempo! {hits.length} {hits.length === 1 ? 'adivinada' : 'adivinadas'}
      </h1>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: HIT }}>Adivinaron</p>
          <ul className="mt-2 space-y-1">
            {hits.map((c, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: 0.2 + 0.06 * i }}>
                <span className="font-semibold">{c.text}</span> <span className="text-sm text-muted">· {c.category}</span>
              </motion.li>
            ))}
            {!hits.length && <li className="text-muted">Ninguna esta vez.</li>}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-muted">Pasaron</p>
          <ul className="mt-2 space-y-1 text-muted">
            {passed.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
            {!passed.length && <li>Ninguna.</li>}
          </ul>
        </div>
      </div>
      <button onClick={() => send({ type: 'next_round' })} className="mt-6 rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
        {last ? 'Ver resultados' : 'Siguiente turno'}
      </button>
    </section>
  )
}

function Final({ game, me, send, colorOf }) {
  const total = game.history.reduce((s, h) => s + h.hits, 0)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.scores, 'cartas')}</h1>
      <p className="mt-1 text-muted">Entre los dos adivinaron {total} cartas.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(game.scores).map(([p, n]) => (
          <div key={p} className="rounded-2xl bg-paper px-5 py-3">
            <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
            <p className="font-display text-4xl font-extrabold"><AnimatedNumber value={n} from={0} duration={1} /></p>
            <p className="text-xs text-muted">cartas que hizo adivinar</p>
          </div>
        ))}
      </div>
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <motion.li
            key={h.turn}
            className="rounded-2xl bg-paper px-4 py-3"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.1 * h.turn }}
          >
            <p className="text-sm">
              <span className="text-muted">Turno {h.turn} · </span>
              <span className="font-semibold" style={{ color: colorOf(h.actor) }}>{h.actor}</span>
              <span className="text-muted"> · {h.hits} adivinadas</span>
            </p>
            <p className="mt-1 text-sm">
              {h.cards.map((c, i) => (
                <span key={i} className={c.result === 'hit' ? '' : 'text-muted line-through'}>
                  {c.text}
                  {i < h.cards.length - 1 && ' · '}
                </span>
              ))}
            </p>
          </motion.li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'charades', ...game.options }} />
    </div>
  )
}
