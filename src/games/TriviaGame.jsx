import { useEffect } from 'react'
import TimerBar from '../components/TimerBar'
import { useCountdown } from '../hooks/useCountdown'
import { EndActions } from '../components/EndActions'
import { CATEGORIES, CATEGORY_META, CategoryIcon, CrownBadge, WHEEL } from '../lib/trivia'

const OK = 'hsl(148 48% 34%)'
const BAD = 'var(--color-danger)'
const LETTERS = ['A', 'B', 'C', 'D']
const LEVEL_LABEL = { facil: 'fácil', medio: 'medio', dificil: 'difícil' }

export default function TriviaGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return (
    <div className="mt-4">
      <Scoreboard game={game} me={me} colorOf={colorOf} />
      {(game.phase === 'spin' || game.phase === 'spinning') && <Spin game={game} me={me} send={send} colorOf={colorOf} />}
      {game.phase === 'crown_pick' && <CrownPick game={game} me={me} send={send} />}
      {(game.phase === 'question' || game.phase === 'reveal') && <Question room={room} me={me} send={send} colorOf={colorOf} />}
    </div>
  )
}

/* --- marcador ----------------------------------------------------------- */

function Scoreboard({ game, me, colorOf }) {
  if (game.mode === 'duelo') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>
          Pregunta {Math.max(game.asked, 1)} de {game.totalQuestions}
        </span>
        <div className="flex gap-2">
          {game.players.map((p) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-ink tabular-nums">{game.scores[p]}</span>
            </span>
          ))}
        </div>
      </div>
    )
  }
  const goalCats = game.goal === 6 ? CATEGORIES : null
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {game.players.map((p) => {
        const active = game.current === p
        const crowns = game.crowns[p] ?? []
        return (
          <div
            key={p}
            className="rounded-3xl bg-paper p-4 transition-shadow"
            style={active ? { boxShadow: `inset 0 0 0 3px ${colorOf(p)}` } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold" style={{ color: colorOf(p) }}>
                {p}
                {p === me && ' (tú)'}
                {active && <span className="ml-2 text-xs font-semibold text-muted">· su turno</span>}
              </p>
              <Meter value={game.streak[p] ?? 0} max={game.streakForCrown} color={colorOf(p)} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {goalCats
                ? goalCats.map((c) => <CrownBadge key={c} category={c} won={crowns.includes(c)} />)
                : Array.from({ length: game.goal }, (_, i) =>
                    crowns[i] ? <CrownBadge key={i} category={crowns[i]} /> : <CrownBadge key={i} category="corona" won={false} title="Corona pendiente" />,
                  )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Meter({ value, max, color }) {
  return (
    <span className="flex items-center gap-1" title={`${value} de ${max} aciertos seguidos para jugar por una corona`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className="h-2.5 w-5 rounded-full" style={{ background: i < value ? color : 'var(--color-line)' }} />
      ))}
      <CategoryIcon category="corona" className="ml-0.5 h-4 w-4" color={value >= max ? color : 'var(--color-line)'} />
    </span>
  )
}

/* --- ruleta ------------------------------------------------------------- */

const STEP = 360 / WHEEL.length
const R = 94

function point(angle, r) {
  const a = (angle * Math.PI) / 180
  return [100 + r * Math.sin(a), 100 - r * Math.cos(a)]
}

/** Giro con el que la casilla elegida queda bajo la flecha. Crece con cada giro. */
function rotationFor(spinId, slot) {
  if (!spinId || !slot) return 0
  const i = WHEEL.indexOf(slot)
  const jitter = ((spinId * 37) % 30) - 15
  return spinId * 5 * 360 - i * STEP + jitter
}

export function Wheel({ spinId, slot, seconds = 3.2, className = '' }) {
  const rotation = rotationFor(spinId, slot)
  return (
    <div className={`relative mx-auto aspect-square w-full max-w-[22rem] ${className}`}>
      {/* flecha */}
      <svg viewBox="0 0 40 40" className="absolute left-1/2 top-0 z-10 h-10 w-10 -translate-x-1/2 -translate-y-1" aria-hidden="true">
        <path d="M8 4h24L20 30z" fill="var(--color-ink)" stroke="white" strokeWidth="3" strokeLinejoin="round" />
      </svg>
      {/* Al girar, las esquinas (transparentes) del cuadro de la ruleta se salen
          y tapaban el botón de girar: por eso no recibe clics. */}
      <svg
        viewBox="0 0 200 200"
        className="pointer-events-none h-full w-full drop-shadow-sm"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: `transform ${seconds * 0.95}s cubic-bezier(0.12, 0.6, 0.12, 1)`,
        }}
        role="img"
        aria-label="Ruleta de categorías"
      >
        <circle cx="100" cy="100" r="99" fill="white" />
        {WHEEL.map((cat, i) => {
          const [x1, y1] = point(i * STEP - STEP / 2, R)
          const [x2, y2] = point(i * STEP + STEP / 2, R)
          const [ix, iy] = point(i * STEP, 62)
          return (
            <g key={cat}>
              <path d={`M100 100 L${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2} Z`} fill={CATEGORY_META[cat].color} stroke="white" strokeWidth="2.5" />
              <CategoryIcon category={cat} className="" x={ix - 13} y={iy - 13} width="26" height="26" />
            </g>
          )
        })}
        <circle cx="100" cy="100" r="17" fill="white" />
        <circle cx="100" cy="100" r="9" fill="var(--color-ink)" />
      </svg>
    </div>
  )
}

function Spin({ game, me, send, colorOf }) {
  const spinning = game.phase === 'spinning'
  const canSpin = !spinning && (game.mode === 'duelo' || game.current === me)
  const who = game.current
  const landed = spinning ? null : game.slot

  useEffect(() => {
    if (!canSpin) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, button')) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        send({ type: 'tv_spin', at: game.spinId })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSpin, send, game.spinId])

  let title
  if (spinning) title = 'Girando…'
  else if (game.mode === 'duelo') title = game.asked ? 'Siguiente pregunta' : 'Giren la ruleta'
  else title = who === me ? 'Te toca girar' : `Le toca a ${who}`

  return (
    <section className="mt-4 rounded-[2rem] bg-paper p-6 text-center sm:p-8">
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl" style={game.mode === 'coronas' ? { color: colorOf(who) } : undefined}>
        {title}
      </h1>
      {!spinning && game.mode === 'coronas' && (
        <p className="mt-1 text-muted">
          {who === me
            ? 'Acierta para seguir jugando; tres seguidas y juegas por una corona.'
            : 'Mírale por la videollamada. Si falla, te toca a ti.'}
        </p>
      )}
      <Wheel spinId={game.spinId} slot={game.slot} seconds={game.spinSeconds} className="mt-6" />
      <div className="mt-6 h-14">
        {canSpin && (
          <button onClick={() => send({ type: 'tv_spin', at: game.spinId })} className="rounded-2xl bg-ink px-10 py-4 font-display text-xl font-extrabold text-white">
            ¡Girar!
          </button>
        )}
        {!canSpin && !spinning && landed == null && <p className="pt-4 text-muted">Esperando a que {who} gire…</p>}
      </div>
    </section>
  )
}

/* --- elegir corona ------------------------------------------------------ */

function CrownPick({ game, me, send }) {
  const mine = game.current === me
  const missing = CATEGORIES.filter((c) => !(game.crowns[game.current] ?? []).includes(c))
  const viaWheel = game.slot === 'corona'
  return (
    <section className="pop mt-4 rounded-[2rem] p-6 text-white sm:p-8" style={{ background: CATEGORY_META.corona.color }}>
      <div className="flex items-center gap-3">
        <CategoryIcon category="corona" className="h-12 w-12" />
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">
          {mine ? '¡Juegas por una corona!' : `${game.current} juega por una corona`}
        </h1>
      </div>
      <p className="mt-2 text-white/85">
        {viaWheel ? 'La ruleta cayó en la corona.' : 'Tres aciertos seguidos llenaron el medidor.'}{' '}
        {mine ? 'Elige la categoría. Si aciertas, es tuya.' : 'Está eligiendo la categoría…'}
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {missing.map((c) => (
          <button
            key={c}
            disabled={!mine}
            onClick={() => send({ type: 'tv_crown', category: c })}
            className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left font-semibold text-ink transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-70"
          >
            <CrownBadge category={c} />
            {CATEGORY_META[c].label}
          </button>
        ))}
      </div>
    </section>
  )
}

/* --- pregunta y respuesta ----------------------------------------------- */

function Question({ room, me, send, colorOf }) {
  const game = room.game
  const left = useCountdown(room)
  const q = game.question
  const meta = CATEGORY_META[q.category]
  const reveal = game.phase === 'reveal'
  const results = game.last?.results ?? {}
  const myTurn = game.mode === 'duelo' || game.current === me
  const answeredMine = game.mode === 'duelo' ? game.answered.includes(me) : false
  const canAnswer = !reveal && myTurn && !answeredMine
  const myChoice = reveal ? results[me]?.choice : game.myChoice

  useEffect(() => {
    if (!canAnswer) return
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return
      const i = ['1', '2', '3', '4'].indexOf(e.key)
      const j = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase())
      const pick = i >= 0 ? i : j
      if (pick >= 0 && pick < q.options.length) send({ type: 'tv_answer', choice: pick })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canAnswer, q.options.length, send])

  const urgent = !reveal && left != null && left <= 5

  return (
    <div className="mt-4">
      <section className="pop overflow-hidden rounded-[2rem] bg-paper" key={`${game.asked}`}>
        <div className="flex items-center justify-between gap-3 px-6 py-4 text-white sm:px-8" style={{ background: meta.color }}>
          <span className="flex items-center gap-2 font-semibold">
            <CategoryIcon category={q.category} className="h-6 w-6" />
            {meta.label}
            {q.level && LEVEL_LABEL[q.level] && (
              <span className="ml-1 rounded-full bg-white/25 px-2.5 py-0.5 text-sm">{LEVEL_LABEL[q.level]}</span>
            )}
            {game.forCrown && (
              <span className="ml-1 flex items-center gap-1 rounded-full bg-white/25 px-2.5 py-0.5 text-sm">
                <CategoryIcon category="corona" className="h-4 w-4" /> por la corona
              </span>
            )}
          </span>
          {!reveal && <span className={`font-display text-4xl font-extrabold tabular-nums ${urgent ? 'shake' : ''}`}>{left ?? game.seconds}</span>}
        </div>
        {!reveal && (
          <div className="-mt-2">
            <TimerBar seconds={game.seconds} resetKey={game.asked} msLeft={room.phaseEndsInMs} color={meta.color} track="bg-line rounded-none" />
          </div>
        )}

        <div className="p-6 sm:p-8">
          <p className="font-display text-2xl font-bold leading-snug sm:text-3xl">{q.question}</p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {q.options.map((opt, i) => {
              const isAnswer = reveal && q.answer === i
              const pickedWrong = reveal && myChoice === i && q.answer !== i
              const pickedNow = !reveal && myChoice === i
              const pickers = reveal ? game.players.filter((p) => results[p]?.choice === i) : []
              let style = {}
              let cls = 'border-line bg-white'
              if (isAnswer) {
                style = { background: OK, borderColor: OK, color: 'white' }
                cls = ''
              } else if (pickedWrong) {
                style = { background: BAD, borderColor: BAD, color: 'white' }
                cls = ''
              } else if (pickedNow) {
                style = { borderColor: 'var(--color-ink)' }
                cls = 'bg-white'
              } else if (reveal) {
                cls = 'border-line bg-white opacity-60'
              }
              return (
                <button
                  key={i}
                  disabled={!canAnswer}
                  onClick={() => send({ type: 'tv_answer', choice: i })}
                  className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-semibold transition-transform enabled:hover:-translate-y-0.5 enabled:hover:border-ink ${cls} ${isAnswer ? 'pop' : ''} ${pickedWrong ? 'shake' : ''}`}
                  style={style}
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={isAnswer || pickedWrong ? { background: 'rgba(255,255,255,.25)' } : { background: 'var(--color-stone)' }}
                  >
                    {LETTERS[i]}
                  </span>
                  <span className="flex-1">{opt}</span>
                  {pickers.map((p) => (
                    <span
                      key={p}
                      className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                      style={{ background: colorOf(p), boxShadow: '0 0 0 2px white' }}
                    >
                      {p}
                    </span>
                  ))}
                </button>
              )
            })}
          </div>

          {!reveal && <Waiting game={game} me={me} colorOf={colorOf} />}
          {reveal && <Outcome game={game} me={me} send={send} colorOf={colorOf} />}
        </div>
      </section>
    </div>
  )
}

function Waiting({ game, me, colorOf }) {
  if (game.mode === 'coronas') {
    if (game.current === me) return <p className="mt-4 hidden text-xs text-muted sm:block">Atajos: teclas 1 a 4 o A a D.</p>
    return (
      <p className="mt-5 text-muted">
        Responde <span className="font-semibold" style={{ color: colorOf(game.current) }}>{game.current}</span>. Tú mírale por la videollamada: si falla, te toca.
      </p>
    )
  }
  const other = game.players.find((p) => p !== me)
  const mine = game.answered.includes(me)
  const theirs = game.answered.includes(other)
  return (
    <p className="mt-5 text-muted">
      {mine ? `Respuesta enviada. ${theirs ? '' : `Esperando a ${other}…`}` : theirs ? (
        <>
          <span className="font-semibold" style={{ color: colorOf(other) }}>{other}</span> ya respondió. ¡Rápido!
        </>
      ) : (
        'Mientras más rápido aciertes, más puntos (de 50 a 100).'
      )}
    </p>
  )
}

function Outcome({ game, me, send, colorOf }) {
  const results = game.last.results
  let title
  let color = 'var(--color-ink)'
  if (game.mode === 'duelo') {
    const mine = results[me]
    title = mine?.ok ? `¡Correcto! +${mine.points}` : mine?.choice == null ? 'Se te acabó el tiempo' : 'Esta no era'
    color = mine?.ok ? OK : BAD
  } else {
    const p = game.last.by
    const r = results[p]
    const you = p === me
    if (game.last.crownWon) {
      title = `${you ? '¡Ganaste' : `¡${p} ganó`} la corona de ${CATEGORY_META[game.last.crownWon].label}!`
      color = CATEGORY_META[game.last.crownWon].color
    } else if (r.ok) {
      title = you ? '¡Correcto! Sigues tú' : `¡${p} acertó y sigue!`
      color = OK
    } else {
      title = r.choice == null ? `Se acabó el tiempo` : you ? 'Fallaste' : `${p} falló`
      color = BAD
    }
  }
  const lastDuel = game.mode === 'duelo' && game.asked >= game.totalQuestions
  const wonGame = game.mode === 'coronas' && (game.crowns[game.last.by] ?? []).length >= game.goal
  const passes = game.mode === 'coronas' && !results[game.last.by].ok && !wonGame

  return (
    <div className="pop mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5">
      <div>
        <p className="font-display text-2xl font-extrabold" style={{ color }}>{title}</p>
        {game.mode === 'duelo' && (
          <p className="mt-1 text-sm text-muted">
            {game.players
              .filter((p) => p !== me)
              .map((p) => {
                const r = results[p]
                return (
                  <span key={p}>
                    <span className="font-semibold" style={{ color: colorOf(p) }}>{p}</span>{' '}
                    {r.ok ? `acertó (+${r.points})` : r.choice == null ? 'no alcanzó a responder' : 'falló'}
                  </span>
                )
              })}
          </p>
        )}
        {passes && <p className="mt-1 text-sm text-muted">Ahora le toca a {game.players.find((p) => p !== game.last.by)}.</p>}
      </div>
      <button
        onClick={() => send({ type: 'next_round', at: game.asked })}
        autoFocus
        className="rounded-2xl bg-ink px-6 py-3 font-semibold text-white"
      >
        {lastDuel || wonGame ? 'Ver resultados' : 'Seguir'}
      </button>
    </div>
  )
}

/* --- final -------------------------------------------------------------- */

function Final({ game, me, send, colorOf }) {
  const title = game.winner ? `¡Ganó ${game.winner}!` : 'Empate perfecto'
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold" style={game.winner ? { color: colorOf(game.winner) } : undefined}>{title}</h1>
      <p className="mt-1 text-muted">
        {game.mode === 'coronas'
          ? `${game.winner ?? 'Alguien'} juntó ${game.goal} coronas en ${game.asked} preguntas.`
          : `${game.totalQuestions} preguntas, a ver quién sabía más.`}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {game.players.map((p) => (
          <div key={p} className="rounded-3xl bg-paper p-5">
            <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
            {game.mode === 'coronas' ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(game.crowns[p] ?? []).map((c) => <CrownBadge key={c} category={c} />)}
                {!(game.crowns[p] ?? []).length && <span className="text-muted">Sin coronas esta vez</span>}
              </div>
            ) : (
              <p className="font-display text-4xl font-extrabold tabular-nums">{game.scores[p]}</p>
            )}
            <p className="mt-1 text-sm text-muted">{game.correct[p]} {game.correct[p] === 1 ? 'acierto' : 'aciertos'}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-8 text-xl font-bold">Las preguntas</h2>
      <ol className="mt-3 space-y-2">
        {game.history.map((h) => {
          const meta = CATEGORY_META[h.question.category]
          const players = game.mode === 'coronas' ? [h.by] : game.players
          return (
            <li key={h.n} className="flex gap-3 rounded-2xl bg-paper px-4 py-3">
              <CrownBadge category={h.question.category} size="h-8 w-8" title={meta.label} />
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {h.question.question}
                  {h.forCrown && <span className="ml-1 text-xs font-semibold text-muted">· por la corona</span>}
                </p>
                <p className="mt-0.5 text-sm font-semibold" style={{ color: OK }}>{h.question.options[h.question.answer]}</p>
                <p className="mt-0.5 text-xs">
                  {players.map((p, i) => (
                    <span key={p}>
                      <span style={{ color: colorOf(p) }} className="font-semibold">{p}</span>{' '}
                      <span className="text-muted">{h.results[p]?.ok ? '✓' : h.results[p]?.choice == null ? 'sin responder' : `✗ ${h.question.options[h.results[p].choice]}`}</span>
                      {i < players.length - 1 && <span className="text-muted"> · </span>}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'trivia', ...game.options }} />
    </div>
  )
}
