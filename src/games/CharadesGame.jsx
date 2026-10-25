import { useEffect, useState } from 'react'
import TimerBar from '../components/TimerBar'
import { useCountdown } from '../hooks/useCountdown'
import { EndActions, winnerTitle } from '../components/EndActions'

const HIT = 'hsl(148 42% 38%)'

export default function CharadesGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>
          Turno {game.turn} de {game.totalTurns}
        </span>
        <div className="flex gap-2">
          {Object.entries(game.scores).map(([p, n]) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-ink tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      </div>
      {game.phase === 'ready' && <Ready game={game} me={me} send={send} colorOf={colorOf} />}
      {game.phase === 'acting' && <Acting room={room} me={me} send={send} colorOf={colorOf} />}
      {game.phase === 'turn_over' && <TurnOver game={game} me={me} send={send} colorOf={colorOf} />}
    </div>
  )
}

function Ready({ game, me, send, colorOf }) {
  const mine = game.actor === me
  const color = colorOf(game.actor)
  return (
    <section className="mt-4 rounded-[2rem] p-6 text-white sm:p-10" style={{ background: color }}>
      {mine ? (
        <>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">Te toca actuar</h1>
          <ul className="mt-4 max-w-xl space-y-1.5 text-white/90">
            <li>Ponte donde tu pareja te vea bien en la videollamada.</li>
            <li>Nada de hablar, hacer sonidos ni señalar letras. Se vale todo lo demás.</li>
            <li>
              Cuando adivine, toca <strong>¡Adivinó!</strong>; si una carta está muy difícil, <strong>Pasar</strong>.
            </li>
            <li>Tienes {game.seconds} segundos para todas las que puedas.</li>
          </ul>
          <button
            onClick={() => send({ type: 'cg_start' })}
            className="mt-6 rounded-2xl bg-white px-8 py-4 font-display text-2xl font-extrabold text-ink"
          >
            ¡Empezar!
          </button>
        </>
      ) : (
        <>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{game.actor} va a actuar</h1>
          <p className="mt-3 max-w-xl text-white/90">
            Mírale por la videollamada y grita lo que creas que es. Cuando le dé a empezar, corre el reloj.
          </p>
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
  const [pop, setPop] = useState(0)

  useEffect(() => setPop((n) => n + 1), [game.hits])

  // En computador: Enter o espacio = adivinó, P = pasar
  useEffect(() => {
    if (!mine) return
    const onKey = (e) => {
      // Ojo: si el foco quedó en "Pasar", Enter lo activaría; por eso se cancela lo nativo
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
    <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start">
      <div>
        <div className="flex items-end justify-between">
          <p className="font-semibold" style={{ color }}>
            {mine ? 'Actúas tú' : `Actúa ${game.actor}`}
          </p>
          <span className={`font-display text-5xl font-extrabold tabular-nums ${urgent ? 'text-danger' : ''}`}>{left ?? game.seconds}</span>
        </div>
        <TimerBar seconds={game.seconds} resetKey={game.turn} msLeft={room.phaseEndsInMs} color={color} />

        <section
          key={mine ? game.card?.text : 'guess'}
          className="pop mt-4 flex min-h-[18rem] flex-col items-center justify-center rounded-[2rem] p-8 text-center text-white"
          style={{ background: color }}
        >
          {game.card?.category && (
            <span className="rounded-full bg-white/20 px-4 py-1 text-sm font-semibold">
              {game.card.category}
              {game.card.level === 'dificil' && ' · difícil'}
            </span>
          )}
          {mine ? (
            <p className="mt-4 font-display text-5xl font-extrabold leading-tight sm:text-6xl">{game.card?.text}</p>
          ) : (
            <>
              <p className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">¿Qué está haciendo?</p>
              <p className="mt-2 text-white/85">Adivina en voz alta por la videollamada.</p>
            </>
          )}
        </section>

        {mine && (
          <div className="mt-4 grid grid-cols-[2fr_1fr] gap-3">
            <button onClick={() => send({ type: 'cg_hit' })} className="rounded-2xl py-5 font-display text-2xl font-extrabold text-white" style={{ background: HIT }}>
              ¡Adivinó!
            </button>
            <button onClick={() => send({ type: 'cg_pass' })} className="rounded-2xl bg-paper py-5 font-display text-xl font-bold">
              Pasar
            </button>
          </div>
        )}
        {mine && <p className="mt-2 hidden text-xs text-muted sm:block">Atajos: Enter o espacio para ¡Adivinó!, P para pasar.</p>}
      </div>

      <aside className="rounded-[2rem] bg-paper p-5">
        <p className="text-sm font-semibold text-muted">Adivinadas en este turno</p>
        <p key={pop} className="pop font-display text-6xl font-extrabold tabular-nums" style={{ color: HIT }}>
          {game.hits}
        </p>
        <ul className="mt-3 space-y-1.5">
          {[...game.played].reverse().map((c, i) => (
            <li key={game.played.length - i} className={`text-sm ${c.result === 'hit' ? 'font-semibold' : 'text-muted line-through'}`}>
              {c.text}
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function TurnOver({ game, me, send, colorOf }) {
  const last = game.turn >= game.totalTurns
  const hits = game.played.filter((c) => c.result === 'hit')
  const passed = game.played.filter((c) => c.result === 'pass')
  return (
    <section className="pop mt-4 rounded-[2rem] bg-paper p-6 sm:p-8">
      <p className="font-semibold" style={{ color: colorOf(game.actor) }}>
        {game.actor === me ? 'Actuaste tú' : `Actuó ${game.actor}`}
      </p>
      <h1 className="font-display text-4xl font-extrabold">
        ¡Se acabó el tiempo! {hits.length} {hits.length === 1 ? 'adivinada' : 'adivinadas'}
      </h1>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: HIT }}>Adivinaron</p>
          <ul className="mt-2 space-y-1">
            {hits.map((c, i) => (
              <li key={i}>
                <span className="font-semibold">{c.text}</span> <span className="text-sm text-muted">· {c.category}</span>
              </li>
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
            <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
            <p className="text-xs text-muted">cartas que hizo adivinar</p>
          </div>
        ))}
      </div>
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.turn} className="rounded-2xl bg-paper px-4 py-3">
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
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'charades', ...game.options }} />
    </div>
  )
}
