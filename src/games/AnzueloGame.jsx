/**
 * Anzuelo: catch the liars. The pond fills the stage; on top float the
 * scores and the round, and at the bottom the question with what each player
 * has to do now: the liars write, the fisher reads the numbered answer cards
 * and catches (on the cards or on the fish), everyone sees the reveal.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Stage3D from '../components/stage/Stage3D'
import { Flash, Panel, Plates, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'
import TimerBar from '../components/TimerBar'
import { EndActions } from '../components/EndActions'
import { useSoundOn } from '../hooks/useSoundOn'
import { cssColor } from '../lib/three/kit'
import { play } from '../lib/sound'
import { spring } from '../lib/motion'

const load = () => import('../lib/three/anzuelo3d.js')

export default function AnzueloGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (import.meta.env.DEV) window.__anzueloGame = game // lets the browser tests read the game
  const finished = game.phase === 'finished'
  const fisher = game.guesser
  const iFish = fisher === me
  const role = game.myRole
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  useSoundOn(finished, 'fanfare')
  useCatchSounds(game)

  const catchFish = useCallback((player) => send({ type: 'az_catch', player }), [send])
  const onPick = useCallback((d) => d.kind === 'fish' && catchFish(d.id), [catchFish])

  const colors = useMemo(() => Object.fromEntries(game.players.map((p) => [p, cssColor(colorOf(p))])), [game.players, colorOf])
  const state = useMemo(() => ({ game, me, colors, canCatch: iFish && game.phase === 'fish' }), [game, me, colors, iFish])

  const top = Math.max(1, ...Object.values(game.scores))
  const plates = game.players.map((p) => ({
    name: p,
    you: p === me,
    color: colorOf(p),
    value: game.scores[p],
    max: top,
    stats: p === fisher ? '🎣 Pesca' : game.phase === 'write' ? (game.written[p] ? 'Listo' : 'Escribiendo…') : 'Pez',
    badges: [game.bots.includes(p) && 'bot', p === fisher && !finished && '🎣'].filter(Boolean),
    active: p === fisher && !finished,
  }))

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#D8F1F6, #A9DCE6)"
      stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Estanque con los peces en 3D" />}
      top={
        <>
          <Plates players={plates} />
          {!finished && (
            <span className="shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right text-xs font-bold shadow-sm backdrop-blur sm:text-sm">
              Ronda {game.round}/{game.rounds}
            </span>
          )}
        </>
      }
      bottom={
        <>
          <Flash flash={flash} />
          <div className="pointer-events-auto flex max-h-[min(46svh,30rem)] w-full max-w-xl flex-col overflow-y-auto rounded-[1.6rem] bg-paper/95 p-3 shadow-xl backdrop-blur sm:p-4">
            {finished ? (
              <Final game={game} colorOf={colorOf} />
            ) : (
              <>
                <Question game={game} />
                {game.phase === 'write' && <Writing game={game} me={me} role={role} fisher={fisher} send={send} room={room} />}
                {(game.phase === 'fish' || game.phase === 'reveal') && (
                  <Cards game={game} me={me} iFish={iFish} colorOf={colorOf} onCatch={catchFish} />
                )}
                {game.phase === 'fish' && <Fishing game={game} iFish={iFish} fisher={fisher} send={send} room={room} />}
                {game.phase === 'reveal' && <Reveal game={game} send={send} room={room} colorOf={colorOf} />}
              </>
            )}
          </div>
        </>
      }
      aside={
        <>
          {finished && (
            <Panel title="Fin de la partida">
              <EndActions send={send} replay={{ type: 'start_game', game: 'anzuelo', ...game.options }} />
            </Panel>
          )}
          <Panel title="Puntos">
            <ol className="space-y-1">
              {[...game.players].sort((a, b) => game.scores[b] - game.scores[a]).map((p) => (
                <li key={p} className="flex items-center gap-2 rounded-xl px-2 py-1 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(p) }} />
                  <span className="font-semibold">{p}{p === me && ' (tú)'}</span>
                  <span className="ml-auto font-display text-lg font-extrabold tabular-nums">{game.scores[p]}</span>
                </li>
              ))}
            </ol>
          </Panel>
          <Panel title="Cómo se juega">
            <ul className="space-y-1.5 text-sm text-muted">
              <li>🎣 Cada ronda pesca alguien distinto. Solo ve la pregunta.</li>
              <li>⭐ Un pez es honesto: su tarjeta trae la respuesta real.</li>
              <li>🤥 Los demás ven la respuesta y escriben una mentira creíble. ¡Defiéndanla en la videollamada!</li>
              <li>✗ Cada mentiroso pescado: +1 para el pescador. Si los saca a todos, +1 extra.</li>
              <li>⭐ Si pesca al honesto, pierde lo de esa ronda y el honesto gana +2.</li>
              <li>🛑 El pescador se puede plantar cuando quiera. Mentiroso que no pescan: +1.</li>
            </ul>
          </Panel>
        </>
      }
    />
  )
}

/* -- sounds: a splash for every catch, good or bad news after it ------------------------ */

