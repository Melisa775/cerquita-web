import { useEffect, useState } from 'react'
import Avatar from '../components/Avatar'
import { EndActions, winnerTitle } from '../components/EndActions'

export default function GuessWhoGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} error={error} errorId={errorId} />
}

function Play({ game, me, send, colorOf }) {
  const byId = Object.fromEntries(game.characters.map((c) => [c.id, c]))
  const isPlayer = game.players.includes(me)
  const other = game.players.find((p) => p !== me)
  const playing = game.phase === 'playing'
  const myTurn = playing && game.turn === me && !game.pending
  const [guessing, setGuessing] = useState(false)
  const [picked, setPicked] = useState(null)
  // Bajar personajes se siente al instante; el servidor confirma después
  const [flipped, setFlipped] = useState(() => new Set(game.flipped))

  useEffect(() => setFlipped(new Set(game.flipped)), [game.flipped.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!myTurn) {
      setGuessing(false)
      setPicked(null)
    }
  }, [myTurn])

  function onCard(id) {
    if (!playing || !isPlayer) return
    if (guessing) {
      setPicked(id)
      return
    }
    const next = new Set(flipped)
    next.has(id) ? next.delete(id) : next.add(id)
    setFlipped(next)
    send({ type: 'gw_flip', id })
  }

  const cols = game.characters.length > 16 ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-4'

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>Ronda {game.round} de {game.totalRounds}</span>
        <div className="flex gap-2">
          {Object.entries(game.scores).map(([p, n]) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-ink tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-6">
        <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1">
          {guessing && (
            <p className="mb-3 rounded-2xl bg-ink px-4 py-3 text-center font-semibold text-white">
              Toca a quien crees que es. Si fallas, pierdes la ronda.
            </p>
          )}
          <div className={`grid gap-2 sm:gap-3 ${cols}`}>
            {game.characters.map((c) => (
              <Card
                key={c.id}
                c={c}
                down={flipped.has(c.id)}
                onClick={() => onCard(c.id)}
                guessing={guessing}
                picked={picked === c.id}
                backColor={colorOf(me)}
                disabled={!playing || !isPlayer}
              />
            ))}
          </div>
          {playing && isPlayer && !guessing && (
            <p className="mt-3 text-sm text-muted">Toca un personaje para bajarlo o volverlo a subir. Solo tú ves tu tablero.</p>
          )}
        </div>

        <aside className="order-first space-y-4 lg:order-none lg:col-start-2 lg:row-start-1">
          {game.phase === 'round_over' ? (
            <RoundOver game={game} me={me} byId={byId} send={send} colorOf={colorOf} />
          ) : (
            <>
              {game.mySecret && <Secret c={byId[game.mySecret]} color={colorOf(me)} />}
              {isPlayer && (
                <TurnPanel
                  game={game}
                  me={me}
                  other={other}
                  myTurn={myTurn}
                  guessing={guessing}
                  setGuessing={setGuessing}
                  picked={picked ? byId[picked] : null}
                  setPicked={setPicked}
                  send={send}
                  colorOf={colorOf}
                />
              )}
            </>
          )}
        </aside>
        <div className="lg:col-start-2 lg:row-start-2">
          <Log game={game} me={me} colorOf={colorOf} other={other} />
        </div>
      </div>
    </div>
  )
}

function Card({ c, down, onClick, guessing, picked, backColor, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={down}
      aria-label={`${c.name}${down ? ', bajado' : ''}`}
      className="group relative aspect-[3/4] [perspective:700px] disabled:cursor-default"
    >
      <span
        className="absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d]"
        style={{ transform: down ? 'rotateY(180deg)' : 'none' }}
      >
        <span
          className={`absolute inset-0 flex flex-col overflow-hidden rounded-2xl bg-paper [backface-visibility:hidden] ${
            picked ? 'ring-4 ring-ink ring-offset-2 ring-offset-stone' : guessing ? 'ring-2 ring-ink/40' : ''
          }`}
        >
          <Avatar c={c} zoom className="min-h-0 w-full flex-1" />
          <span className="truncate px-1 py-1 text-xs font-semibold sm:text-sm">{c.name}</span>
        </span>
        <span
          className="absolute inset-0 flex items-center justify-center rounded-2xl [backface-visibility:hidden] [transform:rotateY(180deg)]"
          style={{ background: backColor }}
        >
          <svg width="40%" viewBox="0 0 32 32" aria-hidden="true">
            <circle cx="11" cy="16" r="8" fill="white" fillOpacity=".35" />
            <circle cx="21" cy="16" r="8" fill="white" fillOpacity=".55" />
          </svg>
        </span>
      </span>
    </button>
  )
}

