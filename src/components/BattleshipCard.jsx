import { useState } from 'react'

/** Tarjeta del lobby para la batalla naval. */
export default function BattleshipCard({ send, alone }) {
  const [size, setSize] = useState(10)
  const [noTouch, setNoTouch] = useState(true)
  const [bonus, setBonus] = useState(true)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="relative h-28 overflow-hidden" style={{ background: 'hsl(200 58% 90%)' }} aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(hsl(200 40% 78%) 1px, transparent 1px), linear-gradient(90deg, hsl(200 40% 78%) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute left-[12%] top-[22%] h-5 w-36 rounded-l-[45%] rounded-r-full" style={{ background: 'hsl(214 16% 42%)' }} />
        <div className="absolute left-[58%] top-[56%] h-5 w-20 rounded-l-[45%] rounded-r-full" style={{ background: 'hsl(214 16% 42%)' }} />
        <span className="absolute left-[30%] top-[18%] flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'hsl(8 78% 52%)', boxShadow: '0 0 0 2px white' }}>✕</span>
        <span className="absolute left-[40%] top-[62%] h-3 w-3 rounded-full" style={{ background: 'hsl(205 45% 55%)' }} />
        <span className="absolute left-[82%] top-[24%] h-3 w-3 rounded-full" style={{ background: 'hsl(205 45% 55%)' }} />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Batalla naval</h3>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Tablero">
          {[[10, '10 × 10'], [8, '8 × 8, más rápida']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSize(key)}
              aria-pressed={size === key}
              className={`rounded-xl px-2 py-2 font-semibold ${size === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted">
          Cada uno ubica su flota en secreto. Después se turnan los disparos: agua, tocado o hundido. Gana quien hunda primero
          todos los barcos del otro.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={noTouch} onChange={(e) => setNoTouch(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Los barcos no se pueden tocar
        </label>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={bonus} onChange={(e) => setBonus(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Si aciertas, vuelves a disparar
        </label>

        <div className="mt-auto pt-6">
          <div className="border-t border-line pt-5">
            <button
              onClick={() => send({ type: 'start_game', game: 'battleship', size, noTouch, bonus })}
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