function useCatchSounds(game) {
  const seen = useRef(game.event?.id ?? null)
  useEffect(() => {
    const ev = game.event
    if (!ev || ev.id === seen.current) return
    seen.current = ev.id
    play('reel')
    const timers = [setTimeout(() => play('splash'), 450), setTimeout(() => play(ev.result === 'liar' ? 'good' : 'bad'), 1100)]
    return () => timers.forEach(clearTimeout)
  }, [game.event])
  const written = Object.values(game.written ?? {}).filter(Boolean).length
  const prev = useRef(written)
  useEffect(() => {
    if (written > prev.current) play('bubble')
    prev.current = written
  }, [written])
}

/* -- pieces ------------------------------------------------------------------------------- */

function Question({ game }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{game.category}</p>
      <p className="font-display text-lg font-extrabold leading-snug sm:text-xl">{game.question}</p>
      {game.answer && game.phase !== 'reveal' && (
        <p className="mt-1.5 rounded-xl bg-[hsl(145_45%_92%)] px-3 py-1.5 text-sm">
          <span className="font-bold text-[hsl(145_45%_28%)]">Respuesta real: </span>
          {game.answer}
          <span className="block text-xs text-muted">El pescador no la ve.</span>
        </p>
      )}
    </div>
  )
}

function Writing({ game, me, role, fisher, send, room }) {
  const [text, setText] = useState('')
  const sent = game.myAnswer
  const pending = Object.entries(game.written).filter(([, v]) => !v).map(([p]) => p)
  const timer = <TimerBar seconds={game.seconds} resetKey={`w${game.round}`} msLeft={room.phaseEndsInMs} sound={role === 'liar' && !sent} />
  if (role === 'guesser') {
    return (
      <div className="mt-2">
        <p className="font-semibold">🎣 Esta ronda pescas tú.</p>
        <p className="text-sm text-muted">Los peces están preparando sus respuestas… Faltan {pending.length}.</p>
        {timer}
      </div>
    )
  }
  if (role === 'honest') {
    return (
      <div className="mt-2">
        <p className="font-semibold">⭐ Eres el pez honesto.</p>
        <p className="text-sm text-muted">Tu tarjeta dice la verdad. Cuando {fisher} pregunte, defiéndela… pero que suene a mentira 😉</p>
        {timer}
      </div>
    )
  }
  return (
    <form
      className="mt-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (text.trim()) send({ type: 'az_answer', text })
      }}
    >
      <p className="font-semibold">🤥 Eres un pez mentiroso: inventa una respuesta que {fisher} se crea.</p>
      <div className="mt-1.5 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={70}
          placeholder={sent ? 'Cambia tu mentira…' : 'Tu mentira creíble…'}
          className="min-w-0 flex-1 rounded-xl border border-line bg-stone px-3 py-2"
          aria-label="Tu respuesta falsa"
        />
        <button className="rounded-xl bg-ink px-4 font-semibold text-white disabled:opacity-40" disabled={!text.trim()}>
          {sent ? 'Cambiar' : 'Listo'}
        </button>
      </div>
      {sent && <p className="mt-1 text-sm text-muted">Tu tarjeta dice: <b className="text-ink">{sent}</b> · esperando a {pending.filter((p) => p !== me).join(', ') || 'los demás'}…</p>}
      {timer}
    </form>
  )
}

