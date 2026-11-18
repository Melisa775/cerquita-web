/**
 * Más cerca: the question cards are dealt on a 3D table; the level track,
 * the buttons and the joint decisions float around it.
 */
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { softSpring, spring } from '../lib/motion'
import { EndActions } from '../components/EndActions'
import { LEVELS, LEVEL_META, WILDCARD_META } from '../lib/deeper'
import Stage3D from '../components/stage/Stage3D'
import { Panel, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/cards3d.js')

// Short reminders for whoever is listening, so the game stays a safe space
const LISTEN_TIPS = {
  icebreaker: ['Escucha y pregunta algo más sobre lo que te cuente.', 'Si te da risa, ríanse juntos: es parte del juego.'],
  deep: [
    'Escucha sin interrumpir. Cuando termine, cuéntale qué te hizo sentir oírlo.',
    'No hace falta arreglar nada: a veces basta con decir "te entiendo".',
    'Antes de responder, repite con tus palabras lo que entendiste.',
  ],
  deeper: [
    'Lo que se diga aquí se cuida. Agradécele por confiar en ti.',
    'Si algo te duele oírlo, respira y pregunta antes de defenderte.',
    'Pueden tomarse su tiempo. El silencio también es parte de la conversación.',
  ],
}

export default function DeeperGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'letters') return <div className="mx-auto max-w-5xl"><Letters game={game} me={me} send={send} colorOf={colorOf} /></div>
  if (game.phase === 'finished') return <div className="mx-auto max-w-5xl"><Final game={game} me={me} send={send} colorOf={colorOf} /></div>
  return <Cards game={game} me={me} send={send} colorOf={colorOf} />
}

/* --- level track ------------------------------------------------------ */

