import { useState } from 'react'
import { storage } from '../lib/api'
import { ALPHABET, DEFAULT_LETTERS, MIN_LETTERS, TURN_CHOICES } from '../lib/letters'

const LETTERS_KEY = 'cerquita:toolate:letters'
const MODE_KEY = 'cerquita:stop:mode'
const SPELLING_KEY = 'cerquita:stop:spelling'

function loadLetters() {
  try {
    const saved = JSON.parse(storage.get(LETTERS_KEY))
    const valid = ALPHABET.filter((l) => saved.includes(l))
    return valid.length >= MIN_LETTERS ? valid : DEFAULT_LETTERS
  } catch {
    return DEFAULT_LETTERS
  }
}

/** Tarjeta del lobby para Stop, con sus dos modos. */
export default function StopCard({ send, alone }) {
  const [mode, setMode] = useState(() => (storage.get(MODE_KEY) === 'toolate' ? 'toolate' : 'classic'))
  const [rounds, setRounds] = useState(5)
  const [spelling, setSpelling] = useState(() => storage.get(SPELLING_KEY) !== 'off')
  const [turnSeconds, setTurnSeconds] = useState(10)
  const [letters, setLetters] = useState(loadLetters)

  function chooseMode(next) {
    setMode(next)
    storage.set(MODE_KEY, next)
  }

  function saveLetters(next) {
    setLetters(next)
    storage.set(LETTERS_KEY, JSON.stringify(next))
  }

  function toggle(letter) {
    if (letters.includes(letter)) {
      if (letters.length > MIN_LETTERS) saveLetters(letters.filter((l) => l !== letter))
    } else {
      saveLetters(ALPHABET.filter((l) => l === letter || letters.includes(l)))
    }
  }

  function start() {
    if (mode === 'classic') send({ type: 'start_game', game: 'stop', rounds, spelling })
    else send({ type: 'start_game', game: 'toolate', rounds, turnSeconds, letters })
  }

  return (
    <article className="overflow-hidden rounded-3xl bg-paper">
      <div className="grid h-28 grid-cols-4" aria-hidden="true">
        {['S', 'T', 'O', 'P'].map((l, i) => (
          <div
            key={l}
            className="flex items-center justify-center font-display text-5xl font-extrabold text-white"
            style={{ background: ['var(--color-p1)', 'var(--color-ink)', 'var(--color-p2)', 'hsl(40 80% 52%)'][i] }}
          >
            {l}
          </div>
        ))}
      </div>

      <div className="p-6">
        <h3 className="text-2xl font-bold">Stop</h3>

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Modo de juego">
          {[
            ['classic', 'Clásico'],
            ['toolate', 'Contrarreloj'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => chooseMode(key)}
              aria-pressed={mode === key}
              className={`rounded-xl px-3 py-2 font-semibold ${mode === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === 'classic' ? (
          <>
            <p className="mt-4 text-muted">
              Sale una letra y cada uno llena nombre, apellido, ciudad, fruta, color, animal y cosa. El primero que
              termine canta <strong className="text-ink">¡Stop!</strong> 100 puntos por respuesta única, 50 si repiten.
            </p>
            <label className="mt-4 flex items-start gap-3 rounded-2xl bg-stone px-4 py-3">
              <input
                type="checkbox"
                checked={spelling}
                onChange={(e) => {
                  setSpelling(e.target.checked)
                  storage.set(SPELLING_KEY, e.target.checked ? 'on' : 'off')
                }}
                className="mt-1 h-4 w-4 accent-[var(--color-ink)]"
              />
              <span>
                <span className="font-semibold">Revisar ortografía</span>
                <span className="block text-sm text-muted">
                  Ciudad, fruta, color, animal y cosa deben estar bien escritas. Nombre y apellido no se revisan.
                </span>
              </span>
            </label>
          </>
        ) : (
          <>
            <p className="mt-4 text-muted">
              Sale una categoría. Por turnos dicen una palabra en voz alta y tocan la letra con la que empieza antes de
              que se acabe el tiempo. Si entre los dos apagan todo el tablero, lo lograron.
            </p>
            <fieldset className="mt-4">
              <legend className="text-sm font-semibold">
                Letras del tablero{' '}
                <span className="font-normal text-muted">· {letters.length} activas, toca para quitar</span>
              </legend>
              <div className="mt-2 grid grid-cols-7 gap-1.5 sm:grid-cols-9">
                {ALPHABET.map((l) => {
                  const on = letters.includes(l)
                  return (
                    <button
                      key={l}
                      onClick={() => toggle(l)}
                      aria-pressed={on}
                      aria-label={`Letra ${l}${on ? ', activa' : ', desactivada'}`}
                      className={`aspect-square rounded-xl font-display text-lg font-bold ${
                        on ? 'bg-ink text-white' : 'border border-line text-muted line-through'
                      }`}
                    >
                      {l}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 flex gap-3 text-sm">
                <button
                  onClick={() => saveLetters(DEFAULT_LETTERS)}
                  className="font-semibold underline underline-offset-2"
                >
                  Recomendadas
                </button>
                <button onClick={() => saveLetters(ALPHABET)} className="font-semibold underline underline-offset-2">
                  Todas
                </button>
              </div>
            </fieldset>
          </>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Rondas
            <select
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="rounded-xl border border-line bg-stone px-3 py-2"
            >
              {[3, 5, 7, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          {mode === 'toolate' && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              Segundos por turno
              <select
                value={turnSeconds}
                onChange={(e) => setTurnSeconds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {TURN_CHOICES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          <button onClick={start} className="rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
            {alone ? 'Practicar mientras llega' : 'Jugar'}
          </button>
        </div>
      </div>
    </article>
  )
}