function Cards({ game, me, iFish, colorOf, onCatch }) {
  const fishing = game.phase === 'fish' && iFish
  return (
    <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
      <AnimatePresence initial={false}>
        {game.cards.map((c, i) => {
          const honest = c.role === 'honest'
          const tone = c.role ? (honest ? 'border-[hsl(42_75%_55%)] bg-[hsl(45_90%_92%)]' : 'border-danger/60 bg-[hsl(0_70%_95%)]') : 'border-line bg-paper'
          const body = (
            <>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold text-white" style={{ background: colorOf(c.player) }}>
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-xs font-semibold" style={{ color: colorOf(c.player) }}>{c.player}{c.player === me && ' (tú)'}</span>
                <span className="block font-semibold leading-snug">{c.text}</span>
              </span>
              {c.role && <span className={`shrink-0 text-xs font-extrabold ${honest ? 'text-[hsl(40_80%_35%)]' : 'text-danger'}`}>{honest ? '★ Verdad' : '✗ Mentira'}</span>}
              {fishing && !c.caught && <span className="shrink-0 rounded-full bg-ink px-2.5 py-1 text-xs font-bold text-white">🎣 Pescar</span>}
            </>
          )
          return (
            <motion.li key={c.player} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, scale: c.caught ? [1, 1.06, 1] : 1 }} transition={{ ...spring, delay: i * 0.04 }}>
              {fishing && !c.caught ? (
                <button onClick={() => onCatch(c.player)} className={`flex w-full items-center gap-2 rounded-2xl border-2 px-2.5 py-2 hover:border-ink ${tone}`}>
                  {body}
                </button>
              ) : (
                <div className={`flex items-center gap-2 rounded-2xl border-2 px-2.5 py-2 ${tone}`}>{body}</div>
              )}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ol>
  )
}

function Fishing({ game, iFish, fisher, send, room }) {
  return (
    <div className="mt-3">
      {iFish ? (
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 text-sm text-muted">
            Pregunta en la videollamada y pesca a un mentiroso (en la lista o en el estanque). Llevas <b className="text-ink">{game.pending}</b>.
          </p>
          <button onClick={() => send({ type: 'az_bank' })} disabled={!game.pending} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
            🛑 Me planto (+{game.pending})
          </button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          🎣 <b className="text-ink">{fisher}</b> está pescando ({game.pending} {game.pending === 1 ? 'punto' : 'puntos'} por ahora). ¡Defiende tu respuesta!
        </p>
      )}
      <TimerBar seconds={game.seconds} resetKey={`f${game.round}`} msLeft={room.phaseEndsInMs} sound={iFish} />
    </div>
  )
}

function Reveal({ game, send, room, colorOf }) {
  const caughtAll = !game.busted && game.cards.filter((c) => c.role === 'liar').every((c) => c.caught)
  const title = game.busted ? `¡${game.guesser} pescó al honesto!` : caughtAll ? `¡${game.guesser} pescó a todos los mentirosos!` : `${game.guesser} se plantó`
  const won = Object.entries(game.roundPoints).filter(([, n]) => n > 0)
  return (
    <div className="mt-3">
      <p className="font-display text-lg font-extrabold">{title}</p>
      <p className="text-sm">
        <span className="font-bold text-[hsl(145_45%_28%)]">La respuesta real: </span>
        {game.answer}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {won.length ? (
          won.map(([p, n]) => (
            <span key={p} className="rounded-full px-2.5 py-1 text-xs font-bold text-white" style={{ background: colorOf(p) }}>
              {p} +{n}
            </span>
          ))
        ) : (
          <span className="text-sm text-muted">Nadie sumó esta ronda.</span>
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <TimerBar seconds={game.seconds} resetKey={`r${game.round}`} msLeft={room.phaseEndsInMs} sound={false} />
        </div>
        <button onClick={() => send({ type: 'az_next' })} className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-white">
          {game.round >= game.rounds ? 'Ver resultados' : 'Siguiente ronda'}
        </button>
      </div>
    </div>
  )
}

function Final({ game, colorOf }) {
  const ranking = [...game.players].sort((a, b) => game.scores[b] - game.scores[a])
  const tie = game.winners.length > 1
  return (
    <div>
      <p className="font-display text-2xl font-extrabold">{tie ? `Empate: ${new Intl.ListFormat('es', { type: 'conjunction' }).format(game.winners)}` : `¡Ganó ${game.winners[0]}!`}</p>
      <ol className="mt-2 space-y-1">
        {ranking.map((p, i) => (
          <li key={p} className="flex items-center gap-2">
            <span className="w-5 text-sm font-bold text-muted">{i + 1}.</span>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorOf(p) }} />
            <span className="font-semibold">{p}</span>
            <span className="ml-auto font-display text-lg font-extrabold tabular-nums">{game.scores[p]}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
