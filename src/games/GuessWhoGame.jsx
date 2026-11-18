/**
 * Guess Who on the 3D stage: your board is a tray of hinged frames. Tap a
 * frame to flip it down or up again; questions and the log live in the side
 * panel, answering and guessing happen on the stage.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import Avatar from '../components/Avatar'
import { EndActions, winnerTitle } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, BigAction, Flash, Plates, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/guesswho3d.js')

export default function GuessWhoGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} error={error} errorId={errorId} />
}

GuessWhoGame.showsErrors = true

function Play({ game, me, send, colorOf, error, errorId }) {
  const byId = useMemo(() => Object.fromEntries(game.characters.map((c) => [c.id, c])), [game.characters])
  const isPlayer = game.players.includes(me)
  const other = game.players.find((p) => p !== me)
  const playing = game.phase === 'playing'
  const myTurn = playing && game.turn === me && !game.pending
  const [guessing, setGuessing] = useState(false)
  const [picked, setPicked] = useState(null)
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  // Flipping characters down feels instant; the server confirms afterwards
  const [flipped, setFlipped] = useState(() => new Set(game.flipped))

  useEffect(() => setFlipped(new Set(game.flipped)), [game.flipped.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!myTurn) {
      setGuessing(false)
      setPicked(null)
    }
  }, [myTurn])

  const onPick = useCallback(
    ({ kind, id }) => {
      if (kind !== 'char' || !playing || !isPlayer) return
      if (guessing) return setPicked(id)
      setFlipped((prev) => {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      })
      send({ type: 'gw_flip', id })
    },
    [playing, isPlayer, guessing, send],
  )

  // portraits as SVG text, for the 3D frames
  // (drawn once by React in a hidden box, then read back as markup)
  const portraitBox = useRef(null)
  const [portraits, setPortraits] = useState({})
  const castKey = game.characters.map((c) => c.id).join(',')
  useLayoutEffect(() => {
    const out = {}
    portraitBox.current?.querySelectorAll('[data-id]').forEach((el) => {
      const svg = el.querySelector('svg')
      if (!svg) return
      svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      svg.setAttribute('width', '256')
      svg.setAttribute('height', '256')
      out[el.dataset.id] = svg.outerHTML
    })
    setPortraits(out)
  }, [castKey])
  const color = useMemo(() => cssColor(colorOf(me)), [colorOf, me])
  const state = useMemo(
    () => (Object.keys(portraits).length ? { characters: game.characters, portraits, flipped, picked, guessing, interactive: playing && isPlayer, secret: game.mySecret, color } : null),
    [game.characters, portraits, flipped, picked, guessing, playing, isPlayer, game.mySecret, color],
  )

  const pend = game.pending
  let title
  let hint = null
  if (game.phase === 'round_over') title = 'Ronda terminada'
  else if (pend && pend.asker !== me) title = `${pend.asker} pregunta`
  else if (pend) title = `Esperando la respuesta de ${other}…`
  else if (guessing) {
    title = picked ? `¿Es ${byId[picked].name}?` : '¿Quién es?'
    hint = picked ? `Si fallas, la ronda es para ${other}.` : 'Toca a quien crees que es.'
  } else if (myTurn) {
    title = 'Te toca preguntar'
    hint = 'Pregunta en el panel y baja a quien ya descartaste.'
  } else title = `Pregunta ${game.turn}…`
  if (pend && !hint) hint = pend.text

  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: game.scores[p] ?? 0,
    max: game.totalRounds,
    stats: playing ? `${game.remaining[p]} en pie` : `Ronda ${game.round} de ${game.totalRounds}`,
    active: playing && game.turn === p,
  }))
  const secret = game.mySecret && byId[game.mySecret]
  const soft = 'pointer-events-auto rounded-full bg-paper/95 px-5 py-2.5 font-bold shadow-md backdrop-blur hover:bg-white'

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#F1EBF7, #DCCFEA)"
      stage={
        <>
          <Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Tu tablero de Adivina quién en 3D" />
          <div ref={portraitBox} hidden aria-hidden="true">
            {game.characters.map((c) => <div key={c.id} data-id={c.id}><Avatar c={c} zoom /></div>)}
          </div>
        </>
      }
      top={
        <>
          <Plates players={plates} />
          {secret && (
            <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-paper/90 py-1 pl-1 pr-3 shadow-sm backdrop-blur">
              <span className="h-10 w-10 overflow-hidden rounded-xl" style={{ boxShadow: `0 0 0 2px ${colorOf(me)}` }}><Avatar c={secret} className="h-full w-full" /></span>
              <span className="leading-tight">
                <span className="block text-[0.65rem] font-semibold text-muted">Tu personaje</span>
                <span className="block text-sm font-bold">{secret.name}</span>
              </span>
            </div>
          )}
        </>
      }
      bottom={
        game.phase === 'round_over' ? (
          <div className="pointer-events-auto max-h-[75%] w-full max-w-md overflow-y-auto">
            <RoundOver game={game} me={me} byId={byId} send={send} colorOf={colorOf} />
          </div>
        ) : (
          <>
            <Banner key={`${title}${hint}`} title={title} hint={hint} color={colorOf(pend ? pend.asker : game.turn)} />
            <Flash flash={flash} />
            {isPlayer && pend && pend.asker !== me && (
              <div className="pointer-events-auto flex gap-2">
                <BigAction onClick={() => send({ type: 'gw_answer', yes: true })} color="hsl(148 42% 38%)" pulse={false}>Sí</BigAction>
                <BigAction onClick={() => send({ type: 'gw_answer', yes: false })} color="#8A8E99" pulse={false}>No</BigAction>
              </div>
            )}
            {myTurn && guessing && (
              <div className="flex flex-wrap justify-center gap-2">
                {picked && <BigAction onClick={() => send({ type: 'gw_guess', id: picked })} color={colorOf(me)}>Sí, es {byId[picked].name}</BigAction>}
                <button className={soft} onClick={() => { setGuessing(false); setPicked(null) }}>Mejor sigo preguntando</button>
              </div>
            )}
            {myTurn && !guessing && <button className={soft} onClick={() => setGuessing(true)}>🎯 Ya sé quién es</button>}
          </>
        )
      }
      aside={
        <>
          {isPlayer && playing && (
            <TurnPanel key={`${pend ? `q${game.log.length}` : ''}-${game.turn}`} game={game} me={me} other={other} myTurn={myTurn && !guessing} send={send} colorOf={colorOf} />
          )}
          <Log game={game} me={me} colorOf={colorOf} other={other} />
        </>
      }
    />
  )
}

function TurnPanel({ game, me, other, myTurn, send, colorOf }) {
  const [question, setQuestion] = useState('')
  const [free, setFree] = useState('')
  const asked = new Set(game.log.filter((l) => l.asker === me && l.auto).map((l) => l.text))

  if (game.pending) {
    return (
      <Panel accent={game.pending.asker === me ? undefined : colorOf(game.pending.asker)}>
        <p className={game.pending.asker === me ? 'text-muted' : 'text-white/80'}>{game.pending.asker === me ? `Le preguntaste a ${other}:` : `${game.pending.asker} pregunta:`}</p>
        <p className={`mt-1 font-display text-xl font-bold ${game.pending.asker === me ? '' : 'text-white'}`}>{game.pending.text}</p>
        <p className={`mt-2 text-sm ${game.pending.asker === me ? 'animate-pulse text-muted' : 'text-white/80'}`}>
          {game.pending.asker === me ? 'Esperando su respuesta…' : 'Responde con Sí o No en el tablero, pensando en tu personaje.'}
        </p>
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

  return (
    <Panel>
      <p className="font-display text-xl font-bold">Pregunta</p>
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
    </Panel>
  )
}

function Panel({ children, accent }) {
  // each change of the panel (a question arrives, it's your turn…) slides in
  return (
    <motion.div
      className="rounded-[2rem] p-5"
      style={{ background: accent ?? 'var(--color-paper)' }}
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={softSpring}
    >
      {children}
    </motion.div>
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
            <motion.li
              key={game.log.length - i}
              className="text-sm"
              initial={i === 0 ? { opacity: 0, x: -14 } : false}
              animate={{ opacity: 1, x: 0 }}
              transition={spring}
            >
              <span className="font-semibold" style={{ color: colorOf(l.asker) }}>
                {l.asker === me ? 'Tú' : l.asker}:
              </span>{' '}
              {l.text}{' '}
              <motion.span
                className="ml-1 inline-block rounded-md px-1.5 py-0.5 text-xs font-bold text-white"
                style={{ background: l.answer ? 'hsl(148 42% 38%)' : '#8A8E99' }}
                initial={i === 0 ? { scale: 0 } : false}
                animate={{ scale: 1 }}
                transition={{ ...spring, delay: 0.15 }}
              >
                {l.answer ? 'Sí' : 'No'}
              </motion.span>
              {!l.auto && (
                <span className="ml-1 text-xs text-muted">
                  (la respondió {l.asker === me ? other : 'tú'})
                </span>
              )}
            </motion.li>
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
        {game.players.map((p, i) => {
          const c = byId[game.secrets[p]]
          return (
            <motion.div
              key={p}
              className="overflow-hidden rounded-2xl bg-white/15"
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ ...spring, delay: 0.25 + i * 0.2 }}
            >
              <Avatar c={c} className="w-full" />
              <p className="px-2 py-1.5 text-sm">
                <span className="font-semibold">{c.name}</span>
                <span className="text-white/75"> · de {p === me ? 'ti' : p}</span>
              </p>
            </motion.div>
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
            <p className="font-display text-4xl font-extrabold"><AnimatedNumber value={n} from={0} duration={1} /></p>
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
