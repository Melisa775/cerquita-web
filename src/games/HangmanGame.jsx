import { useEffect, useRef, useState } from 'react'
import HangmanDrawing from '../components/HangmanDrawing'
import { EndActions, winnerTitle } from '../components/EndActions'

const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM']
const VALID_WORD = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ \-]*$/

export default function HangmanGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return (
    <div className="mt-4">
      <Header game={game} colorOf={colorOf} />
      {game.phase === 'choosing' ? (
        <Choosing key={game.round} game={game} me={me} send={send} colorOf={colorOf} />
      ) : (
        <Board game={game} me={me} send={send} colorOf={colorOf} />
      )}
    </div>
  )
}

function Header({ game, colorOf }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
      <span>Ronda {game.round} de {game.totalRounds}</span>
      {game.mode === 'turns' ? (
        <div className="flex gap-2">
          {Object.entries(game.scores).map(([p, n]) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-ink tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      ) : (
        (() => {
          const done = game.round - (game.phase === 'round_over' ? 0 : 1)
          return done > 0 ? (
            <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink">
              Salvaron {game.saved} de {done}
            </span>
          ) : null
        })()
      )}
    </div>
  )
}

// --- Elegir la palabra ------------------------------------------------------
function Choosing({ game, me, send, colorOf }) {
  const [word, setWord] = useState('')
  const [hint, setHint] = useState('')
  const mine = game.setter === me
  const clean = word.replace(/\s+/g, ' ').trim()
  const letters = clean.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '').length
  const problem = !clean
    ? null
    : !VALID_WORD.test(clean)
      ? 'Usa solo letras y espacios'
      : letters < 3
        ? 'Necesita al menos 3 letras'
        : null

  if (!mine) {
    return (
      <div className="mt-6 grid items-center gap-6 rounded-[2rem] bg-paper p-6 sm:grid-cols-[12rem_1fr] sm:p-8">
        <div className="mx-auto h-44 w-40 opacity-60">
          <HangmanDrawing misses={0} lives={game.lives} />
        </div>
        <div>
          <h1 className="text-3xl font-bold">
            <span style={{ color: colorOf(game.setter) }}>{game.setter}</span> está pensando una palabra
            <span className="inline-flex w-8 justify-start" aria-hidden="true">
              <span className="animate-pulse">…</span>
            </span>
          </h1>
          <p className="mt-2 text-muted">Apenas la escriba, empiezas a adivinar letra por letra.</p>
        </div>
      </div>
    )
  }

  return (
    <form
      className="mt-6 rounded-[2rem] bg-paper p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault()
        if (clean && !problem) send({ type: 'hangman_word', word: clean, hint })
      }}
    >
      <h1 className="text-3xl font-bold">Te toca elegir la palabra</h1>
      <p className="mt-2 max-w-xl text-muted">
        Tu pareja la va a adivinar letra por letra. Puede ser una frase corta: un apodo, un lugar al que fueron, algo que
        solo ustedes entienden.
      </p>
      <label className="mt-6 block">
        <span className="text-sm font-semibold">Palabra o frase</span>
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          maxLength={30}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Por ejemplo: corazón de melón"
          className="mt-1 w-full rounded-2xl border border-line bg-stone px-4 py-3.5 font-display text-2xl font-bold tracking-wide outline-none focus:border-ink"
        />
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-semibold">Pista <span className="font-normal text-muted">(opcional)</span></span>
        <input
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          maxLength={60}
          autoComplete="off"
          placeholder="Algo que le ayude un poquito"
          className="mt-1 w-full rounded-2xl border border-line bg-stone px-4 py-3 text-lg outline-none focus:border-ink"
        />
      </label>
      {problem && <p className="mt-3 text-sm font-medium text-danger">{problem}</p>}
      <button
        type="submit"
        disabled={!clean || !!problem}
        className="mt-6 w-full rounded-2xl px-5 py-4 text-lg font-semibold text-white disabled:opacity-40 sm:w-auto"
        style={{ background: colorOf(me) }}
      >
        Listo, que adivine
      </button>
    </form>
  )
}

