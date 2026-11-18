import { useState } from 'react'
import { ADVENTURES, CLASSES } from '../lib/mazmorras'

/** Lobby card for Mazmorras (fantasy role-play with a d20). */
export default function MazmorrasCard({ send, count = 1, players = [] }) {
  const [adventure, setAdventure] = useState('cripta')
  const [dm, setDm] = useState('auto')
  const dmName = dm !== 'auto' && players.includes(dm) ? dm : 'auto'
  const heroes = count - (dmName === 'auto' ? 0 : 1)
  const maxCompanions = Math.max(0, Math.min(4, 5 - heroes))
  const [companions, setCompanions] = useState(count < 2 ? 1 : 0)
  const nComp = Math.min(companions, maxCompanions)
  const canPlay = heroes + nComp >= 1 && heroes <= 5
  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <svg viewBox="0 0 300 112" className="h-28 w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          <radialGradient id="mz-light" cx="50%" cy="60%" r="60%">
            <stop offset="0" stopColor="#FFB061" stopOpacity=".55" />
            <stop offset="1" stopColor="#FFB061" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="300" height="112" fill="#191520" />
        <rect width="300" height="112" fill="url(#mz-light)" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={30 + i * 40} y="70" width="38" height="42" fill={i % 2 ? '#5C5660' : '#6E6870'} stroke="#3B3540" strokeWidth="2" />
        ))}
        <polygon points="150,14 176,30 176,60 150,76 124,60 124,30" fill="#D9433A" stroke="#FFE3C2" strokeWidth="2" />
        <path d="M150 14V44L124 60M150 44L176 60" fill="none" stroke="#FFE3C2" strokeOpacity=".6" strokeWidth="1.5" />
        <text x="150" y="54" textAnchor="middle" fontSize="22" fontWeight="900" fill="#fff" fontFamily="system-ui">20</text>
        {Object.values(CLASSES).map((c, i) => (
          <text key={c.label} x={40 + i * 26 + (i > 1 ? 120 : 0)} y="64" fontSize="22">{c.emoji}</text>
        ))}
      </svg>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Mazmorras</h3>
        <p className="mt-3 text-muted">
          Rol de fantasía con un d20, inspirado en los clásicos de mesa: elijan héroe, exploren salas, desarmen trampas y peleen por turnos contra
          monstruos y un jefe final. El Dungeon Master puede ser el sistema o una persona. Trae un libro de reglas para consultar mientras juegan.
        </p>
        <div className="mt-3">
          <p className="text-sm font-semibold">Aventura</p>
          <div className="mt-1 grid gap-1">
            {Object.entries(ADVENTURES).map(([key, a]) => (
              <button
                key={key}
                onClick={() => setAdventure(key)}
                aria-pressed={adventure === key}
                className={`rounded-2xl border px-3 py-2 text-left text-sm ${adventure === key ? 'border-ink bg-stone' : 'border-line'}`}
              >
                <b>{a.emoji} {a.title}</b>
                <span className="block text-xs text-muted">{a.blurb}</span>
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 flex flex-col gap-1 text-sm font-semibold">
          Dungeon Master
          <select value={dmName} onChange={(e) => setDm(e.target.value)} className="rounded-xl border border-line bg-stone px-3 py-2 font-normal">
            <option value="auto">El sistema (automático)</option>
            {players.length > 1 && players.map((p) => <option key={p} value={p}>{p} (no juega con héroe)</option>)}
          </select>
        </label>
        <div className="mt-3">
          <p className="text-sm font-semibold">Compañeros bot</p>
          <div className="mt-1 grid grid-cols-5 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Cuántos compañeros bot">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setCompanions(n)}
                disabled={n > maxCompanions}
                aria-pressed={nComp === n}
                className={`rounded-xl px-2 py-1.5 text-sm font-semibold disabled:opacity-30 ${nComp === n ? 'bg-paper shadow-sm' : 'text-muted'}`}
              >
                {n === 0 ? 'No' : `${n} 🤖`}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Héroes que juegan solos en las peleas. Hasta 5 héroes en total.</p>
        </div>
        <div className="mt-auto pt-6">
          <div className="border-t border-line pt-5">
            <button
              onClick={() => send({ type: 'start_game', game: 'mazmorras', adventure, dm: dmName, companions: nComp })}
              disabled={!canPlay}
              className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white disabled:opacity-40"
            >
              {canPlay ? `Empezar la aventura (${heroes + nComp} ${heroes + nComp === 1 ? 'héroe' : 'héroes'})` : 'Hace falta al menos un héroe'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}
