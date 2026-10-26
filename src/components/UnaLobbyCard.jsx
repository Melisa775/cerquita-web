import { useState } from 'react'
import PlayingCard from './PlayingCard'

const FAN = [
  { id: 1, color: 'r', value: '7' },
  { id: 2, color: 'b', value: 'reverse' },
  { id: 3, color: null, value: 'wild4' },
  { id: 4, color: 'y', value: 'skip' },
  { id: 5, color: 'g', value: 'draw2' },
]

/** Tarjeta del lobby para Una (al estilo UNO). */
export default function UnaLobbyCard({ send, alone }) {
  const [goal, setGoal] = useState(0)
  const [stacking, setStacking] = useState(false)
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="flex h-28 items-end justify-center overflow-hidden pb-0" style={{ background: 'hsl(222 28% 26%)' }} aria-hidden="true">
        {FAN.map((c, i) => (
          <PlayingCard key={c.id} card={c} width={54} className="-mx-2" style={{ transform: `translateY(${Math.abs(i - 2) * 8 + 14}px) rotate(${(i - 2) * 11}deg)` }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Una</h3>
        <p className="mt-3 text-muted">
          Al estilo UNO: tira una carta del mismo color o número, usa las especiales para fregar a tu pareja y no olvides decir
          «¡Una!» cuando te quede la última, que si te pillan robas dos.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={stacking} onChange={(e) => setStacking(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Acumular +2 y +4 (se responde un +2 con otro)
        </label>
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Partida
              <select value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                <option value={0}>Una mano</option>
                <option value={200}>A 200 puntos</option>
                <option value={500}>A 500 puntos</option>
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'una', goal, stacking })}
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
