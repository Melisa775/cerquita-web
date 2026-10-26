import { useEffect, useState } from 'react'
import PlayingCard, { CARD_COLORS } from '../components/PlayingCard'
import { EndActions } from '../components/EndActions'

const TABLE = 'hsl(222 28% 26%)'

function cardName(c) {
  if (c.color === null) return c.value === 'wild4' ? 'un +4' : 'un comodín'
  const v = { skip: 'Salta', reverse: 'Reversa', draw2: '+2' }[c.value] ?? c.value
  return `${v} ${CARD_COLORS[c.color].name.toLowerCase()}`
}

export default function UnaGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  const other = game.players.find((p) => p !== me)
  const myTurn = game.phase === 'playing' && game.turn === me
  const [wildFor, setWildFor] = useState(null)
  const [flash, setFlash] = useState(null)

  useEffect(() => {
    if (error) setFlash(error)
  }, [errorId, error])
  useEffect(() => {
    if (!flash) return
    const id = setTimeout(() => setFlash(null), 2500)
    return () => clearTimeout(id)
  }, [flash])

  const playable = new Set(game.playable)
  const canSayUna =
    game.phase === 'playing' &&
    !game.saidUna[me] &&
    ((myTurn && game.hand.length === 2 && game.playable.length > 0) || (game.catchable === me && game.hand.length === 1))
  const canCatch = game.phase === 'playing' && game.catchable === other

  function playCard(c) {
    if (!playable.has(c.id)) return
    if (c.color === null) setWildFor(c)
    else send({ type: 'un_play', card: c.id })
  }

  return (
    <div className="mt-4">
      <Scoreboard game={game} me={me} colorOf={colorOf} />

      {/* mano de la pareja */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-semibold" style={{ color: colorOf(other) }}>
          {other} <span className="text-sm font-normal text-muted">· {game.counts[other]} {game.counts[other] === 1 ? 'carta' : 'cartas'}</span>
        </span>
        {game.counts[other] === 1 && game.saidUna[other] && <span className="rounded-full bg-ink px-3 py-1 text-sm font-bold text-white">¡Una!</span>}
      </div>
      <div className="mt-2 flex justify-center">
        {Array.from({ length: Math.min(game.counts[other], 20) }, (_, i) => (
          <PlayingCard key={i} faceDown width={38} className="-ml-5 first:ml-0" />
        ))}
      </div>

      {/* mesa */}
      <Table game={game} me={me} myTurn={myTurn} send={send} colorOf={colorOf} />

      {/* botones */}
      {game.phase === 'playing' && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {canSayUna && (
            <button onClick={() => send({ type: 'un_una' })} className="pop rounded-2xl px-6 py-3 font-display text-xl font-extrabold text-white" style={{ background: CARD_COLORS.r.fill }}>
              ¡Una!
            </button>
          )}
          {canCatch && (
            <button onClick={() => send({ type: 'un_catch' })} className="pop rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
              ¡{other} no dijo Una! (+2)
            </button>
          )}
          {myTurn && game.drawn != null && (
            <button onClick={() => send({ type: 'un_pass' })} className="rounded-2xl border border-line px-5 py-3 font-semibold hover:border-ink">
              Pasar
            </button>
          )}
        </div>
      )}

      {game.phase === 'playing' ? (
        <section className="mt-3 rounded-[2rem] bg-paper px-3 pb-4 pt-6 sm:px-5">
          <div className="flex flex-wrap justify-center gap-y-3">
            {game.hand.map((c) => {
              const ok = myTurn && playable.has(c.id)
              const isDrawn = game.drawn === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => playCard(c)}
                  disabled={!ok}
                  className={`-ml-4 rounded-xl transition-transform first:ml-0 sm:-ml-3 ${ok ? '-translate-y-3 hover:-translate-y-5' : ''} ${isDrawn ? 'pop' : ''}`}
                  style={{ zIndex: ok ? 2 : 1 }}
                >
                  <PlayingCard card={c} width={68} style={{ opacity: myTurn && !ok ? 0.55 : 1 }} />
                </button>
              )
            })}
          </div>
          {myTurn && game.drawn != null && <p className="mt-3 text-center text-sm text-muted">La carta que robaste sirve: juégala o pasa.</p>}
        </section>
      ) : (
        <RoundOver game={game} me={me} send={send} colorOf={colorOf} />
      )}

      <p role="status" className="mt-2 min-h-6 text-center text-sm font-medium text-danger">{flash}</p>

      {wildFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => setWildFor(null)}>
          <div className="pop rounded-3xl bg-paper p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-xl font-bold">¿Qué color pides?</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Object.entries(CARD_COLORS).map(([k, c]) => (
                <button
                  key={k}
                  onClick={() => {
                    send({ type: 'un_play', card: wildFor.id, color: k })
                    setWildFor(null)
                  }}
                  className="h-20 w-28 rounded-2xl font-semibold text-white shadow-sm hover:brightness-110"
                  style={{ background: c.fill }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
UnaGame.showsErrors = true

function Scoreboard({ game, me, colorOf }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <span>{game.options.goal ? `Mano ${game.round} · a ${game.options.goal} puntos` : 'Una mano'}{game.options.stacking && ' · se acumulan +2 y +4'}</span>
      {game.options.goal > 0 && (
        <div className="flex gap-2">
          {game.players.map((p) => (
            <span key={p} className="rounded-full bg-paper px-3 py-1 font-semibold">
              <span style={{ color: colorOf(p) }}>{p}{p === me && ' (tú)'}</span> <span className="text-ink tabular-nums">{game.scores[p]}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function describe(l, me) {
  const you = l.player === me
  switch (l.action) {
    case 'play':
      return `${you ? 'Jugaste' : `${l.player} jugó`} ${cardName(l.card)}${l.card.color === null ? ` y pidió ${CARD_COLORS[l.color].name.toLowerCase()}` : ''}`
    case 'drew':
      return l.forced ? `${you ? 'Robaste' : `${l.player} robó`} ${l.count} ${l.count === 1 ? 'carta' : 'cartas'} de castigo` : `${you ? 'Robaste' : `${l.player} robó`} una carta`
    case 'pass':
      return `${you ? 'Pasaste' : `${l.player} pasó`}`
    case 'una':
      return `${you ? 'Dijiste' : `${l.player} dijo`} ¡Una!`
    case 'catch':
      return `${you ? '¡Pillaste' : `¡${l.player} pilló`} a ${l.target === me ? 'ti' : l.target} sin decir Una! Roba ${l.count}`
    default:
      return ''
  }
}

function Table({ game, me, myTurn, send, colorOf }) {
  const canDraw = myTurn && game.drawn == null
  const last = game.log[game.log.length - 1]
  let title
  if (game.phase !== 'playing') title = null
  else if (myTurn) title = game.pending ? `¡Te tiraron +${game.pending}! Responde o roba` : game.drawn != null ? 'Juega la que robaste o pasa' : 'Te toca'
  else title = `Juega ${game.turn}…`
  return (
    <div className="mt-3 rounded-[2rem] p-5 sm:p-6" style={{ background: TABLE, boxShadow: 'inset 0 2px 14px rgba(0,0,0,.35)' }}>
      <div className="flex items-center justify-center gap-6 sm:gap-10">
        <button
          onClick={() => canDraw && send({ type: 'un_draw' })}
          disabled={!canDraw}
          className={`relative rounded-xl ${canDraw ? 'transition-transform hover:-translate-y-1' : ''}`}
          aria-label={game.pending && myTurn ? `Robar ${game.pending}` : 'Robar una carta'}
        >
          <PlayingCard faceDown width={82} className="absolute left-1.5 top-1.5 opacity-60" />
          <PlayingCard faceDown width={82} className="relative" />
          <span className="absolute -bottom-6 left-0 right-0 text-center text-xs font-semibold text-white/70">
            {canDraw ? (game.pending ? `Robar ${game.pending}` : 'Robar') : `${game.pile} en el mazo`}
          </span>
        </button>
        <div className="relative">
          {game.top && (
            <PlayingCard key={game.top.id} card={game.top} width={96} className="pop" chosen={game.top.color === null ? game.color : null} style={{ transform: `rotate(${(game.top.id % 9) - 4}deg)` }} />
          )}
        </div>
        <div className="flex flex-col items-center gap-1 text-white/80">
          <span className="h-10 w-10 rounded-full" style={{ background: CARD_COLORS[game.color]?.fill, boxShadow: '0 0 0 3px rgba(255,255,255,.8)' }} />
          <span className="text-xs font-semibold">{CARD_COLORS[game.color]?.name}</span>
          {game.pending > 0 && <span className="mt-1 rounded-full bg-white px-2.5 py-0.5 text-sm font-extrabold text-ink">+{game.pending}</span>}
        </div>
      </div>
      {title && (
        <p className="mt-8 text-center font-display text-2xl font-extrabold" style={{ color: myTurn ? 'white' : 'rgba(255,255,255,.85)' }}>
          {title}
        </p>
      )}
      {last && (
        <p key={game.log.length} className={`pop text-center text-sm text-white/75 ${title ? 'mt-1' : 'mt-8'}`}>
          <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: colorOf(last.player) }} />
          {describe(last, me)}
        </p>
      )}
    </div>
  )
}

function RoundOver({ game, me, send, colorOf }) {
  const r = game.result
  const finished = game.phase === 'finished'
  const loser = game.players.find((p) => p !== r.winner)
  return (
    <section className="pop mt-3 rounded-[2rem] bg-paper p-5 sm:p-6">
      <p className="font-display text-3xl font-extrabold" style={{ color: colorOf(r.winner) }}>
        {finished && game.options.goal ? (game.winner === me ? '¡Ganaste la partida!' : `${game.winner} ganó la partida`) : r.winner === me ? '¡Te quedaste sin cartas!' : `¡${r.winner} se quedó sin cartas!`}
      </p>
      <p className="mt-1 text-muted">
        {r.winner === me ? 'Sumas' : 'Suma'} {r.points} puntos por las cartas que le quedaron a {loser === me ? 'ti' : loser}.
      </p>
      <div className="mt-4 flex flex-wrap gap-1">
        {(game.hands?.[loser] ?? []).map((c) => (
          <PlayingCard key={c.id} card={c} width={46} />
        ))}
      </div>
      {finished ? (
        <EndActions send={send} replay={{ type: 'start_game', game: 'una', ...game.options }} />
      ) : (
        <button onClick={() => send({ type: 'next_round' })} autoFocus className="mt-5 rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
          Siguiente mano
        </button>
      )}
    </section>
  )
}