function Secret({ c, color }) {
  return (
    <div className="flex items-center gap-4 rounded-[2rem] bg-paper p-4">
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl" style={{ boxShadow: `0 0 0 3px ${color}` }}>
        <Avatar c={c} className="h-full w-full" />
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Tu personaje</p>
        <p className="font-display text-2xl font-extrabold">{c.name}</p>
        <p className="text-xs text-muted">Tu pareja tiene que adivinarlo.</p>
      </div>
    </div>
  )
}

function TurnPanel({ game, me, other, myTurn, guessing, setGuessing, picked, setPicked, send, colorOf }) {
  const [question, setQuestion] = useState('')
  const [free, setFree] = useState('')
  const asked = new Set(game.log.filter((l) => l.asker === me && l.auto).map((l) => l.text))

  if (game.pending) {
    if (game.pending.asker === me) {
      return (
        <Panel>
          <p className="text-muted">Le preguntaste a {other}:</p>
          <p className="mt-1 font-display text-xl font-bold">{game.pending.text}</p>
          <p className="mt-3 animate-pulse text-sm text-muted">Esperando su respuesta…</p>
        </Panel>
      )
    }
    return (
      <Panel accent={colorOf(game.pending.asker)}>
        <p className="text-white/80">{game.pending.asker} pregunta:</p>
        <p className="mt-1 font-display text-2xl font-extrabold text-white">{game.pending.text}</p>
        <p className="mt-1 text-sm text-white/80">Responde pensando en tu personaje.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => send({ type: 'gw_answer', yes: true })} className="rounded-2xl bg-white px-4 py-3 font-bold text-ink">
            Sí
          </button>
          <button onClick={() => send({ type: 'gw_answer', yes: false })} className="rounded-2xl bg-white/20 px-4 py-3 font-bold text-white">
            No
          </button>
        </div>
      </Panel>
    )
  }

  if (!myTurn) {
    return (
      <Panel>
        <p className="font-semibold">
          Turno de <span style={{ color: colorOf(game.turn) }}>{game.turn}</span>
        </p>
        <p className="mt-1 text-sm text-muted">Mientras pregunta, puedes ir bajando personajes en tu tablero.</p>
      </Panel>
    )
  }

  if (guessing) {
    return (
      <Panel>
        {picked ? (
          <>
            <p className="font-display text-xl font-bold">¿Es {picked.name}?</p>
            <p className="mt-1 text-sm text-muted">Si aciertas ganas la ronda. Si fallas, la gana {other}.</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => send({ type: 'gw_guess', id: picked.id })}
                className="flex-1 rounded-2xl px-4 py-3 font-semibold text-white"
                style={{ background: colorOf(me) }}
              >
                Sí, es {picked.name}
              </button>
              <button onClick={() => setPicked(null)} className="rounded-2xl border border-line px-4 font-semibold hover:border-ink">
                Otro
              </button>
            </div>
          </>
        ) : (
          <p className="font-semibold">Toca a quien crees que es en el tablero.</p>
        )}
        <button
          onClick={() => {
            setGuessing(false)
            setPicked(null)
          }}
          className="mt-3 text-sm font-semibold text-muted underline underline-offset-2 hover:text-ink"
        >
          Mejor sigo preguntando
        </button>
      </Panel>
    )
  }

  return (
    <Panel>
      <p className="font-display text-xl font-bold">Te toca preguntar</p>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (question) send({ type: 'gw_ask', question })
          setQuestion('')
        }}
      >
        <select
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full min-w-0 rounded-xl border border-line bg-stone px-3 py-2.5"
          aria-label="Elige una pregunta"
        >
          <option value="">Elige una pregunta…</option>
          {game.questions.map((q) => (
            <option key={q.key} value={q.key} disabled={asked.has(q.text)}>
              {q.text}
            </option>
          ))}
        </select>
        <button type="submit" disabled={!question} className="w-full rounded-xl bg-ink px-4 py-2.5 font-semibold text-white disabled:opacity-40">
          Preguntar
        </button>
      </form>
      <p className="mt-1 text-xs text-muted">Estas las responde Cerquita, sin errores.</p>

      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (free.trim().length >= 3) send({ type: 'gw_ask_free', text: free })
          setFree('')
        }}
      >
        <input
          value={free}
          onChange={(e) => setFree(e.target.value)}
          maxLength={120}
          placeholder="O escribe la tuya: ¿se parece a mí?"
          className="w-full min-w-0 rounded-xl border border-line bg-stone px-3 py-2.5 outline-none focus:border-ink"
        />
        <button type="submit" disabled={free.trim().length < 3} className="w-full rounded-xl bg-ink px-4 py-2.5 font-semibold text-white disabled:opacity-40">
          Enviar mi pregunta
        </button>
      </form>
      <p className="mt-1 text-xs text-muted">Esta la responde {other}.</p>

      <button
        onClick={() => setGuessing(true)}
        className="mt-5 w-full rounded-2xl px-4 py-3 font-semibold text-white"
        style={{ background: colorOf(me) }}
      >
        Ya sé quién es
      </button>
    </Panel>
  )
}