// --- Adivinar ------------------------------------------------------------
function Board({ game, me, send, colorOf }) {
  const [solving, setSolving] = useState(false)
  const [attempt, setAttempt] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const lastMisses = useRef(game.misses)
  const guessing = game.phase === 'guessing'
  const canGuess = guessing && game.guessers.includes(me)
  const isSetter = game.setter === me
  const guesserColor = game.mode === 'turns' ? colorOf(game.guessers[0]) : 'var(--color-ink)'
  const over = game.phase === 'round_over'
  const state = over ? (game.result.won ? 'won' : 'lost') : 'playing'

  // Cada error sacude un poco la palabra
  useEffect(() => {
    if (game.misses > lastMisses.current) setShakeKey((k) => k + 1)
    lastMisses.current = game.misses
  }, [game.misses])

  // También se juega con el teclado del computador
  useEffect(() => {
    if (!canGuess || solving) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      const letter = e.key.toLowerCase()
      if (/^[a-zñ]$/.test(letter) && !game.guessed.includes(letter)) send({ type: 'hangman_guess', letter })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canGuess, solving, game.guessed, send])

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-[minmax(0,17rem)_1fr] md:items-start">
      <div className="rounded-[2rem] bg-paper p-4">
        <div className="mx-auto aspect-[200/220] w-full max-w-[15rem]">
          <HangmanDrawing misses={game.misses} lives={game.lives} state={state} color={guesserColor} />
        </div>
        <Lives left={game.lives - game.misses} total={game.lives} />
      </div>

      <div className="min-w-0">
        <Role game={game} me={me} colorOf={colorOf} />

        <div key={shakeKey} className={`mt-4 flex flex-wrap gap-x-5 gap-y-4 ${shakeKey ? 'shake' : ''}`} aria-live="polite">
          {splitWords(game.slots).map((word, wi) => (
            <div key={wi} className="flex gap-1.5">
              {word.map(({ slot, i }) => (
                <Slot key={i} slot={slot} isSetter={isSetter} over={over} color={guesserColor} />
              ))}
            </div>
          ))}
        </div>

        {(game.hint || game.category) && (
          <p className="mt-5 text-muted">
            {game.category ? 'Categoría' : 'Pista'}:{' '}
            <span className="font-semibold text-ink">{game.category || game.hint}</span>
          </p>
        )}

        {over ? (
          <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
        ) : (
          <>
            <Keyboard game={game} canGuess={canGuess} color={guesserColor} send={send} />
            {(game.wrong.length > 0 || game.wrongSolves.length > 0) && (
              <p className="mt-3 text-sm text-muted">
                No están:{' '}
                <span className="font-semibold tracking-widest text-ink">{game.wrong.join(' ').toUpperCase()}</span>
                {game.wrongSolves.length > 0 && <> · Intentaron: {game.wrongSolves.join(', ')}</>}
              </p>
            )}
            {canGuess &&
              (solving ? (
                <form
                  className="mt-5 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!attempt.trim()) return
                    send({ type: 'hangman_solve', word: attempt })
                    setAttempt('')
                    setSolving(false)
                  }}
                >
                  <input
                    autoFocus
                    value={attempt}
                    onChange={(e) => setAttempt(e.target.value)}
                    maxLength={30}
                    autoComplete="off"
                    placeholder="¿Cuál es?"
                    className="w-full min-w-0 rounded-2xl border border-line bg-paper px-4 py-3 text-lg outline-none focus:border-ink"
                  />
                  <button type="submit" className="rounded-2xl px-5 font-semibold text-white" style={{ background: guesserColor }}>
                    Probar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSolving(false)}
                    className="rounded-2xl border border-line px-4 font-semibold hover:border-ink"
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <button
                  onClick={() => setSolving(true)}
                  className="mt-5 text-sm font-semibold underline underline-offset-2 hover:text-ink"
                >
                  Arriesgar la palabra completa (si fallas, pierdes una vida)
                </button>
              ))}
          </>
        )}
      </div>
    </div>
  )
}

function splitWords(slots) {
  const words = [[]]
  slots.forEach((slot, i) => {
    if (slot.char === ' ') words.push([])
    else words.at(-1).push({ slot, i })
  })
  return words.filter((w) => w.length)
}

function Slot({ slot, isSetter, over, color }) {
  if (!slot.letter) {
    return <span className="flex h-12 w-5 items-end justify-center font-display text-3xl font-extrabold sm:h-14">{slot.char}</span>
  }
  const visible = slot.char != null
  const missed = over && !slot.found // la palabra se revela al final
  const ghost = isSetter && !slot.found && !over // quien eligió ve las que faltan, en tenue
  return (
    <span
      className="flex h-12 w-9 items-end justify-center border-b-4 pb-1 font-display text-3xl font-extrabold uppercase sm:h-14 sm:w-11 sm:text-4xl"
      style={{ borderColor: slot.found ? color : 'var(--color-ink)' }}
    >
      {visible && (
        <span
          key={slot.found ? 'found' : 'shown'}
          className={slot.found ? 'pop' : ''}
          style={{ color: missed ? 'var(--color-danger)' : ghost ? 'var(--color-line)' : undefined }}
        >
          {slot.char}
        </span>
      )}
    </span>
  )
}

function Lives({ left, total }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1" aria-label={`${left} de ${total} vidas`}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} viewBox="-7 -2 14 14" className="h-4 w-4" aria-hidden="true">
          <path
            d="M0 3 C0 -1 -6 -1 -6 3 C-6 6 0 9 0 11 C0 9 6 6 6 3 C6 -1 0 -1 0 3 Z"
            fill={i < left ? 'var(--color-p2)' : 'none'}
            stroke={i < left ? 'none' : 'var(--color-line)'}
            strokeWidth="1.4"
          />
        </svg>
      ))}
    </div>
  )
}

