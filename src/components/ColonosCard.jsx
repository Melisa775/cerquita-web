import { useState } from 'react'
import { TERRAIN, TerrainArt } from '../lib/colonos'

const PREVIEW = ['forest', 'fields', 'hills', 'pasture', 'mountains']

/** Lobby card for Colonos (Catan-style). */
export default function ColonosCard({ send, alone }) {
  const [goal, setGoal] = useState(10)
  const [friendly, setFriendly] = useState(false)
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <svg viewBox="0 0 300 112" className="h-28 w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="300" height="112" fill="hsl(204 62% 56%)" />
        {PREVIEW.map((t, i) => {
          const cx = 50 + i * 50
          const cy = i % 2 ? 66 : 46
          const pts = Array.from({ length: 6 }, (_, k) => {
            const a = ((60 * k - 30) * Math.PI) / 180
            return `${cx + 29 * Math.cos(a)},${cy + 29 * Math.sin(a)}`
          }).join(' ')
          return (
            <g key={t}>
              <polygon points={pts} fill={TERRAIN[t].fill} stroke="hsl(40 40% 92%)" strokeWidth="3" />
              <g transform={`translate(${cx} ${cy}) scale(15)`}>
                <TerrainArt terrain={t} />
              </g>
            </g>
          )
        })}
      </svg>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Colonos</h3>
        <p className="mt-3 text-muted">
          Al estilo Catan: una isla al azar, dados que hacen producir los terrenos y a construir caminos, pueblos y ciudades.
          Comercien con el banco, los puertos o entre ustedes, cuídense del ladrón y jueguen cartas de desarrollo.
        </p>
        <label className="mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={friendly} onChange={(e) => setFriendly(e.target.checked)} className="h-4 w-4 accent-[var(--color-ink)]" />
          Ladrón amable (no molesta a quien tiene 2 puntos o menos)
        </label>
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Meta
              <select value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                <option value={10}>10 puntos</option>
                <option value={8}>8 puntos, más corta</option>
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'colonos', goal, friendly })}
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
