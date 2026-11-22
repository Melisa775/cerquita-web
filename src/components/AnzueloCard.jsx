import { useState } from 'react'

/** Lobby card for Anzuelo (catch the liars). */
export default function AnzueloCard({ send, count = 1 }) {
  const maxBots = Math.max(0, Math.min(3, 6 - count))
  const [bots, setBots] = useState(count < 3 ? 3 - count : 0)
  const nBots = Math.min(bots, maxBots)
  const [laps, setLaps] = useState(1)
  const total = count + nBots
  const canPlay = total >= 3
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <svg viewBox="0 0 300 112" className="h-28 w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="300" height="112" fill="#BFE6EE" />
        <ellipse cx="150" cy="78" rx="160" ry="44" fill="#4FB3C8" />
        <path d="M30 70 q20 -8 40 0 M200 92 q20 -8 40 0 M110 100 q16 -6 32 0" stroke="#D9F4FA" strokeWidth="3" fill="none" strokeLinecap="round" />
        {[[70, 80, '#E5484D', '1'], [150, 62, '#3E7CB1', '2'], [228, 82, '#2F9E6A', '3']].map(([x, y, c, n]) => (
          <g key={n} transform={`translate(${x} ${y})`}>
            <ellipse rx="20" ry="11" fill={c} />
            <path d="M-18 0 l-14 -10 v20 z" fill={c} />
            <circle cx="10" cy="-3" r="3" fill="white" />
            <circle cx="11" cy="-3" r="1.5" fill="#1B1B1B" />
            <line x1="0" y1="-11" x2="0" y2="-30" stroke="#F4F1EA" strokeWidth="1.5" />
            <circle cy="-34" r="7" fill="white" stroke="#E5484D" strokeWidth="3" />
            <text y="-30.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#22252E" fontFamily="system-ui">{n}</text>
          </g>
        ))}
        <path d="M246 8 q4 26 -14 30" stroke="#4A3426" strokeWidth="3" fill="none" />
      </svg>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Anzuelo</h3>
        <p className="mt-3 text-muted">
          Uno pesca y los demás son peces. Todos menos el pescador ven la respuesta real; un pez tiene la verdad y el resto escribe una mentira
          creíble. El pescador va sacando mentirosos… pero si pesca al honesto, pierde la ronda. De 3 a 6 jugadores; los que falten pueden ser bots.
        </p>
        <div className="mt-3">
          <p className="text-sm font-semibold">Bots</p>
          <div className="mt-1 grid grid-cols-4 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Cuántos bots">
            {[0, 1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => setBots(n)}
                disabled={n > maxBots}
                aria-pressed={nBots === n}
                className={`rounded-xl px-2 py-1.5 text-sm font-semibold disabled:opacity-30 ${nBots === n ? 'bg-paper shadow-sm' : 'text-muted'}`}
              >
                {n === 0 ? 'Sin bots' : `${n} 🤖`}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Los bots dicen mentiras preparadas y también pescan.</p>
        </div>
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Vueltas
              <select value={laps} onChange={(e) => setLaps(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                <option value={1}>Una (cada uno pesca una vez)</option>
                <option value={2}>Dos, más larga</option>
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'anzuelo', bots: nBots, laps })}
              disabled={!canPlay}
              className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"
            >
              {canPlay ? `Jugar (${total} jugadores)` : 'Hacen falta 3: agrega bots'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
