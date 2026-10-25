import { useEffect, useRef, useState } from 'react'
import { EndActions, winnerTitle } from '../components/EndActions'

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
WordleGame.showsErrors = true // los errores se muestran junto al tablero

function Play({ game, me, send, colorOf, error, errorId }) {
  const team = game.mode === 'team'
  const myRows = team ? game.teamRows : game.boards[me] ?? []
  const playing = game.phase === 'playing'
  const isPlayer = game.players.includes(me)
  const myTurn = team ? game.turn === me : true
  const done = !team && (game.solved.includes(me) || myRows.length >= game.maxTries)
  const canType = playing && isPlayer && myTurn && !done

  const [draft, setDraft] = useState('')
  const [flash, setFlash] = useState(null)
  const [shake, setShake] = useState(0)
  const rowsSeen = useRef(myRows.length)
  const errorsSeen = useRef(errorId)

  // Cuando el servidor acepta la palabra, se limpia lo escrito
  useEffect(() => {
    if (myRows.length !== rowsSeen.current) {
      rowsSeen.current = myRows.length
      setDraft('')
    }
  }, [myRows.length])

  // Palabra rechazada: la fila tiembla y aparece el motivo
  useEffect(() => {
    if (errorId === errorsSeen.current) return
    errorsSeen.current = errorId
    if (!error) return
    setShake((n) => n + 1)
    setFlash(error)
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
        setFlash(`La palabra tiene ${game.length} letras`)
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

  return (
    <div className="mt-4">
      <Header game={game} colorOf={colorOf} />

      <div className={`mt-4 grid gap-6 ${!team && others.length ? 'md:grid-cols-[1fr_auto]' : ''}`}>
        <div className="flex flex-col items-center">
          <Status game={game} me={me} done={done} colorOf={colorOf} />
          <Grid
            game={game}
            rows={myRows}
            draft={playing && (canType || team) ? shownDraft : null}
            shakeKey={shake}
            typerColor={typerColor}
            colorOf={colorOf}
          />
          <p className="mt-3 h-6 text-center font-medium text-danger" role="alert">{flash}</p>
          {game.phase === 'round_over' ? (
            <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
          ) : (
            <Keyboard rows={myRows} canType={canType} onPress={press} />
          )}
        </div>

        {!team && others.length > 0 && (
          <aside className="flex justify-center gap-6 md:flex-col md:justify-start">
            {others.map((p) => (
              <MiniBoard key={p} game={game} player={p} colorOf={colorOf} />
            ))}
          </aside>
        )}
      </div>
    </div>
  )
}

function Header({ game, colorOf }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-muted">
      <span>Ronda {game.round} de {game.totalRounds}</span>
      {game.mode === 'duel' ? (
        <div className="flex gap-2">
          {Object.entries(game.scores).map(([p, n]) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">
              <span style={{ color: colorOf(p) }}>{p}</span> <span className="text-ink tabular-nums">{n}</span>
            </span>
          ))}
        </div>
      ) : (
        game.round > 1 && (
          <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink">
            Sacaron {game.saved} de {game.round - (game.phase === 'round_over' ? 0 : 1)}
          </span>
        )
      )}
    </div>
  )
}

function Status({ game, me, done, colorOf }) {
  if (game.phase !== 'playing') return <div className="h-7" />
  let text
  if (game.mode === 'team') {
    text =
      game.turn === me ? (
        <span>Te toca escribir</span>
      ) : (
        <span>
          Escribe <span style={{ color: colorOf(game.turn) }}>{game.turn}</span>. Ayúdale por la videollamada.
        </span>
      )
  } else if (done) {
    text = game.solved.includes(me) ? '¡La sacaste! Espera a tu pareja…' : 'Se acabaron tus intentos. Espera a tu pareja…'
  } else {
    text = `Adivina la palabra de ${game.length} letras`
  }
  return <p className="h-7 text-center font-semibold">{text}</p>
}

function tileSize(length) {
  return length >= 6 ? 'h-12 w-12 text-2xl sm:h-14 sm:w-14' : length === 5 ? 'h-14 w-14 text-3xl sm:h-16 sm:w-16' : 'h-16 w-16 text-3xl sm:h-[4.5rem] sm:w-[4.5rem]'
}

