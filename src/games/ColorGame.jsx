import { useState } from 'react'
import ColorSliders from '../components/ColorSliders'
import TimerBar from '../components/TimerBar'
import { useCountdown } from '../hooks/useCountdown'
import { hsbToCss, inkFor } from '../lib/color'

export default function ColorGame({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)

  if (game.phase === 'memorize') return <Memorize game={game} left={left} />
  if (game.phase === 'guess') {
    return <Guess key={game.round} game={game} me={me} send={send} left={left} msLeft={room.phaseEndsInMs} colorOf={colorOf} />
  }
  return <Reveal game={game} send={send} colorOf={colorOf} />
}

function RoundLabel({ game }) {
  return <span>Ronda {game.round} de {game.totalRounds}</span>
}

function Memorize({ game, left }) {
  const ink = inkFor(game.target)
  return (
    <div
      className="flood fixed inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ background: hsbToCss(game.target), color: ink }}
      role="status"
      aria-live="polite"
    >
      <p className="text-lg font-semibold"><RoundLabel game={game} /></p>
      <h1 className="text-4xl font-extrabold sm:text-6xl">Memoriza este color</h1>
      <p className="font-display text-8xl font-extrabold tabular-nums" aria-label={`${left ?? ''} segundos`}>
        {left ?? game.memorizeSeconds}
      </p>
    </div>
  )
}

function Guess({ game, me, send, left, msLeft, colorOf }) {
  // Punto de partida al azar para no favorecer ningún color
  const [color, setColor] = useState(() => ({
    h: Math.floor(Math.random() * 360),
    s: 30 + Math.floor(Math.random() * 40),
    b: 50 + Math.floor(Math.random() * 30),
  }))
  const sent = game.submitted.includes(me)
  const others = Object.keys(game.totals).filter((p) => p !== me)

  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between text-muted">
        <RoundLabel game={game} />
        <span className="tabular-nums">{left ?? game.guessSeconds} s</span>
      </div>
      <TimerBar seconds={game.guessSeconds} resetKey={game.round} msLeft={msLeft} />

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-start">
        <div
          className="aspect-square w-full rounded-[2rem] shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] max-md:aspect-auto max-md:h-[26dvh]"
          style={{ background: hsbToCss(color) }}
          aria-label="Tu color"
          role="img"
        />
        <div>
          <h1 className="text-3xl font-bold">{sent ? 'Color enviado' : '¿Cómo era el color?'}</h1>
          <p className="mt-1 text-muted">
            {sent ? 'Ya no puedes cambiarlo.' : 'Muévete por los tres deslizadores hasta que se parezca.'}
          </p>
          <div className="mt-6">
            <ColorSliders value={color} onChange={setColor} disabled={sent} />
          </div>
          <button
            onClick={() => send({ type: 'color_guess', color })}
            disabled={sent}
            className="mt-7 w-full rounded-2xl px-5 py-4 text-lg font-semibold text-white disabled:opacity-50"
            style={{ background: colorOf(me) }}
          >
            {sent ? 'Enviado' : 'Enviar mi color'}
          </button>
          <ul className="mt-4 space-y-1 text-sm">
            {others.map((p) => (
              <li key={p} style={{ color: colorOf(p) }} className="font-semibold">
                {game.submitted.includes(p) ? `${p} ya envió su color` : `${p} está eligiendo…`}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function Reveal({ game, send, colorOf }) {
  const players = Object.keys(game.totals)
  const finished = game.phase === 'finished'
  const ranking = [...players].sort((a, b) => game.totals[b] - game.totals[a])
  const tie = players.length > 1 && game.totals[ranking[0]] === game.totals[ranking[1]]

  return (
    <div className="mt-4">
      <div className="text-muted"><RoundLabel game={game} /></div>

      <section className="mt-3 overflow-hidden rounded-[2rem] bg-paper">
        <div
          className="flex h-40 items-end p-5 sm:h-52"
          style={{ background: hsbToCss(game.target), color: inkFor(game.target) }}
        >
          <span className="text-lg font-semibold">El color era este</span>
        </div>
        <div className="grid gap-1 border-t-4 border-paper" style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}>
          {players.map((p) => {
            const guess = game.guesses[p]
            return (
              <div key={p} className="bg-paper">
                <div
                  className="flex h-28 items-center justify-center text-sm font-semibold sm:h-36"
                  style={guess ? { background: hsbToCss(guess), color: inkFor(guess) } : undefined}
                >
                  {!guess && <span className="text-muted">Sin respuesta</span>}
                </div>
                <div className="p-5">
                  <p className="font-semibold" style={{ color: colorOf(p) }}>{p}</p>
                  <p className="font-display text-5xl font-extrabold tabular-nums">
                    {game.roundScores[p]?.toFixed(1) ?? '0.0'}
                  </p>
                  <p className="text-sm text-muted">de 10. Total: {game.totals[p].toFixed(1)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {finished ? (
        <section className="mt-8">
          <h1 className="text-4xl font-extrabold">
            {players.length < 2 ? `Terminaste con ${game.totals[ranking[0]].toFixed(1)} puntos` : tie ? 'Empate perfecto' : `Ganó ${ranking[0]}`}
          </h1>
          <History game={game} players={players} />
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => send({ type: 'start_game', game: 'color', rounds: game.totalRounds })}
              className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white"
            >
              Jugar otra vez
            </button>
            <button
              onClick={() => send({ type: 'back_to_lobby' })}
              className="rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink"
            >
              Volver a los juegos
            </button>
          </div>
        </section>
      ) : (
        <button
          onClick={() => send({ type: 'next_round' })}
          className="mt-6 w-full rounded-2xl bg-ink px-5 py-4 text-lg font-semibold text-white sm:w-auto"
        >
          Siguiente ronda
        </button>
      )}
    </div>
  )
}

function History({ game, players }) {
  return (
    <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
      {game.history.map((r) => (
        <li key={r.round} className="flex items-center gap-3">
          <span className="w-6 text-sm text-muted tabular-nums">{r.round}</span>
          <span className="h-10 w-16 rounded-xl" style={{ background: hsbToCss(r.target) }} title="Color real" />
          {players.map((p) => (
            <span key={p} className="flex items-center gap-2">
              <span
                className="h-10 w-10 rounded-xl border border-line"
                style={r.guesses[p] ? { background: hsbToCss(r.guesses[p]) } : undefined}
                title={`Intento de ${p}`}
              />
              <span className="w-10 text-sm tabular-nums">{r.scores[p].toFixed(1)}</span>
            </span>
          ))}
        </li>
      ))}
    </ol>
  )
}