function Role({ game, me, colorOf }) {
  if (game.phase !== 'guessing') return null
  if (game.mode === 'random') return <p className="text-muted">Adivinen juntos. Cualquiera de los dos puede tocar letras.</p>
  if (game.setter === me) {
    const g = game.guessers[0]
    return (
      <p className="text-muted">
        Es tu palabra. <span className="font-semibold" style={{ color: colorOf(g) }}>{g}</span> está adivinando; las letras
        claras son las que le faltan.
      </p>
    )
  }
  return (
    <p className="text-muted">
      Palabra de <span className="font-semibold" style={{ color: colorOf(game.setter) }}>{game.setter}</span>. Toca una
      letra.
    </p>
  )
}

function Keyboard({ game, canGuess, color, send }) {
  const inWord = (l) => game.guessed.includes(l) && !game.wrong.includes(l)
  return (
    <div className="mt-6 space-y-1.5" role="group" aria-label="Letras">
      {ROWS.map((row, r) => (
        <div key={row} className={`flex justify-center gap-1 sm:gap-1.5 ${r === 2 ? 'px-[15%] sm:px-0' : ''}`}>
          {row.split('').map((L) => {
            const l = L.toLowerCase()
            const used = game.guessed.includes(l)
            const hit = inWord(l)
            return (
              <button
                key={L}
                onClick={() => send({ type: 'hangman_guess', letter: l })}
                disabled={!canGuess || used}
                aria-label={`${L}${used ? (hit ? ', está' : ', no está') : ''}`}
                className={`h-12 min-w-0 flex-1 rounded-xl font-display text-lg font-bold sm:h-14 sm:max-w-12 sm:text-xl ${
                  hit
                    ? 'text-white'
                    : used
                      ? 'text-muted line-through opacity-50'
                      : canGuess
                        ? 'bg-paper shadow-[0_2px_0_rgb(0_0_0/0.12)] hover:bg-ink hover:text-white active:translate-y-px'
                        : 'bg-paper text-ink/60'
                }`}
                style={hit ? { background: color } : undefined}
              >
                {L}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function RoundOver({ game, me, send, colorOf }) {
  const r = game.result
  const last = game.round >= game.totalRounds
  let title
  let detail
  if (game.mode === 'random') {
    title = r.won ? '¡Lo salvaron!' : '¡Ahorcado!'
    detail = r.won
      ? `Con ${r.livesLeft} ${r.livesLeft === 1 ? 'vida' : 'vidas'} de sobra.`
      : 'Se acabaron las vidas. La palabra quedó arriba, en rojo lo que faltó.'
  } else if (r.won) {
    const g = game.guessers[0]
    title = g === me ? '¡La adivinaste!' : `¡${g} la adivinó!`
    detail = `Con ${r.livesLeft} ${r.livesLeft === 1 ? 'vida' : 'vidas'} de sobra. Punto para ${g === me ? 'ti' : g}.`
  } else {
    title = '¡Ahorcado!'
    detail = `Punto para ${game.setter === me ? 'ti' : game.setter}, que eligió la palabra.`
  }
  const accent = game.mode === 'turns' && r.winner ? colorOf(r.winner) : 'var(--color-ink)'
  return (
    <div className="pop mt-6 rounded-[2rem] p-6 text-white" style={{ background: accent }}>
      <p className="font-display text-4xl font-extrabold">{title}</p>
      <p className="mt-1 text-white/85">{detail}</p>
      <button onClick={() => send({ type: 'next_round' })} className="mt-5 rounded-2xl bg-white px-5 py-3 font-semibold text-ink">
        {last ? 'Ver resultados' : game.mode === 'turns' ? 'Cambiar de turno' : 'Otra palabra'}
      </button>
    </div>
  )
}

// --- Final ----------------------------------------------------------------
function Final({ game, me, send, colorOf }) {
  const random = game.mode === 'random'
  const total = game.history.length
  const title = random
    ? game.saved === total
      ? `¡Salvaron las ${total}!`
      : `Salvaron ${game.saved} de ${total}`
    : winnerTitle(game.scores)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{title}</h1>
      {!random && (
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(game.scores).map(([p, n]) => (
            <div key={p} className="rounded-2xl bg-paper px-5 py-3">
              <p className="font-semibold" style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</p>
              <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-paper px-4 py-3">
            <span className="w-5 text-sm text-muted tabular-nums">{h.round}</span>
            <span className="font-display text-xl font-extrabold uppercase tracking-wide">{h.word}</span>
            <span className="text-sm text-muted">
              {h.category ?? <>de <span style={{ color: colorOf(h.setter) }}>{h.setter}</span></>}
            </span>
            <span
              className="ml-auto rounded-full px-3 py-0.5 text-sm font-semibold"
              style={h.won ? { background: 'var(--color-p1)', color: 'white' } : { background: 'var(--color-stone)' }}
            >
              {h.won ? `adivinada · ${h.misses} ${h.misses === 1 ? 'error' : 'errores'}` : 'ahorcado'}
            </span>
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'hangman', ...game.options }} />
    </div>
  )
}
