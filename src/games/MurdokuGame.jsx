/**
 * Murdoku on the 3D stage: a little diorama of the crime scene. Pick a
 * suspect in the row over the stage (or in the panel) and tap their cell;
 * tap an empty cell to cross it out.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import Avatar from '../components/Avatar'
import { EndActions, winnerTitle } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, Panel, Plates, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/murdoku3d.js')

export const ROOM_COLORS = ['#F6E3C6', '#DCEBDD', '#DDE6F4', '#F2DCE5', '#E8E1F2', '#F4EEC9']
const DANGER = 'var(--color-danger)'
const MASC = ['Comedor', 'Estudio', 'Dormitorio', 'Baño', 'Jardín', 'Garaje']
const withArticle = (room) => `${MASC.includes(room) ? 'el' : 'la'} ${room.toLowerCase()}`

export default function MurdokuGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} />
}

function clock(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function useElapsed(game) {
  const [now, setNow] = useState(() => Date.now())
  const base = useRef({ ms: game.elapsedMs, at: Date.now() })
  useEffect(() => {
    base.current = { ms: game.elapsedMs, at: Date.now() }
  }, [game.elapsedMs, game.round])
  useEffect(() => {
    if (game.phase !== 'playing') return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [game.phase])
  return game.phase === 'playing' ? base.current.ms + (now - base.current.at) : game.elapsedMs
}

function Play({ game, me, send, colorOf }) {
  const elapsed = useElapsed(game)
  const [selected, setSelected] = useState(null)
  const playing = game.phase === 'playing'
  const isPlayer = game.players.includes(me)
  const canEdit = playing && isPlayer
  const victim = game.people.find((p) => p.role === 'victim')
  const violated = new Set(game.violations)
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  useEffect(() => setSelected(null), [game.round])

  const onPick = useCallback(
    ({ kind, id }) => {
      if (kind !== 'cell' || !canEdit) return
      const [r, c] = id.split(',').map(Number)
      const who = Object.entries(game.placed).find(([, v]) => v.cell[0] === r && v.cell[1] === c)?.[0]
      if (selected != null) {
        if (who != null && Number(who) === selected) return setSelected(null)
        send({ type: 'md_place', person: selected, cell: [r, c] })
        setSelected(null)
      } else if (who != null) setSelected(Number(who))
      else send({ type: 'md_note', cell: [r, c] })
    },
    [canEdit, game.placed, selected, send],
  )

  // portraits as SVG text for the standees (drawn by React in a hidden box)
  const portraitBox = useRef(null)
  const [portraits, setPortraits] = useState({})
  const castKey = `${game.round}|${game.people.map((p) => p.name).join(',')}`
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

  const colors = useMemo(() => Object.fromEntries(game.players.map((p) => [p, cssColor(colorOf(p))])), [game.players, colorOf])
  const state = useMemo(
    () => (Object.keys(portraits).length ? { game, portraits, selected, canEdit, colors } : null),
    [game, portraits, selected, canEdit, colors],
  )

  const placedCount = Object.keys(game.placed).length
  const allPlaced = placedCount === game.people.length
  const person = selected != null ? game.people[selected] : null

  let title
  let hint = null
  if (game.phase === 'round_over') title = 'Caso resuelto'
  else if (!canEdit) title = 'Mirando el caso…'
  else if (person) {
    title = `¿Dónde estaba ${person.name}?`
    hint = 'Toca su casilla. Las filas y columnas oscuras ya están ocupadas.'
  } else if (allPlaced) {
    title = 'Algo no cuadra'
    hint = 'Las pistas en rojo no se cumplen.'
  } else {
    title = 'Ubica a cada sospechoso'
    hint = 'Elige a alguien abajo y toca su casilla. Una casilla vacía se marca con ✕.'
  }

  const plates = game.mode === 'race' && game.players.length > 1
    ? game.players.map((p) => ({
        name: p,
        you: p === me,
        color: colorOf(p),
        value: p === me ? placedCount : (game.progress[p] ?? 0),
        max: game.people.length,
        stats: `Casos: ${game.scores?.[p] ?? 0}`,
        active: playing,
      }))
    : [{ name: me, you: true, color: colorOf(me), value: placedCount, max: game.people.length, stats: `Caso ${game.round} de ${game.totalRounds}`, active: playing }]

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#F2ECE2, #DCCFBC)"
      stage={
        <>
          <Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Plano de la escena en 3D" />
          <div ref={portraitBox} hidden aria-hidden="true">
            {game.people.map((p) => <div key={p.index} data-id={p.index}><Avatar c={p} zoom /></div>)}
          </div>
        </>
      }
      top={
        <>
          <Plates players={plates} />
          <div className="shrink-0 rounded-2xl bg-paper/90 px-3 py-1.5 text-right shadow-sm backdrop-blur">
            <p className="font-display text-xl font-extrabold tabular-nums leading-tight">{clock(elapsed)}</p>
            <p className="text-xs font-semibold text-muted">Caso {game.round}/{game.totalRounds} · {game.levelLabel}</p>
          </div>
        </>
      }
      bottom={
        game.phase === 'round_over' ? (
          <div className="pointer-events-auto w-full max-w-lg">
            <Reveal game={game} me={me} victim={victim} send={send} colorOf={colorOf} />
          </div>
        ) : (
          <>
            <Banner key={title} title={title} hint={hint} color={allPlaced && !person ? 'var(--color-danger)' : colorOf(me)}>
              {person && (
                <ul className="mt-1 space-y-0.5 text-left text-xs sm:text-sm">
                  {person.clues.map((cl) => (
                    <li key={cl.index} style={violated.has(cl.index) ? { color: DANGER, fontWeight: 600 } : undefined}>• {cl.text}</li>
                  ))}
                </ul>
              )}
            </Banner>
            {canEdit && <Suspects game={game} selected={selected} setSelected={setSelected} violated={violated} />}
          </>
        )
      }
      aside={
        <>
          <Panel title="Sospechosos" right={canEdit && <button onClick={() => send({ type: 'md_clear' })} className="text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink">Borrar el plano</button>}>
            <div className="space-y-2">
              {game.people.map((p) => {
                const placed = game.placed[String(p.index)]
                const isSel = selected === p.index
                const bad = p.clues.some((cl) => violated.has(cl.index))
                return (
                  <div
                    key={p.index}
                    role="button"
                    tabIndex={0}
                    onClick={() => canEdit && setSelected(isSel ? null : p.index)}
                    onKeyDown={(e) => e.key === 'Enter' && canEdit && setSelected(isSel ? null : p.index)}
                    className={`flex gap-3 rounded-2xl bg-stone p-2.5 ${canEdit ? 'cursor-pointer hover:bg-line/60' : ''} ${isSel ? 'ring-2 ring-ink' : ''} ${bad ? 'ring-2 ring-danger/60' : ''}`}
                  >
                    <div className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl ${p.role === 'victim' ? 'grayscale' : ''}`}>
                      <Avatar c={p} zoom className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <span className="font-bold">{p.name}</span>
                        {p.role === 'victim' && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">víctima</span>}
                        {placed && <span className="text-xs text-muted">✓</span>}
                      </p>
                      <ul className="mt-0.5 space-y-0.5 text-sm">
                        {p.clues.map((cl) => (
                          <li key={cl.index} style={violated.has(cl.index) ? { color: DANGER, fontWeight: 600 } : undefined}>{cl.text}</li>
                        ))}
                      </ul>
                      {placed && canEdit && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            send({ type: 'md_place', person: p.index, cell: null })
                          }}
                          className="mt-1 text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink"
                        >
                          Quitar del plano
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
          <Panel title="Cómo se juega">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>En cada fila y en cada columna va exactamente una persona.</li>
              <li>Mesas, plantas y estantes no se pueden ocupar. Sillas y alfombras sí.</li>
              <li>"Junto a" es arriba, abajo o a un lado, dentro de la misma habitación.</li>
              <li>El asesino es el único que quedó en la misma habitación que la víctima.</li>
            </ul>
          </Panel>
        </>
      }
    />
  )
}

/** The suspects in a row over the stage: tap one, then tap their cell. */
function Suspects({ game, selected, setSelected, violated }) {
  return (
    <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto rounded-2xl bg-paper/90 p-1.5 shadow-md backdrop-blur">
      {game.people.map((p) => {
        const placed = game.placed[String(p.index)]
        const bad = p.clues.some((cl) => violated.has(cl.index))
        return (
          <motion.button
            key={p.index}
            onClick={() => setSelected(selected === p.index ? null : p.index)}
            aria-pressed={selected === p.index}
            aria-label={p.name}
            title={p.name}
            animate={{ y: selected === p.index ? -6 : 0, scale: selected === p.index ? 1.08 : 1 }}
            transition={spring}
            className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-xl sm:h-12 sm:w-12 ${p.role === 'victim' ? 'grayscale' : ''} ${
              selected === p.index ? 'ring-2 ring-ink ring-offset-2' : bad ? 'ring-2 ring-danger' : ''
            } ${placed && selected !== p.index ? 'opacity-45' : ''}`}
          >
            <Avatar c={p} zoom className="h-full w-full" />
          </motion.button>
        )
      })}
    </div>
  )
}

/** Hand-drawn furniture. */
export function FurnitureIcon({ kind }) {
  const common = { className: 'absolute inset-[14%] h-[72%] w-[72%]', viewBox: '0 0 40 40', 'aria-hidden': true }
  if (kind === 'plant')
    return (
      <svg {...common}>
        <path d="M20 22 C10 20 8 10 12 6 C16 10 18 14 20 22 Z M20 22 C30 20 32 10 28 6 C24 10 22 14 20 22 Z M20 22 C18 12 20 6 20 4 C21 8 22 14 20 22 Z" fill="#3E9460" />
        <path d="M12 22 H28 L26 34 H14 Z" fill="#C46F42" />
      </svg>
    )
  if (kind === 'table')
    return (
      <svg {...common}>
        <rect x="5" y="12" width="30" height="7" rx="2" fill="#8A5A3B" />
        <rect x="8" y="19" width="3.5" height="14" rx="1" fill="#6E4630" />
        <rect x="28.5" y="19" width="3.5" height="14" rx="1" fill="#6E4630" />
      </svg>
    )
  if (kind === 'shelf')
    return (
      <svg {...common}>
        <rect x="8" y="4" width="24" height="32" rx="2" fill="#8A5A3B" />
        <rect x="11" y="7" width="18" height="7" fill="#F2E6C9" />
        <rect x="11" y="17" width="18" height="7" fill="#F2E6C9" />
        <rect x="11" y="27" width="18" height="6" fill="#F2E6C9" />
        <rect x="12" y="8" width="3" height="6" fill="#B23A5A" />
        <rect x="16" y="9" width="3" height="5" fill="#3B7DC4" />
        <rect x="13" y="18" width="4" height="6" fill="#3E9460" />
        <rect x="20" y="28" width="3" height="5" fill="#D08A2E" />
      </svg>
    )
  if (kind === 'chair')
    return (
      <svg {...common} className="absolute inset-[22%] h-[56%] w-[56%] opacity-70">
        <rect x="11" y="4" width="18" height="16" rx="3" fill="#B07A52" />
        <rect x="9" y="20" width="22" height="5" rx="2" fill="#8A5A3B" />
        <rect x="10" y="25" width="3" height="11" fill="#6E4630" />
        <rect x="27" y="25" width="3" height="11" fill="#6E4630" />
      </svg>
    )
  if (kind === 'rug')
    return (
      <svg {...common} className="absolute inset-[8%] h-[84%] w-[84%] opacity-60">
        <rect x="3" y="8" width="34" height="24" rx="4" fill="#B23A5A" />
        <rect x="7" y="12" width="26" height="16" rx="2" fill="none" stroke="#F2E6C9" strokeWidth="2" />
        <circle cx="20" cy="20" r="4" fill="#F2E6C9" />
      </svg>
    )
  return null
}

function Reveal({ game, me, victim, send, colorOf }) {
  const murderer = game.people[game.result.murderer]
  const roomName = (() => {
    const cell = game.placed[String(game.result.murderer)]?.cell
    return cell ? game.roomNames[game.rooms[cell[0]][cell[1]]] : ''
  })()
  const last = game.round >= game.totalRounds
  const winner = game.result.winner
  return (
    <div className="pop flex gap-4 rounded-[2rem] p-5 text-white shadow-xl" style={{ background: winner ? colorOf(winner) : 'var(--color-ink)' }}>
      <motion.div
        className="relative h-24 w-24 shrink-0 rounded-2xl ring-4 ring-white/40"
        initial={{ scale: 0.5, rotate: -10 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...spring, delay: 0.15 }}
      >
        <span className="block h-full w-full overflow-hidden rounded-2xl"><Avatar c={murderer} zoom className="h-full w-full" /></span>
        {/* a rubber stamp lands on the culprit */}
        <motion.span
          className="absolute -bottom-2 left-1/2 rounded-md border-[3px] border-white bg-[hsl(4_70%_45%)] px-1.5 font-display text-xs font-extrabold tracking-widest text-white"
          initial={{ scale: 3, opacity: 0, x: '-50%', rotate: -18 }}
          animate={{ scale: 1, opacity: 1, x: '-50%', rotate: -8 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15, delay: 0.55 }}
        >
          CULPABLE
        </motion.span>
      </motion.div>
      <div>
        <p className="text-sm font-semibold text-white/80">¡Caso resuelto en {clock(game.result.seconds * 1000)}!</p>
        <p className="font-display text-3xl font-extrabold">Fue {murderer.name}</p>
        <p className="text-white/85">
          Era {murderer.gender === 'woman' ? 'la única' : 'el único'} en {withArticle(roomName)} con {victim.name}.
          {winner && ` ${winner === me ? 'Lo resolviste' : `${winner} lo resolvió`} primero.`}
        </p>
        <button onClick={() => send({ type: 'next_round' })} className="mt-3 rounded-xl bg-white px-4 py-2 font-semibold text-ink">
          {last ? 'Ver resultados' : 'Otro caso'}
        </button>
      </div>
    </div>
  )
}

function Final({ game, me, send, colorOf }) {
  const race = game.mode === 'race'
  const total = game.history.reduce((s, h) => s + h.seconds, 0)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{race ? winnerTitle(game.scores, 'casos') : `${game.history.length} ${game.history.length === 1 ? 'caso resuelto' : 'casos resueltos'} en ${clock(total * 1000)}`}</h1>
      {race && (
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(game.scores).map(([p, n]) => (
            <div key={p} className="rounded-2xl bg-paper px-5 py-3">
              <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
              <p className="font-display text-4xl font-extrabold"><AnimatedNumber value={n} from={0} duration={1} /></p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <motion.li
            key={h.round}
            className="flex flex-wrap items-center gap-x-4 rounded-2xl bg-paper px-4 py-3"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.1 * h.round }}
          >
            <span className="text-sm text-muted">Caso {h.round}</span>
            <span className="font-semibold">Fue {h.murderer}</span>
            <span className="text-sm text-muted">
              {clock(h.seconds * 1000)}
              {h.winner && <> · lo resolvió <span style={{ color: colorOf(h.winner) }}>{h.winner}</span></>}
            </span>
          </motion.li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'murdoku', ...game.options }} />
    </div>
  )
}
