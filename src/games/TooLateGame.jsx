import { useEffect, useState } from 'react'
import TimerBar from '../components/TimerBar'
import { EndActions, winnerTitle } from '../components/EndActions'
import { useCountdown } from '../hooks/useCountdown'

export default function TooLateGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} send={send} colorOf={colorOf} />
  return <Board room={room} me={me} send={send} colorOf={colorOf} />
}

function Scores({ game, colorOf }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(game.scores).map(([p, n]) => (
        <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
          <span style={{ color: colorOf(p) }}>{p}</span> <span className="tabular-nums">{n}</span>
        </span>
      ))}
    </div>
  )
}

function Board({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)
  const [sentFor, setSentFor] = useState(null) // evita mandar dos letras en el mismo turno
  const usedBy = Object.fromEntries(game.used.map((u) => [u.letter, u.player]))
  const lastUsed = game.used.at(-1)
  const myTurn = game.phase === 'playing' && game.turn === me
  const canPick = myTurn && sentFor !== game.turnId

  function pick(letter) {
    if (!canPick || usedBy[letter] || !game.letters.includes(letter)) return
    setSentFor(game.turnId)
    send({ type: 'tl_pick', letter })
  }

  // En computador también se puede jugar con el teclado
  useEffect(() => {
    if (!canPick) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      const letter = e.key.toUpperCase()
      if (letter.length === 1) pick(letter)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>Ronda {game.round} de {game.totalRounds}</span>
        <Scores game={game} colorOf={colorOf} />
      </div>

      <section className="mt-3 rounded-[2rem] bg-paper p-6">
        <p className="text-sm font-semibold text-muted">Categoría</p>
        <h1 className="mt-1 text-3xl font-extrabold sm:text-4xl">{game.category}</h1>
      </section>

      <div className="mt-4">
        {game.phase === 'ready' && <Ready game={game} me={me} send={send} colorOf={colorOf} />}
        {game.phase === 'playing' && (
          <Turn game={game} me={me} left={left} msLeft={room.phaseEndsInMs} send={send} colorOf={colorOf} lastUsed={lastUsed} />
        )}
        {game.phase === 'round_over' && <RoundOver game={game} send={send} />}
      </div>

      <div className="mt-5 grid grid-cols-5 gap-2 sm:grid-cols-7" role="group" aria-label="Tablero de letras">
        {game.letters.map((l) => {
          const by = usedBy[l]
          const isLast = lastUsed?.letter === l
          return (
            <button
              key={l}
              onClick={() => pick(l)}
              disabled={!canPick || !!by}
              aria-label={by ? `${l}, usada por ${by}` : `Letra ${l}`}
              className={`aspect-square rounded-2xl font-display text-3xl font-extrabold transition-transform sm:text-4xl ${
                by
                  ? 'text-white'
                  : canPick
                    ? 'bg-paper shadow-[inset_0_0_0_2px_var(--color-ink)] hover:bg-ink hover:text-white active:scale-95'
                    : 'bg-paper text-ink/70'
              } ${isLast ? 'ring-4 ring-ink ring-offset-2 ring-offset-stone' : ''}`}
              style={by ? { background: colorOf(by), opacity: isLast ? 1 : 0.55 } : undefined}
            >
              {l}
            </button>
          )
        })}
      </div>
      <p className="mt-3 text-sm text-muted">
        {game.used.length} de {game.letters.length} letras
      </p>
    </div>
  )
}

function Ready({ game, me, send, colorOf }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-lg">
        Empieza{' '}
        <strong style={{ color: colorOf(game.turn) }}>{game.turn === me ? 'tú' : game.turn}</strong>.
        {' '}Si la categoría no les gusta, cámbienla.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => send({ type: 'tl_reroll' })}
          className="rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink"
        >
          Otra categoría
        </button>
        <button onClick={() => send({ type: 'tl_begin' })} className="rounded-2xl bg-ink px-6 py-3 font-semibold text-white">
          ¡Empezar!
        </button>
      </div>
    </div>
  )
}

function Turn({ game, me, left, msLeft, send, colorOf, lastUsed }) {
  const mine = game.turn === me
  const color = colorOf(game.turn)
  return (
    <div className="rounded-[2rem] p-5 text-white" style={{ background: color }} aria-live="polite">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-display text-3xl font-extrabold">{mine ? '¡Tu turno!' : `Turno de ${game.turn}`}</p>
          <p className="mt-1 text-white/85">
            {mine
              ? 'Di una palabra en voz alta y toca la letra con la que empieza.'
              : `Escucha a ${game.turn}. Si su palabra no vale, toquen ¡No vale!`}
          </p>
        </div>
        <span className="font-display text-6xl font-extrabold tabular-nums" aria-label={`${left ?? game.turnSeconds} segundos`}>
          {left ?? game.turnSeconds}
        </span>
      </div>
      <TimerBar seconds={game.turnSeconds} resetKey={game.turnId} msLeft={msLeft} color="white" track="bg-white/30" />
      {lastUsed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-white/85">
            {lastUsed.player === me ? 'Tocaste' : `${lastUsed.player} tocó`} la <strong className="text-white">{lastUsed.letter}</strong>
          </span>
          <button
            onClick={() => send({ type: 'tl_undo' })}
            className="rounded-xl bg-white/20 px-4 py-2 font-semibold hover:bg-white/30"
          >
            ¡No vale!
          </button>
        </div>
      )}
    </div>
  )
}

function RoundOver({ game, send }) {
  const r = game.result
  const players = Object.keys(game.scores)
  const winner = r.type === 'timeout' ? players.find((p) => p !== r.loser) : null
  const last = game.round >= game.totalRounds
  return (
    <div className="rounded-[2rem] bg-ink p-6 text-white">
      {r.type === 'completed' ? (
        <>
          <p className="font-display text-4xl font-extrabold">¡Lo lograron!</p>
          <p className="mt-1 text-white/80">Usaron las {game.letters.length} letras. Punto para los dos.</p>
        </>
      ) : (
        <>
          <p className="font-display text-4xl font-extrabold">
            ¡Too late, {r.loser}!
          </p>
          <p className="mt-1 text-white/80">
            {winner ? `Se le acabó el tiempo. Punto para ${winner}.` : 'Se acabó el tiempo.'} Llegaron a {game.used.length} letras.
          </p>
        </>
      )}
      <button
        onClick={() => send({ type: 'next_round' })}
        className="mt-5 rounded-2xl bg-white px-5 py-3 font-semibold text-ink"
      >
        {last ? 'Ver resultados' : 'Siguiente ronda'}
      </button>
    </div>
  )
}

function Final({ game, send, colorOf }) {
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.scores)}</h1>
      <div className="mt-4"><Scores game={game} colorOf={colorOf} /></div>
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-baseline gap-x-3 rounded-2xl bg-paper px-4 py-3">
            <span className="w-5 text-sm text-muted tabular-nums">{h.round}</span>
            <span className="font-semibold">{h.category}</span>
            <span className="text-sm text-muted">
              {h.result.type === 'completed'
                ? `¡Completaron las ${h.letters} letras!`
                : <>{h.letters} letras · perdió <span style={{ color: colorOf(h.result.loser) }}>{h.result.loser}</span></>}
            </span>
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'toolate', ...game.options }} />
    </div>
  )
}
