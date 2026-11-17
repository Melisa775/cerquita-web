import { Confetti } from '../lib/motion'

export const CONFETTI_COLORS = ['var(--color-p1)', 'var(--color-p2)', 'hsl(44 90% 58%)', 'hsl(16 80% 62%)', 'hsl(200 70% 60%)']

/** End-of-game title based on the scores. */
export function winnerTitle(scores, unit = 'puntos') {
  const players = Object.keys(scores)
  const ranking = [...players].sort((a, b) => scores[b] - scores[a])
  if (players.length < 2) return `Terminaste con ${scores[ranking[0]] ?? 0} ${unit}`
  if (scores[ranking[0]] === scores[ranking[1]]) return 'Empate perfecto'
  return `Ganó ${ranking[0]}`
}

export function EndActions({ send, replay }) {
  return (
    <div className="mt-8 flex flex-wrap gap-3">
      <Confetti colors={CONFETTI_COLORS} />
      <button onClick={() => send(replay)} className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
        Jugar otra vez
      </button>
      <button
        onClick={() => send({ type: 'back_to_lobby' })}
        className="rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink"
      >
        Volver a los juegos
      </button>
    </div>
  )
}