function Panel({ children, accent }) {
  return (
    <div className="rounded-[2rem] p-5" style={{ background: accent ?? 'var(--color-paper)' }}>
      {children}
    </div>
  )
}

function Log({ game, me, colorOf, other }) {
  if (!game.log.length && game.phase !== 'playing') return null
  return (
    <div className="rounded-[2rem] bg-paper p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">Preguntas</h2>
        {other && game.phase === 'playing' && (
          <span className="text-xs text-muted">
            A {other} le quedan {game.remaining[other]}
          </span>
        )}
      </div>
      {game.log.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Todavía nadie ha preguntado.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {[...game.log].reverse().map((l, i) => (
            <li key={game.log.length - i} className="text-sm">
              <span className="font-semibold" style={{ color: colorOf(l.asker) }}>
                {l.asker === me ? 'Tú' : l.asker}:
              </span>{' '}
              {l.text}{' '}
              <span
                className="ml-1 rounded-md px-1.5 py-0.5 text-xs font-bold text-white"
                style={{ background: l.answer ? 'hsl(148 42% 38%)' : '#8A8E99' }}
              >
                {l.answer ? 'Sí' : 'No'}
              </span>
              {!l.auto && (
                <span className="ml-1 text-xs text-muted">
                  (la respondió {l.asker === me ? other : 'tú'})
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function RoundOver({ game, me, byId, send, colorOf }) {
  const r = game.result
  const last = game.round >= game.totalRounds
  const guessed = byId[r.guess]
  const target = byId[game.secrets[game.players.find((p) => p !== r.guesser)]]
  let title
  if (r.correct) title = r.guesser === me ? `¡Acertaste! Era ${target.name}` : `${r.guesser} adivinó: era ${target.name}`
  else title = r.guesser === me ? `Fallaste: era ${target.name}` : `${r.guesser} dijo ${guessed.name}, pero era ${target.name}`
  return (
    <div className="pop rounded-[2rem] p-5 text-white" style={{ background: colorOf(r.winner) }}>
      <p className="font-display text-2xl font-extrabold">{title}</p>
      <p className="mt-1 text-white/85">
        Punto para {r.winner === me ? 'ti' : r.winner}, después de {r.questions} {r.questions === 1 ? 'pregunta' : 'preguntas'}.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {game.players.map((p) => {
          const c = byId[game.secrets[p]]
          return (
            <div key={p} className="overflow-hidden rounded-2xl bg-white/15">
              <Avatar c={c} className="w-full" />
              <p className="px-2 py-1.5 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="text-white/75"> · de {p === me ? 'ti' : p}</span>
              </p>
            </div>
          )
        })}
      </div>
      <button onClick={() => send({ type: 'next_round' })} className="mt-4 w-full rounded-2xl bg-white px-5 py-3 font-semibold text-ink">
        {last ? 'Ver resultados' : 'Otra ronda'}
      </button>
    </div>
  )
}

function Final({ game, me, send, colorOf }) {
  const byId = Object.fromEntries(game.cast.map((c) => [c.id, c]))
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{winnerTitle(game.scores)}</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(game.scores).map(([p, n]) => (
          <div key={p} className="rounded-2xl bg-paper px-5 py-3">
            <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
            <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
          </div>
        ))}
      </div>
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-paper px-4 py-3">
            <span className="w-5 text-sm text-muted tabular-nums">{h.round}</span>
            {Object.entries(h.secrets).map(([p, cid]) => (
              <span key={p} className="flex items-center gap-2 text-sm">
                <span className="h-9 w-9 overflow-hidden rounded-lg">{byId[cid] && <Avatar c={byId[cid]} className="h-full w-full" />}</span>
                <span>
                  <span style={{ color: colorOf(p) }}>{p}</span> tenía a {byId[cid]?.name ?? cid}
                </span>
              </span>
            ))}
            <span className="ml-auto text-sm text-muted">
              {h.correct ? `${h.guesser} acertó` : `${h.guesser} falló`} · {h.questions} preguntas
            </span>
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'guesswho', ...game.options }} />
    </div>
  )
}
