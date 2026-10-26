import { useState } from 'react'
import { CATEGORIES, CATEGORY_META, CategoryIcon } from '../lib/trivia'

const LEVELS = [['facil', 'Fácil'], ['medio', 'Medio'], ['dificil', 'Difícil'], ['mezcla', 'Mezcla']]

const MODES = [
  ['coronas', 'Coronas', 'Por turnos: giras la ruleta y respondes. Con tres aciertos seguidos juegas por una corona; si fallas, le toca a tu pareja.'],
  ['duelo', 'Duelo', 'Los dos responden la misma pregunta a la vez. Acertar rápido da más puntos.'],
]

/** Tarjeta del lobby para la trivia. */
export default function TriviaCard({ send, alone }) {
  const [mode, setMode] = useState('coronas')
  const [goal, setGoal] = useState(6)
  const [questions, setQuestions] = useState(10)
  const [seconds, setSeconds] = useState(20)
  const [level, setLevel] = useState('mezcla')
  const current = MODES.find(([key]) => key === mode)

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="grid h-28 grid-cols-6" aria-hidden="true">
        {CATEGORIES.map((c) => (
          <div key={c} className="flex items-center justify-center" style={{ background: CATEGORY_META[c].color }}>
            <CategoryIcon category={c} className="h-8 w-8" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Trivia</h3>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Modo">
          {MODES.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMode(key)}
              aria-pressed={mode === key}
              className={`rounded-xl px-2 py-2 font-semibold ${mode === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Dificultad">
          {LEVELS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setLevel(key)}
              aria-pressed={level === key}
              className={`rounded-xl px-1 py-2 text-sm font-semibold ${level === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted">
          Como Preguntados: una ruleta con Geografía, Historia, Ciencia, Arte, Entretenimiento y Deportes, con unas 360 preguntas
          de cultura general y de Colombia en tres niveles.
        </p>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-ink">{current[1]}:</span> {current[2]}
        </p>

        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            {mode === 'coronas' ? (
              <label className="flex items-center gap-2 text-sm font-semibold">
                Meta
                <select value={goal} onChange={(e) => setGoal(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                  <option value={3}>3 coronas</option>
                  <option value={6}>6 coronas</option>
                </select>
              </label>
            ) : (
              <label className="flex items-center gap-2 text-sm font-semibold">
                Preguntas
                <select value={questions} onChange={(e) => setQuestions(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                  {[10, 15, 20].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
            <label className="flex items-center gap-2 text-sm font-semibold">
              Tiempo
              <select value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} className="rounded-xl border border-line bg-stone px-3 py-2">
                {[15, 20, 30].map((n) => <option key={n} value={n}>{n} s</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'trivia', mode, goal, questions, seconds, level })}
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
