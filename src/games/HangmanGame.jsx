/**
 * Hangman on the 3D stage: the gallows, the doll and the word tiles are 3D;
 * the keyboard and the forms float over the bottom of the stage.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring } from '../lib/motion'
import { EndActions, winnerTitle } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Panel, Plates, StageLayout, useViewKeys } from '../components/stage/hud'
import { cssColor } from '../lib/three/kit'

const load = () => import('../lib/three/hangman3d.js')

const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM']
const VALID_WORD = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ][A-Za-zÁÉÍÓÚÜÑáéíóúüñ \-]*$/

export default function HangmanGame({ room, me, send, colorOf }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} />
}

function Play({ game, me, send, colorOf }) {
  const stageRef = useRef(null)
  useViewKeys(stageRef)
  const choosing = game.phase === 'choosing'
  const over = game.phase === 'round_over'
  const guesserColor = game.mode === 'turns' && game.guessers?.[0] ? colorOf(game.guessers[0]) : 'var(--color-ink)'
  const color3d = useMemo(() => cssColor(guesserColor), [guesserColor])
  const state = useMemo(
    () => ({
      round: game.round,
      slots: choosing ? [] : game.slots,
      misses: choosing ? 0 : game.misses,
      lives: game.lives,
      over,
      won: over && game.result?.won,
      isSetter: game.setter === me,
      color: color3d,
    }),
    [game.round, choosing, game.slots, game.misses, game.lives, over, game.result, game.setter, me, color3d],
  )

  const plates =
    game.mode === 'turns'
      ? Object.entries(game.scores).map(([p, n]) => ({ name: p, you: p === me, color: colorOf(p), value: n, max: game.totalRounds, stats: `Ronda ${game.round} de ${game.totalRounds}`, active: game.guessers?.includes(p) && game.phase === 'guessing' }))
      : [{ name: 'Juntos', color: colorOf(me), value: game.saved, max: game.totalRounds, stats: `Ronda ${game.round} de ${game.totalRounds}`, active: true }]
  const left = choosing ? game.lives : game.lives - game.misses

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#EEF2F5, #CFD9E1)"
      stage={<Stage3D ref={stageRef} load={load} state={state} label="Ahorcado en 3D" />}
      top={
        <>
          <Plates players={plates} />
          <div className="shrink-0 rounded-2xl bg-paper/90 px-3 py-2 shadow-sm backdrop-blur">
            <Lives left={left} total={game.lives} />
          </div>
        </>
      }
      bottom={
        <div className="pointer-events-auto w-full max-w-2xl">
          {choosing ? <Choosing key={game.round} game={game} me={me} send={send} colorOf={colorOf} /> : <Board game={game} me={me} send={send} colorOf={colorOf} />}
        </div>
      }
      aside={
        <Panel title="Cómo se juega">
          <ul className="space-y-1 px-1 text-sm text-muted">
            <li>Toquen letras: cada error dibuja una parte del muñeco.</li>
            <li>Pueden arriesgar la palabra completa; si fallan, pierden una vida.</li>
            <li>{game.mode === 'turns' ? 'Por turnos, uno elige la palabra y el otro adivina.' : 'Adivinen juntos la palabra.'}</li>
          </ul>
          {!choosing && (game.wrong.length > 0 || game.wrongSolves.length > 0) && (
            <p className="mt-3 px-1 text-sm text-muted">
              No están: <span className="font-semibold tracking-widest text-ink">{game.wrong.join(' ').toUpperCase()}</span>
              {game.wrongSolves.length > 0 && <> · Intentaron: {game.wrongSolves.join(', ')}</>}
            </p>
          )}
        </Panel>
      }
    />
  )
}

// --- Choose the word --------------------------------------------------------
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
      <div className="rounded-[2rem] bg-paper/95 p-5 shadow-xl backdrop-blur sm:p-6">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
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
      className="max-h-[70vh] overflow-y-auto rounded-[2rem] bg-paper/95 p-5 shadow-xl backdrop-blur sm:p-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (clean && !problem) send({ type: 'hangman_word', word: clean, hint })
      }}
    >
      <h1 className="text-2xl font-bold sm:text-3xl">Te toca elegir la palabra</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Tu pareja la va a adivinar letra por letra. Puede ser una frase corta: un apodo, un lugar al que fueron, algo que
        solo ustedes entienden.
      </p>
      <label className="mt-4 block">
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
        className="mt-4 w-full rounded-2xl px-5 py-3.5 text-lg font-semibold text-white disabled:opacity-40 sm:w-auto"
        style={{ background: colorOf(me) }}
      >
        Listo, que adivine
      </button>
    </form>
  )
}

// --- Guess ---------------------------------------------------------------
function Board({ game, me, send, colorOf }) {
  const [solving, setSolving] = useState(false)
  const [attempt, setAttempt] = useState('')
  const guessing = game.phase === 'guessing'
  const canGuess = guessing && game.guessers.includes(me)
  const guesserColor = game.mode === 'turns' ? colorOf(game.guessers[0]) : 'var(--color-ink)'
  const over = game.phase === 'round_over'

  // It can also be played with the computer keyboard
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
    <div className="space-y-2">
      {(game.phase === 'guessing' || game.hint || game.category) && (
        <div className="rounded-2xl bg-paper/90 px-4 py-2 text-center shadow-md backdrop-blur">
          <Role game={game} me={me} colorOf={colorOf} />
          {(game.hint || game.category) && (
            <p className="text-sm text-muted">
              {game.category ? 'Categoría' : 'Pista'}: <span className="font-semibold text-ink">{game.category || game.hint}</span>
            </p>
          )}
        </div>
      )}
      {over ? (
        <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
      ) : (
        <>
          <Keyboard game={game} canGuess={canGuess} color={guesserColor} send={send} />
          {canGuess &&
            (solving ? (
              <form
                className="flex gap-2"
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
                  className="w-full min-w-0 rounded-2xl border border-line bg-paper px-4 py-3 text-lg shadow-md outline-none focus:border-ink"
                />
                <button type="submit" className="rounded-2xl px-5 font-semibold text-white shadow-md" style={{ background: guesserColor }}>
                  Probar
                </button>
                <button type="button" onClick={() => setSolving(false)} className="rounded-2xl bg-paper px-4 font-semibold shadow-md hover:bg-white">
                  Cancelar
                </button>
              </form>
            ) : (
              <div className="text-center">
                <button onClick={() => setSolving(true)} className="rounded-full bg-paper/90 px-4 py-1.5 text-sm font-semibold shadow-sm backdrop-blur hover:bg-white">
                  Arriesgar la palabra completa (si fallas, pierdes una vida)
                </button>
              </div>
            ))}
        </>
      )}
    </div>
  )
}

function Lives({ left, total }) {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-1" aria-label={`${left} de ${total} vidas`}>
      {Array.from({ length: total }, (_, i) => (
        <motion.svg
          key={i}
          viewBox="-7 -2 14 14"
          className="h-4 w-4"
          aria-hidden="true"
          initial={false}
          // a lost life jumps, shrinks and fades to an outline
          animate={i < left ? { scale: 1, y: 0, rotate: 0 } : { scale: [1, 1.6, 0.85, 1], y: [0, -6, 2, 0], rotate: [0, -15, 10, 0] }}
          transition={{ duration: 0.5 }}
        >
          <path
            d="M0 3 C0 -1 -6 -1 -6 3 C-6 6 0 9 0 11 C0 9 6 6 6 3 C6 -1 0 -1 0 3 Z"
            fill={i < left ? 'var(--color-p2)' : 'none'}
            stroke={i < left ? 'none' : 'var(--color-line)'}
            strokeWidth="1.4"
          />
        </motion.svg>
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
    <div className="space-y-1 rounded-2xl bg-paper/85 p-1.5 shadow-lg backdrop-blur sm:space-y-1.5" role="group" aria-label="Letras">
      {ROWS.map((row, r) => (
        <div key={row} className={`flex justify-center gap-1 sm:gap-1.5 ${r === 2 ? 'px-[15%] sm:px-0' : ''}`}>
          {row.split('').map((L) => {
            const l = L.toLowerCase()
            const used = game.guessed.includes(l)
            const hit = inWord(l)
            return (
              <motion.button
                key={L}
                initial={false}
                animate={hit ? { y: [0, -8, 0], scale: [1, 1.15, 1] } : used ? { x: [0, -5, 5, -3, 0] } : { x: 0, y: 0, scale: 1 }}
                transition={{ duration: 0.35 }}
                onClick={() => send({ type: 'hangman_guess', letter: l })}
                disabled={!canGuess || used}
                aria-label={`${L}${used ? (hit ? ', está' : ', no está') : ''}`}
                className={`h-11 min-w-0 flex-1 rounded-xl font-display text-lg font-bold sm:h-12 sm:max-w-12 sm:text-xl ${
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
              </motion.button>
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
    <div className="pop rounded-[2rem] p-6 text-white shadow-xl" style={{ background: accent }}>
      <p className="font-display text-4xl font-extrabold">{title}</p>
      <p className="mt-1 text-white/85">{detail}</p>
      <button onClick={() => send({ type: 'next_round' })} className="mt-5 rounded-2xl bg-white px-5 py-3 font-semibold text-ink">
        {last ? 'Ver resultados' : game.mode === 'turns' ? 'Cambiar de turno' : 'Otra palabra'}
      </button>
    </div>
  )
}

// --- End ------------------------------------------------------------------
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
              <p className="font-display text-4xl font-extrabold"><AnimatedNumber value={n} from={0} duration={1} /></p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <motion.li
            key={h.round}
            className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-paper px-4 py-3"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...softSpring, delay: 0.1 * h.round }}
          >
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
          </motion.li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'hangman', ...game.options }} />
    </div>
  )
}
