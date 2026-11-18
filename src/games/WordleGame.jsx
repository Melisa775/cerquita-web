/**
 * Wordle on the 3D stage: wooden letter tiles that flip over to show their
 * colors. The keyboard floats over the bottom of the stage.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { AnimatedNumber, softSpring, spring } from '../lib/motion'
import { EndActions, winnerTitle } from '../components/EndActions'
import Stage3D from '../components/stage/Stage3D'
import { Banner, Flash, Panel, Plates, StageLayout } from '../components/stage/hud'

const load = () => import('../lib/three/wordle3d.js')

export const MARK_COLORS = {
  correct: 'hsl(148 42% 38%)',
  present: 'hsl(42 82% 48%)',
  absent: '#8A8E99',
}
const RANK = { absent: 1, present: 2, correct: 3 }
const ROWS = ['QWERTYUIOP', 'ASDFGHJKLÑ', 'ZXCVBNM']

export default function WordleGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (game.phase === 'finished') return <Final game={game} me={me} send={send} colorOf={colorOf} />
  return <Play game={game} me={me} send={send} colorOf={colorOf} error={error} errorId={errorId} />
}
WordleGame.showsErrors = true // errors are shown next to the board

function Play({ game, me, send, colorOf, error, errorId }) {
  const team = game.mode === 'team'
  const myRows = team ? game.teamRows : game.boards[me] ?? []
  const playing = game.phase === 'playing'
  const isPlayer = game.players.includes(me)
  const myTurn = team ? game.turn === me : true
  const done = !team && (game.solved.includes(me) || myRows.length >= game.maxTries)
  const canType = playing && isPlayer && myTurn && !done
  const stageRef = useRef(null)

  const [draft, setDraft] = useState('')
  const [flash, setFlash] = useState(null)
  const [shake, setShake] = useState(0)
  const rowsSeen = useRef(myRows.length)
  const errorsSeen = useRef(errorId)

  // When the server accepts the word, the input is cleared
  useEffect(() => {
    if (myRows.length !== rowsSeen.current) {
      rowsSeen.current = myRows.length
      setDraft('')
    }
  }, [myRows.length])

  // Word rejected: the row shakes and the reason appears
  useEffect(() => {
    if (errorId === errorsSeen.current) return
    errorsSeen.current = errorId
    if (!error) return
    setShake((n) => n + 1)
    setFlash({ text: error, id: errorId })
  }, [errorId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 1800)
    return () => clearTimeout(id)
  }, [flash])

  function update(next) {
    setDraft(next)
    if (team) send({ type: 'wordle_draft', text: next })
  }

  function press(key) {
    if (!canType) return
    if (key === 'enter') {
      if (draft.length < game.length) {
        setShake((n) => n + 1)
        setFlash({ text: `La palabra tiene ${game.length} letras`, id: Date.now() })
        return
      }
      send({ type: 'wordle_guess', word: draft })
    } else if (key === 'back') {
      update(draft.slice(0, -1))
    } else if (draft.length < game.length) {
      update(draft + key)
    }
  }

  useEffect(() => {
    if (!canType) return
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select')) return
      if (e.key === 'Enter') press('enter')
      else if (e.key === 'Backspace') press('back')
      else if (/^[a-zñ]$/i.test(e.key)) press(e.key.toLowerCase())
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const shownDraft = team && !myTurn ? game.draft : draft
  const typerColor = team ? colorOf(game.turn) : colorOf(me)
  const others = Object.keys(game.boards).filter((p) => p !== me)
  const state = useMemo(
    () => ({
      length: game.length,
      maxTries: game.maxTries,
      round: game.round,
      rows: myRows,
      draft: playing && (canType || team) ? shownDraft ?? '' : null,
      typerColor,
      shakeKey: shake,
      colors: MARK_COLORS,
    }),
    [game.length, game.maxTries, game.round, myRows, playing, canType, team, shownDraft, typerColor, shake],
  )

  let title
  if (!playing) title = null
  else if (team) title = game.turn === me ? 'Te toca escribir' : `Escribe ${game.turn}`
  else if (done) title = game.solved.includes(me) ? '¡La sacaste!' : 'Se acabaron tus intentos'
  else title = `Adivina la palabra de ${game.length} letras`
  const hint = !playing ? null : team && game.turn !== me ? 'Ayúdale por la videollamada.' : done ? 'Espera a tu pareja…' : `Intento ${Math.min(myRows.length + 1, game.maxTries)} de ${game.maxTries}`

  const plates = team
    ? game.players.map((p) => ({ name: p, you: p === me, color: colorOf(p), value: game.saved, max: game.totalRounds, stats: `Ronda ${game.round} de ${game.totalRounds}`, active: playing && game.turn === p }))
    : game.players.map((p) => ({
        name: p,
        you: p === me,
        color: colorOf(p),
        value: game.scores[p] ?? 0,
        max: game.totalRounds,
        stats: game.solved.includes(p) ? '¡La sacó!' : `${(game.boards[p] ?? []).length} de ${game.maxTries} intentos`,
        active: playing && !game.solved.includes(p),
      }))

  return (
    <StageLayout
      stageRef={stageRef}
      sky="linear-gradient(#E8F0EA, #C9DCCF)"
      stage={<Stage3D ref={stageRef} load={load} state={state} label="Tablero de Wordle en 3D" />}
      top={<Plates players={plates} />}
      bottom={
        game.phase === 'round_over' ? (
          <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
        ) : (
          <>
            {title && <Banner title={title} hint={hint} color={typerColor} />}
            <Flash flash={flash} />
            <Keyboard rows={myRows} canType={canType} onPress={press} />
          </>
        )
      }
      aside={
        <>
          {!team &&
            others.map((p) => (
              <Panel key={p} title={<span style={{ color: colorOf(p) }}>Tablero de {p}</span>}>
                <MiniBoard game={game} player={p} />
              </Panel>
            ))}
          <Panel title="Cómo se juega">
            <ul className="space-y-1 px-1 text-sm text-muted">
              <li><span className="font-bold" style={{ color: MARK_COLORS.correct }}>Verde</span>: la letra va ahí.</li>
              <li><span className="font-bold" style={{ color: MARK_COLORS.present }}>Amarillo</span>: está en la palabra, en otro lugar.</li>
              <li><span className="font-bold" style={{ color: MARK_COLORS.absent }}>Gris</span>: no está.</li>
              <li>{team ? 'Escriben por turnos una palabra cada uno.' : 'Gana quien la saque en menos intentos.'}</li>
            </ul>
          </Panel>
        </>
      }
    />
  )
}

function MiniBoard({ game, player }) {
  const rows = game.boards[player] ?? []
  const solved = game.solved.includes(player)
  return (
    <div className="px-1">
      <p className="mb-2 text-sm text-muted">{solved ? '¡La sacó!' : `${rows.length} de ${game.maxTries} intentos`}</p>
      <div className="flex flex-col gap-1" aria-label={`Tablero de ${player}`}>
        {Array.from({ length: game.maxTries }, (_, i) => (
          <div key={i} className="flex gap-1">
            {Array.from({ length: game.length }, (_, j) => {
              const mark = rows[i]?.marks[j]
              const letter = rows[i]?.word?.[j]
              return (
                <motion.span
                  key={`${j}-${mark ?? ''}`}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold uppercase text-white"
                  style={{ background: mark ? MARK_COLORS[mark] : 'var(--color-stone)' }}
                  initial={mark ? { rotateX: 90 } : false}
                  animate={{ rotateX: 0 }}
                  transition={{ duration: 0.3, delay: j * 0.08 }}
                >
                  {letter}
                </motion.span>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

function Keyboard({ rows, canType, onPress }) {
  const status = {}
  for (const row of rows) {
    row.word?.split('').forEach((ch, i) => {
      const mark = row.marks[i]
      if (!status[ch] || RANK[mark] > RANK[status[ch]]) status[ch] = mark
    })
  }
  const key = 'h-11 sm:h-12 rounded-xl font-display font-bold disabled:opacity-50'
  return (
    <div className="pointer-events-auto w-full max-w-xl space-y-1 rounded-2xl bg-paper/85 p-1.5 shadow-lg backdrop-blur sm:space-y-1.5" role="group" aria-label="Teclado">
      {ROWS.map((row, r) => (
        <div key={row} className="flex justify-center gap-1 sm:gap-1.5">
          {r === 2 && (
            <button onClick={() => onPress('enter')} disabled={!canType} className={`${key} flex-[1.6] bg-ink px-1 text-xs text-white sm:text-sm`}>
              ENVIAR
            </button>
          )}
          {row.split('').map((L) => {
            const l = L.toLowerCase()
            const mark = status[l]
            return (
              <button
                key={L}
                onClick={() => onPress(l)}
                disabled={!canType}
                className={`${key} min-w-0 flex-1 text-lg ${mark ? 'text-white' : 'bg-paper shadow-[0_2px_0_rgb(0_0_0/0.12)]'}`}
                // the key changes color once the row has finished flipping
                style={{ ...(mark ? { background: MARK_COLORS[mark] } : null), transition: 'background-color 250ms 650ms, color 250ms 650ms, scale 120ms' }}
              >
                {L}
              </button>
            )
          })}
          {r === 2 && (
            <button onClick={() => onPress('back')} disabled={!canType} aria-label="Borrar" className={`${key} flex-[1.6] bg-paper text-xl shadow-[0_2px_0_rgb(0_0_0/0.12)]`}>
              ⌫
            </button>
          )}
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
  let accent = 'var(--color-ink)'
  if (game.mode === 'team') {
    title = r.solved ? `¡La sacaron en ${r.tries}!` : 'Esta vez no salió'
    detail = r.solved ? (r.by === me ? 'La última la escribiste tú.' : `La última la escribió ${r.by}.`) : 'Se acabaron los intentos.'
    if (r.solved) accent = MARK_COLORS.correct
  } else if (r.winner) {
    title = r.winner === me ? '¡Ganaste esta ronda!' : `Ganó ${r.winner}`
    const tries = r.tries[r.winner]
    detail = `En ${tries} ${tries === 1 ? 'intento' : 'intentos'}.${r.solved.length > 1 ? ' Los dos la sacaron; cuenta quién usó menos intentos y, si empatan, quién llegó primero.' : ''}`
    accent = colorOf(r.winner)
  } else {
    title = 'Nadie la sacó'
    detail = 'Ronda sin punto.'
  }
  return (
    <div className="pop pointer-events-auto w-full max-w-xl rounded-[2rem] p-6 text-white shadow-xl" style={{ background: accent }}>
      <p className="text-sm font-semibold text-white/80">La palabra era</p>
      <p className="font-display text-4xl font-extrabold uppercase tracking-widest" aria-label={game.answer}>
        {game.answer.split('').map((ch, i) => (
          <motion.span key={i} className="inline-block" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.15 + i * 0.07 }}>
            {ch}
          </motion.span>
        ))}
      </p>
      <p className="mt-3 font-display text-2xl font-extrabold">{title}</p>
      <p className="text-white/85">{detail}</p>
      <button onClick={() => send({ type: 'next_round' })} className="mt-5 rounded-2xl bg-white px-5 py-3 font-semibold text-ink">
        {last ? 'Ver resultados' : 'Otra palabra'}
      </button>
    </div>
  )
}

function Final({ game, me, send, colorOf }) {
  const team = game.mode === 'team'
  const total = game.history.length
  const title = team ? (game.saved === total ? `¡Sacaron las ${total}!` : `Sacaron ${game.saved} de ${total}`) : winnerTitle(game.scores)
  return (
    <div className="mt-4">
      <h1 className="text-4xl font-extrabold">{title}</h1>
      {!team && (
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
            <span className="flex gap-1">
              {h.answer.split('').map((ch, i) => (
                <span
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-lg font-display font-extrabold uppercase text-white"
                  style={{ background: MARK_COLORS.correct }}
                >
                  {ch}
                </span>
              ))}
            </span>
            <span className="ml-auto text-sm text-muted">
              {team
                ? h.result.solved
                  ? `en ${h.result.tries} intentos`
                  : 'no salió'
                : h.result.winner
                  ? <>ganó <span style={{ color: colorOf(h.result.winner) }}>{h.result.winner}</span> en {h.result.tries[h.result.winner]}</>
                  : 'nadie la sacó'}
            </span>
          </motion.li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'wordle', ...game.options }} />
    </div>
  )
}