function Grid({ game, rows, draft, shakeKey, typerColor, colorOf }) {
  const size = tileSize(game.length)
  const lines = []
  for (let i = 0; i < game.maxTries; i++) {
    const row = rows[i]
    if (row) {
      lines.push(
        <div key={`r${i}-done`} className="flex gap-1.5">
          {row.marks.map((mark, j) => (
            <div
              key={j}
              className={`flip flex items-center justify-center rounded-xl border-2 font-display font-extrabold uppercase ${size}`}
              style={{ '--from': 'var(--color-paper)', '--to': MARK_COLORS[mark], animationDelay: `${j * 110}ms` }}
            >
              {row.word?.[j]}
            </div>
          ))}
          {game.mode === 'team' && (
            <span className="ml-1 h-2.5 w-2.5 self-center rounded-full" style={{ background: colorOf(row.player) }} title={row.player} />
          )}
        </div>,
      )
    } else if (i === rows.length && draft != null) {
      lines.push(
        <div key={`r${i}-draft-${shakeKey}`} className={`flex gap-1.5 ${shakeKey ? 'shake' : ''}`}>
          {Array.from({ length: game.length }, (_, j) => {
            const ch = draft[j]
            return (
              <div
                key={j}
                className={`flex items-center justify-center rounded-xl border-2 bg-paper font-display font-extrabold uppercase ${size} ${ch ? 'pop' : ''}`}
                style={{ borderColor: ch ? typerColor : 'var(--color-line)' }}
              >
                {ch}
              </div>
            )
          })}
          {game.mode === 'team' && <span className="ml-1 h-2.5 w-2.5 self-center rounded-full" style={{ background: typerColor }} />}
        </div>,
      )
    } else {
      lines.push(
        <div key={`r${i}-empty`} className="flex gap-1.5">
          {Array.from({ length: game.length }, (_, j) => (
            <div key={j} className={`rounded-xl border-2 border-line/70 bg-paper/50 ${size}`} />
          ))}
          {game.mode === 'team' && <span className="ml-1 h-2.5 w-2.5" />}
        </div>,
      )
    }
  }
  return (
    <div className="mt-3 flex flex-col gap-1.5" role="grid" aria-label="Tablero">
      {lines}
    </div>
  )
}

function MiniBoard({ game, player, colorOf }) {
  const rows = game.boards[player] ?? []
  const solved = game.solved.includes(player)
  return (
    <div className="rounded-2xl bg-paper p-4">
      <p className="mb-2 text-sm font-semibold" style={{ color: colorOf(player) }}>
        {player}
        <span className="font-normal text-muted"> · {solved ? '¡la sacó!' : `${rows.length} de ${game.maxTries}`}</span>
      </p>
      <div className="flex flex-col gap-1" aria-label={`Tablero de ${player}`}>
        {Array.from({ length: game.maxTries }, (_, i) => (
          <div key={i} className="flex gap-1">
            {Array.from({ length: game.length }, (_, j) => {
              const mark = rows[i]?.marks[j]
              const letter = rows[i]?.word?.[j]
              return (
                <span
                  key={j}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold uppercase text-white"
                  style={{ background: mark ? MARK_COLORS[mark] : 'var(--color-stone)' }}
                >
                  {letter}
                </span>
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
  const key = 'h-12 sm:h-14 rounded-xl font-display font-bold disabled:opacity-50'
  return (
    <div className="mt-2 w-full max-w-xl space-y-1.5" role="group" aria-label="Teclado">
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
                style={mark ? { background: MARK_COLORS[mark] } : undefined}
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
    <div className="pop mt-2 w-full max-w-xl rounded-[2rem] p-6 text-white" style={{ background: accent }}>
      <p className="text-sm font-semibold text-white/80">La palabra era</p>
      <p className="font-display text-4xl font-extrabold uppercase tracking-widest">{game.answer}</p>
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
              <p className="font-display text-4xl font-extrabold tabular-nums">{n}</p>
            </div>
          ))}
        </div>
      )}
      <ol className="mt-6 space-y-2" aria-label="Resumen de rondas">
        {game.history.map((h) => (
          <li key={h.round} className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-paper px-4 py-3">
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
          </li>
        ))}
      </ol>
      <EndActions send={send} replay={{ type: 'start_game', game: 'wordle', ...game.options }} />
    </div>
  )
}
