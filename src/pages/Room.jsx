import { useState } from 'react'
import { useRoom } from '../hooks/useRoom'
import { Logo } from './Home'
import ColorGame from '../games/ColorGame'
import { PLAYER_COLORS } from '../lib/color'

const UPCOMING = ['Stop', 'Ahorcado', 'Wordle a dúo', 'Sopa de letras']

export default function Room({ code, name, onExit }) {
  const { room, status, error, fatal, send } = useRoom(code, name)

  if (fatal) {
    return (
      <Centered>
        <h1 className="text-3xl font-bold">No pudiste entrar</h1>
        <p className="mt-2 text-muted">{fatal}</p>
        <button onClick={onExit} className="mt-6 rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
          Volver al inicio
        </button>
      </Centered>
    )
  }

  if (!room) {
    return <Centered><p className="text-muted">Conectando a la sala {code}…</p></Centered>
  }

  const players = room.players
  const colorOf = (player) => PLAYER_COLORS[Math.max(0, players.findIndex((p) => p.name === player))]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button onClick={onExit} aria-label="Salir de la sala"><Logo small /></button>
        <div className="flex items-center gap-2">
          {players.map((p, i) => (
            <span
              key={p.name}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-white"
              style={{ background: PLAYER_COLORS[i], opacity: p.online ? 1 : 0.45 }}
              title={p.online ? 'Conectado' : 'Desconectado'}
            >
              {p.name}{p.name === name && ' (tú)'}
              {!p.online && <span className="font-normal">(sin conexión)</span>}
            </span>
          ))}
        </div>
      </header>

      {status === 'reconnecting' && (
        <p role="status" className="bg-ink py-2 text-center text-sm text-white">Se perdió la conexión. Reconectando…</p>
      )}

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-12">
        {room.game ? (
          <ColorGame room={room} me={name} send={send} colorOf={colorOf} />
        ) : (
          <Lobby room={room} send={send} />
        )}
        {error && <p role="alert" className="mt-4 text-center font-medium text-danger">{error}</p>}
      </main>
    </div>
  )
}

function Lobby({ room, send }) {
  const [rounds, setRounds] = useState(5)
  const [copied, setCopied] = useState(false)
  const alone = room.players.length < 2
  const link = `${window.location.origin}${window.location.pathname}?sala=${room.code}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-6">
      <section className="rounded-3xl bg-paper p-6 sm:p-8">
        {alone ? (
          <>
            <h1 className="text-3xl font-bold">Esperando a tu pareja</h1>
            <p className="mt-2 text-muted">Envíale el código o el enlace. Apenas entre, aparecerá arriba.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Ya están los dos</h1>
            <p className="mt-2 text-muted">Elijan un juego; cualquiera de los dos puede empezarlo.</p>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="font-display text-4xl font-extrabold tracking-[0.18em]">{room.code}</span>
          <button onClick={copy} className="rounded-2xl border border-line px-4 py-2.5 font-semibold hover:border-ink">
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </div>
      </section>

      <h2 className="mt-10 text-2xl font-bold">Juegos</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <article className="overflow-hidden rounded-3xl bg-paper">
          <div className="grid h-28 grid-cols-3" aria-hidden="true">
            <div style={{ background: 'hsl(14 78% 58%)' }} />
            <div style={{ background: 'hsl(46 85% 62%)' }} />
            <div style={{ background: 'hsl(190 60% 45%)' }} />
          </div>
          <div className="p-6">
            <h3 className="text-2xl font-bold">Color de memoria</h3>
            <p className="mt-1 text-muted">
              Verán un color por 5 segundos. Después, cada uno lo recrea de memoria. Gana quien quede más cerca.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold">
                Rondas
                <select
                  value={rounds}
                  onChange={(e) => setRounds(Number(e.target.value))}
                  className="rounded-xl border border-line bg-stone px-3 py-2"
                >
                  {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <button
                onClick={() => send({ type: 'start_game', game: 'color', rounds })}
                className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white"
              >
                {alone ? 'Practicar mientras llega' : 'Jugar'}
              </button>
            </div>
          </div>
        </article>

        <aside className="rounded-3xl border border-dashed border-line p-6">
          <h3 className="text-lg font-bold">En camino</h3>
          <ul className="mt-3 space-y-2 text-muted">
            {UPCOMING.map((g) => <li key={g}>{g}</li>)}
          </ul>
        </aside>
      </div>
    </div>
  )
}

function Centered({ children }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">{children}</main>
}