function LevelTrack({ level }) {
  const current = LEVELS.indexOf(level)
  return (
    <ol className="flex gap-1.5" aria-label="Niveles">
      {LEVELS.map((l, i) => (
        <li
          key={l}
          aria-current={i === current ? 'step' : undefined}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold sm:px-3 sm:text-sm ${i === current ? 'text-white' : i < current ? 'bg-stone text-ink' : 'bg-stone text-muted'}`}
          style={i === current ? { background: LEVEL_META[l].bg } : undefined}
        >
          {i < current && '✓ '}
          {LEVEL_META[l].label}
        </li>
      ))}
    </ol>
  )
}

/* --- cards ------------------------------------------------------------ */

function Cards({ game, me, send, colorOf }) {
  const { card, answerer } = game
  const wildcard = card.kind === 'wildcard'
  const meta = wildcard ? WILDCARD_META : LEVEL_META[card.level]
  const partner = game.players.find((p) => p !== me)
  const listening = card.kind === 'question' && answerer !== me
  const tips = LISTEN_TIPS[game.level]
  const tip = tips[game.count % tips.length]
  const next = () => send({ type: 'dp_next', at: game.count })
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  // When both agree to go deeper, the new level is announced over the whole screen
  const lastLevel = useRef(game.level)
  const [announce, setAnnounce] = useState(null)
  useEffect(() => {
    if (lastLevel.current !== game.level) setAnnounce(game.level)
    lastLevel.current = game.level
  }, [game.level])
  useEffect(() => {
    if (!announce) return
    const t = setTimeout(() => setAnnounce(null), 1700)
    return () => clearTimeout(t)
  }, [announce])

  // On desktop: Enter or the right arrow draws the next card
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select, button')) return
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        send({ type: 'dp_next', at: game.count })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [send, game.count])

  let who
  if (card.kind === 'both') who = 'Responden los dos'
  else if (wildcard) who = answerer === me ? 'Comodín para ti' : `Comodín para ${answerer}`
  else who = answerer === me ? 'Te toca responder' : `Responde ${answerer}`

  const levelColor = LEVEL_META[game.level].bg
  const state = {
    key: game.count,
    text: card.text,
    label: wildcard ? `✦ ${meta.label}` : meta.label,
    sub: who,
    bg: cssColor(meta.bg),
    ink: cssColor(meta.ink),
    faceDown: false,
    back: { color: cssColor(levelColor), word: '♥' },
    result: 'hit',
    hits: Math.max(0, game.count - 1),
    passes: 0,
    table: '#3B2E3F',
  }

  return (
    <>
      <AnimatePresence>
        {announce && (
          <motion.div
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-2 p-6 text-center text-white"
            style={{ background: LEVEL_META[announce].bg }}
            initial={{ clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ clipPath: 'circle(100% at 50% 50%)' }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            transition={{ duration: 0.6, ease: [0.3, 0.7, 0.2, 1] }}
            onClick={() => setAnnounce(null)}
            role="status"
          >
            <motion.p className="text-lg font-semibold text-white/80" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              Los dos quisieron ir más hondo
            </motion.p>
            <motion.p className="font-display text-5xl font-extrabold sm:text-7xl" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...softSpring, delay: 0.4 }}>
              {LEVEL_META[announce].label}
            </motion.p>
            <motion.p className="max-w-md text-white/85" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
              {LEVEL_META[announce].blurb}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      <StageLayout
        stageRef={stageRef}
        sky="linear-gradient(#EFE6EC, #D5C3CF)"
        stage={<Stage3D ref={stageRef} load={load} state={state} label="Mesa de cartas de Más cerca en 3D" />}
        top={
          <>
            <div className="pointer-events-auto rounded-2xl bg-paper/90 p-1.5 shadow-sm backdrop-blur">
              <LevelTrack level={game.level} />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden rounded-2xl bg-paper/90 px-3 py-2 text-sm font-semibold tabular-nums shadow-sm backdrop-blur sm:inline">Carta {game.count}</span>
              <button
                onClick={() => send({ type: 'dp_save' })}
                aria-pressed={game.savedCurrent}
                className="pointer-events-auto rounded-2xl bg-paper/90 px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur hover:bg-white"
                title={game.savedCurrent ? 'Quitar de guardadas' : 'Guardar para volver a ella'}
              >
                <span className="hidden sm:inline">{game.savedCurrent ? '♥ Guardada' : '♡ Guardar'}</span>
                <span className="sm:hidden">{game.savedCurrent ? '♥' : '♡'}</span>
              </button>
            </div>
          </>
        }
        bottom={
          <>
            {listening && <p className="max-w-md rounded-2xl bg-paper/90 px-4 py-2 text-center text-sm text-muted shadow-sm backdrop-blur">{tip}</p>}
            <div className="pointer-events-auto flex flex-wrap justify-center gap-2">
              <button onClick={next} className="rounded-full bg-ink px-7 py-3.5 font-display text-lg font-extrabold text-white shadow-xl">
                Siguiente carta
              </button>
              <button
                onClick={() => send({ type: 'dp_skip', at: game.count })}
                className="rounded-full bg-paper px-5 py-3.5 font-semibold shadow-xl hover:bg-white"
                title="Otra carta para la misma persona"
              >
                Otra carta
              </button>
            </div>
          </>
        }
        aside={
          <>
            <Panel title="Juntos deciden">
              <div className="grid gap-2">
                {game.level !== 'deeper' && (
                  <VoteButton
                    label={`Pasar a ${LEVEL_META[LEVELS[LEVELS.indexOf(game.level) + 1]].label}`}
                    votes={game.votes.deeper}
                    me={me}
                    partner={partner}
                    onClick={() => send({ type: 'dp_deeper' })}
                    accent={LEVEL_META[LEVELS[LEVELS.indexOf(game.level) + 1]].bg}
                    waitText="cuando los dos estén listos"
                  />
                )}
                <VoteButton
                  label={game.options.letter ? 'Terminar y escribir la carta final' : 'Terminar'}
                  votes={game.votes.finish}
                  me={me}
                  partner={partner}
                  onClick={() => send({ type: 'dp_finish' })}
                  accent="var(--color-ink)"
                  waitText="cuando los dos quieran"
                />
              </div>
            </Panel>
            <Panel title="Para escuchar">
              <p className="px-1 text-sm text-muted">{tip}</p>
              <p className="mt-2 hidden px-1 text-xs text-muted sm:block">Atajo: Enter o → para la siguiente carta.</p>
            </Panel>
          </>
        }
      />
    </>
  )
}

/** A choice that only happens when both players agree. */
function VoteButton({ label, votes, me, partner, onClick, accent, waitText }) {
  const mine = votes.includes(me)
  const theirs = votes.includes(partner)
  let note = `Cambia ${waitText}.`
  if (mine) note = `Esperando a ${partner}… toca otra vez para cancelar.`
  else if (theirs) note = `${partner} ya está de acuerdo.`
  return (
    <button
      onClick={onClick}
      aria-pressed={mine}
      className={`rounded-2xl border-2 bg-paper px-4 py-2.5 text-left hover:border-ink ${theirs && !mine ? 'deeper-nudge' : ''}`}
      style={{ borderColor: mine || theirs ? accent : 'var(--color-line)', '--accent': accent }}
    >
      <span className="block font-semibold">{label}</span>
      <span className="block text-sm text-muted">{note}</span>
    </button>
  )
}

/* --- closing letters -------------------------------------------------- */

function Letters({ game, me, send, colorOf }) {
  const [text, setText] = useState('')
  const partner = game.players.find((p) => p !== me)
  const sent = game.lettersSent.includes(me)
  const partnerSent = game.lettersSent.includes(partner)

  return (
    <section className="mt-6 rounded-[2rem] p-7 text-white sm:p-10" style={{ background: LEVEL_META.deeper.bg }}>
      <h1 className="font-display text-3xl font-extrabold sm:text-4xl">Carta final</h1>
      {sent ? (
        <>
          <p className="mt-3 max-w-xl text-white/85">Tu carta está sellada. Se abren las dos al mismo tiempo.</p>
          <motion.div className="relative mt-5" initial={{ scale: 0.96, rotate: -1 }} animate={{ scale: 1, rotate: 0 }} transition={spring}>
            <blockquote className="whitespace-pre-wrap rounded-2xl bg-white/10 p-5 text-white/90">{game.letters[me]}</blockquote>
            {/* a wax seal stamped on the letter */}
            <motion.span
              className="absolute -right-2 -top-3 flex h-12 w-12 items-center justify-center rounded-full text-xl shadow-lg"
              style={{ background: 'hsl(350 60% 42%)', boxShadow: 'inset 0 0 0 3px hsl(350 60% 34%)' }}
              initial={{ scale: 3, opacity: 0, rotate: -40 }}
              animate={{ scale: 1, opacity: 1, rotate: -12 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16, delay: 0.15 }}
              aria-hidden="true"
            >
              ♥
            </motion.span>
          </motion.div>
          <p className="mt-5 font-semibold">{partnerSent ? 'Abriendo…' : `${partner} todavía está escribiendo.`}</p>
        </>
      ) : (
        <>
          <p className="mt-3 max-w-xl text-white/85">
            Escríbele a {partner} lo que te dejó esta conversación: algo que aprendiste, algo que agradeces o algo que
            todavía no le habías dicho. No se ve hasta que los dos la envíen.
          </p>
          {partnerSent && <p className="mt-3 font-semibold">{partner} ya selló su carta.</p>}
          <form
            className="mt-5"
            onSubmit={(e) => {
              e.preventDefault()
              if (text.trim()) send({ type: 'dp_letter', text })
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={6}
              placeholder={`Querido/a ${partner}…`}
              className="w-full rounded-2xl bg-white p-4 text-ink outline-none"
              style={{ borderLeft: `6px solid ${colorOf(me)}` }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-white/70 tabular-nums">{text.length}/1000</span>
              <button disabled={!text.trim()} className="rounded-2xl bg-white px-6 py-3 font-semibold text-ink disabled:opacity-50">
                Sellar y enviar
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  )
}

/* --- end -------------------------------------------------------------- */

function Final({ game, me, send, colorOf }) {
  const partner = game.players.find((p) => p !== me)
  const order = [partner, me].filter((p) => game.letters[p])
  const total = Object.values(game.played).reduce((a, b) => a + b, 0)

  return (
    <div className="mt-6">
      <h1 className="font-display text-4xl font-extrabold">Un poco más cerca</h1>
      <p className="mt-2 text-muted">
        Respondieron {total} {total === 1 ? 'carta' : 'cartas'}
        {LEVELS.filter((l) => game.played[l]).map((l) => ` · ${LEVEL_META[l].label}: ${game.played[l]}`).join('')}
      </p>

      {order.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {order.map((p, i) => (
            // both letters unfold at the same time, like opening an envelope
            <motion.article
              key={p}
              className="rounded-3xl bg-paper p-6"
              style={{ borderTop: `6px solid ${colorOf(p)}`, transformOrigin: 'top center', transformPerspective: 900 }}
              initial={{ rotateX: -80, opacity: 0, y: 20 }}
              animate={{ rotateX: 0, opacity: 1, y: 0 }}
              transition={{ ...softSpring, delay: 0.2 + i * 0.25 }}
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                {p === me ? `Tu carta para ${partner}` : `Carta de ${p} para ti`}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed">{game.letters[p]}</p>
            </motion.article>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-bold">Cartas guardadas</h2>
        {game.saved.length ? (
          <ul className="mt-3 space-y-2">
            {game.saved.map((c) => {
              const meta = c.kind === 'wildcard' ? WILDCARD_META : LEVEL_META[c.level]
              return (
                <li key={c.id} className="flex items-start gap-3 rounded-2xl bg-paper p-4">
                  <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: meta.bg }} title={meta.label} />
                  <span>{c.text}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-muted">No guardaron ninguna. La próxima vez, toquen ♡ en las que quieran volver a hablar.</p>
        )}
      </section>

      <EndActions send={send} replay={{ type: 'start_game', game: 'deeper', ...game.options }} />
    </div>
  )
}
