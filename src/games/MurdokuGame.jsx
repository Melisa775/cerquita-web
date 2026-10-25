import { useEffect, useRef, useState } from 'react'
import Avatar from '../components/Avatar'
import { EndActions, winnerTitle } from '../components/EndActions'

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
  const placedAt = {}
  for (const [pid, v] of Object.entries(game.placed)) placedAt[`${v.cell[0]}-${v.cell[1]}`] = Number(pid)
  const objects = Object.fromEntries(game.objects.map((o) => [`${o.cell[0]}-${o.cell[1]}`, o.kind]))
  const notes = new Set(game.notes.map(([r, c]) => `${r}-${c}`))
  const violated = new Set(game.violations)

  useEffect(() => setSelected(null), [game.round])

  function onCell(r, c) {
    if (!canEdit) return
    const key = `${r}-${c}`
    const kind = objects[key]
    if (['mesa', 'planta', 'estante'].includes(kind)) return
    const who = placedAt[key]
    if (selected != null) {
      if (who === selected) {
        setSelected(null)
        return
      }
      send({ type: 'md_place', person: selected, cell: [r, c] })
      setSelected(null)
    } else if (who != null) {
      setSelected(who)
    } else {
      send({ type: 'md_note', cell: [r, c] })
    }
  }

  const other = game.players.find((p) => p !== me)
  const allPlaced = Object.keys(game.placed).length === game.people.length

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
        <span>
          Caso {game.round} de {game.totalRounds} · {game.levelLabel}
          {game.mode === 'race' && other && <> · {other} ubicó {game.progress[other] ?? 0} de {game.people.length}</>}
        </span>
        <span className="font-display text-xl font-bold text-ink tabular-nums">{clock(elapsed)}</span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="mx-auto w-full max-w-[36rem]">
          <Board game={game} placedAt={placedAt} objects={objects} notes={notes} selected={selected} onCell={onCell} colorOf={colorOf} />
          {canEdit && (
            <QuickPick game={game} selected={selected} setSelected={setSelected} violated={violated} />
          )}
          {canEdit && (
            <p className="mt-3 text-sm text-muted">
              {selected != null
                ? `Toca la casilla donde estaba ${game.people[selected].name}.`
                : 'Elige a alguien de la lista y toca su casilla. Toca una casilla vacía para marcarla con una X.'}
            </p>
          )}
          {canEdit && allPlaced && (
            <p className="mt-2 rounded-2xl bg-paper px-4 py-3 font-semibold text-danger">
              Algo no cuadra: las pistas en rojo no se cumplen.
            </p>
          )}
          {game.phase === 'round_over' && <Reveal game={game} me={me} victim={victim} send={send} colorOf={colorOf} />}
        </div>

        <aside className="space-y-2">
          <details className="rounded-2xl bg-paper px-4 py-3 text-sm" open={game.round === 1}>
            <summary className="cursor-pointer font-semibold">Cómo se juega</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted">
              <li>Ubica a todos: en cada fila y en cada columna va exactamente una persona.</li>
              <li>Mesas, plantas y estantes no se pueden ocupar. Sillas y alfombras sí.</li>
              <li>"Junto a" es arriba, abajo o a un lado, dentro de la misma habitación.</li>
              <li>El asesino es el único que quedó en la misma habitación que la víctima.</li>
            </ul>
          </details>
          {game.people.map((p) => {
            const placed = game.placed[String(p.index)]
            const isSel = selected === p.index
            return (
              <div
                key={p.index}
                role="button"
                tabIndex={0}
                onClick={() => canEdit && setSelected(isSel ? null : p.index)}
                onKeyDown={(e) => e.key === 'Enter' && canEdit && setSelected(isSel ? null : p.index)}
                className={`flex gap-3 rounded-2xl bg-paper p-3 ${canEdit ? 'cursor-pointer' : ''} ${isSel ? 'ring-2 ring-ink' : ''}`}
              >
                <div className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ${p.role === 'victim' ? 'grayscale' : ''}`}>
                  <Avatar c={p} zoom className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2">
                    <span className="font-bold">{p.name}</span>
                    {p.role === 'victim' && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-white">víctima</span>}
                    {placed && <span className="text-xs text-muted">✓ ubicad{p.genero === 'mujer' ? 'a' : 'o'}</span>}
                  </p>
                  <ul className="mt-0.5 space-y-0.5 text-sm">
                    {p.clues.map((cl) => (
                      <li key={cl.index} style={violated.has(cl.index) ? { color: DANGER, fontWeight: 600 } : undefined}>
                        {cl.text}
                      </li>
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
          {canEdit && (
            <button onClick={() => send({ type: 'md_clear' })} className="text-sm font-semibold text-muted underline underline-offset-2 hover:text-ink">
              Borrar todo el plano
            </button>
          )}
        </aside>
      </div>
    </div>
  )
}

/** En el celular: los sospechosos en una fila debajo del plano, para no tener que bajar. */
function QuickPick({ game, selected, setSelected, violated }) {
  const person = selected != null ? game.people[selected] : null
  return (
    <div className="mt-3 lg:hidden">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {game.people.map((p) => {
          const placed = game.placed[String(p.index)]
          return (
            <button
              key={p.index}
              onClick={() => setSelected(selected === p.index ? null : p.index)}
              aria-pressed={selected === p.index}
              aria-label={p.name}
              className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl ${p.role === 'victim' ? 'grayscale' : ''} ${
                selected === p.index ? 'ring-2 ring-ink ring-offset-2 ring-offset-stone' : ''
              } ${placed ? 'opacity-50' : ''}`}
            >
              <Avatar c={p} zoom className="h-full w-full" />
            </button>
          )
        })}
      </div>
      {person && (
        <div className="mt-2 rounded-2xl bg-paper px-4 py-3 text-sm">
          <p className="font-bold">{person.name}{person.role === 'victim' && ' (víctima)'}</p>
          {person.clues.map((cl) => (
            <p key={cl.index} style={violated.has(cl.index) ? { color: DANGER, fontWeight: 600 } : undefined}>
              {cl.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function Board({ game, placedAt, objects, notes, selected, onCell, colorOf }) {
  const n = game.size
  const rooms = game.rooms
  const labelCell = {}
  rooms.forEach((row, r) =>
    row.forEach((k, c) => {
      if (!(k in labelCell)) labelCell[k] = `${r}-${c}`
    }),
  )
  const usedRows = new Set()
  const usedCols = new Set()
  Object.entries(placedAt).forEach(([key, pid]) => {
    if (pid === selected) return
    const [r, c] = key.split('-').map(Number)
    usedRows.add(r)
    usedCols.add(c)
  })
  const over = game.phase === 'round_over'
  const victimIndex = game.people.length - 1
  const murderer = game.result?.murderer

  return (
    <div
      className="grid aspect-square w-full overflow-hidden rounded-2xl border-[3px] border-ink bg-ink"
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${n}, minmax(0, 1fr))` }}
      role="grid"
      aria-label="Plano de la escena"
    >
      {rooms.flatMap((row, r) =>
        row.map((k, c) => {
          const key = `${r}-${c}`
          const thick = '3px solid var(--color-ink)'
          const thin = '1px solid rgb(34 37 46 / 0.15)'
          const style = {
            background: ROOM_COLORS[k % ROOM_COLORS.length],
            borderTop: r > 0 && rooms[r - 1][c] !== k ? thick : r > 0 ? thin : 'none',
            borderLeft: c > 0 && rooms[r][c - 1] !== k ? thick : c > 0 ? thin : 'none',
          }
          const pid = placedAt[key]
          const person = pid != null ? game.people[pid] : null
          const kind = objects[key]
          const dim = selected != null && pid == null && (usedRows.has(r) || usedCols.has(c))
          const placedBy = game.placed[String(pid)]?.by
          const highlight = over && (pid === murderer || pid === victimIndex)
          return (
            <button
              key={key}
              onClick={() => onCell(r, c)}
              className="relative flex min-h-0 min-w-0 items-center justify-center"
              style={style}
              aria-label={`Fila ${r + 1}, columna ${c + 1}, ${game.roomNames[k]}${kind ? `, ${kind}` : ''}${person ? `, ${person.name}` : ''}`}
            >
              {dim && <span className="absolute inset-0 bg-ink/10" />}
              {labelCell[k] === key && (
                <span className="pointer-events-none absolute left-1 top-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-ink/55 sm:text-[11px]">
                  {game.roomNames[k]}
                </span>
              )}
              {kind && <FurnitureIcon kind={kind} />}
              {notes.has(key) && !person && <span className="font-display text-2xl font-bold text-ink/35">✕</span>}
              {person && (
                <span
                  className={`pop absolute inset-[8%] overflow-hidden rounded-xl ${pid === victimIndex ? 'grayscale' : ''}`}
                  style={{
                    boxShadow: highlight
                      ? `0 0 0 3px ${pid === murderer ? DANGER : 'var(--color-ink)'}`
                      : placedBy
                        ? `0 0 0 2.5px ${colorOf(placedBy)}`
                        : '0 0 0 2px white',
                  }}
                >
                  <Avatar c={person} zoom className="h-full w-full" />
                </span>
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}

/** Muebles dibujados a mano. */
export function FurnitureIcon({ kind }) {
  const common = { className: 'absolute inset-[14%] h-[72%] w-[72%]', viewBox: '0 0 40 40', 'aria-hidden': true }
  if (kind === 'planta')
    return (
      <svg {...common}>
        <path d="M20 22 C10 20 8 10 12 6 C16 10 18 14 20 22 Z M20 22 C30 20 32 10 28 6 C24 10 22 14 20 22 Z M20 22 C18 12 20 6 20 4 C21 8 22 14 20 22 Z" fill="#3E9460" />
        <path d="M12 22 H28 L26 34 H14 Z" fill="#C46F42" />
      </svg>
    )
  if (kind === 'mesa')
    return (
      <svg {...common}>
        <rect x="5" y="12" width="30" height="7" rx="2" fill="#8A5A3B" />
        <rect x="8" y="19" width="3.5" height="14" rx="1" fill="#6E4630" />
        <rect x="28.5" y="19" width="3.5" height="14" rx="1" fill="#6E4630" />
      </svg>
    )
  if (kind === 'estante')
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
  if (kind === 'silla')
    return (
      <svg {...common} className="absolute inset-[22%] h-[56%] w-[56%] opacity-70">
        <rect x="11" y="4" width="18" height="16" rx="3" fill="#B07A52" />
        <rect x="9" y="20" width="22" height="5" rx="2" fill="#8A5A3B" />
        <rect x="10" y="25" width="3" height="11" fill="#6E4630" />
        <rect x="27" y="25" width="3" height="11" fill="#6E4630" />
      </svg>
    )
  if (kind === 'alfombra')
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
    <div className="pop mt-5 flex gap-4 rounded-[2rem] p-5 text-white" style={{ background: winner ? colorOf(winner) : 'var(--color-ink)' }}>
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl ring-4 ring-white/40">
        <Avatar c={murderer} zoom className="h-full w-full" />
      </div>
      <div>
        <p className="text-sm font-semibold text-white/80">¡Caso resuelto en {clock(game.result.seconds * 1000)}!</p>
        <p className="font-display text-3xl font-extrabold">Fue {murderer.name}</p>
        <p className="text-white/85">
          Era {murderer.genero === 'mujer' ? 'la única' : 'el único'} en {withArticle(roomName)} con {victim.name}.
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
              <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-center gap-x-4 rounded-2xl bg-paper px-4 py-3">
            <span className="text-sm text-muted">Caso {h.round}</span>
            <span className="font-semibold">Fue {h.murderer}</span>
            <span className="text-sm text-muted">
              {clock(h.seconds * 1000)}
              {h.winner && <> · lo resolvió <span style={{ color: colorOf(h.winner) }}>{h.winner}</span></>}
            </span>
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'murdoku', ...game.options }} />
    </div>
  )
}
