import { useState } from 'react'
import Avatar from './Avatar'

// Algunos personajes para la franja de la tarjeta
const PREVIEW = [
  { id: 'camila', name: 'Camila', pelo: 'largo', color: 'castano', ojos: 'cafes', aretes: true, piel: 1, fondo: '#F6C9D0' },
  { id: 'nicolas', name: 'Nicolás', pelo: 'corto', color: 'canoso', ojos: 'azules', gafas: true, barba: true, bigote: true, piel: 1, fondo: '#D9EEF0' },
  { id: 'mariana', name: 'Mariana', pelo: 'corto', color: 'pelirrojo', ojos: 'verdes', sombrero: 'gorra', pecas: true, piel: 0, fondo: '#D5EBD9' },
  { id: 'tomas', name: 'Tomás', pelo: 'largo', color: 'negro', ojos: 'cafes', sombrero: 'sombrero', piel: 3, fondo: '#FBE3B5' },
  { id: 'sofia', name: 'Sofía', pelo: 'rizado', color: 'negro', ojos: 'cafes', gafas: true, piel: 3, fondo: '#E6DDF5' },
]

/** Tarjeta del lobby para Adivina quién. */
export default function GuessWhoCard({ send, alone }) {
  const [size, setSize] = useState(24)
  const [rounds, setRounds] = useState(3)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-center justify-center gap-2 px-4" style={{ background: 'hsl(40 80% 52%)' }} aria-hidden="true">
        {PREVIEW.map((c, i) => (
          <span
            key={c.id}
            className="h-16 w-12 overflow-hidden rounded-xl bg-paper shadow-[0_3px_0_rgb(0_0_0/0.2)]"
            style={{ transform: i === 2 ? 'translateY(-4px)' : i % 2 ? 'rotate(3deg)' : 'rotate(-3deg)' }}
          >
            <Avatar c={c} zoom className="h-full w-full" />
          </span>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Adivina quién</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Tablero">
          {[[16, '16 personajes'], [24, '24 personajes']].map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSize(value)}
              aria-pressed={size === value}
              className={`rounded-xl px-3 py-2 font-semibold ${size === value ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-muted">
          Cada uno tiene un personaje secreto. Por turnos hacen preguntas de sí o no: las de la lista las responde Cerquita y
          las que escriban ustedes las responde la pareja. Vayan bajando personajes hasta saber quién es.
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Rondas
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[1, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'guesswho', boardSize: size, rounds })}
              disabled={alone}
              className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"
            >
              {alone ? 'Esperando a tu pareja' : 'Jugar'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
