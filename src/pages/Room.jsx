import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TurnBanner, spring, softSpring } from '../lib/motion'
import { useRoom } from '../hooks/useRoom'
import { Logo } from './Home'
import Credit from '../components/Credit'
import StopCard from '../components/StopCard'
import BoggleCard from '../components/BoggleCard'
import HangmanCard from '../components/HangmanCard'
import WordleCard from '../components/WordleCard'
import WordSearchCard from '../components/WordSearchCard'
import GuessWhoCard from '../components/GuessWhoCard'
import PinturilloCard from '../components/PinturilloCard'
import CharadesCard from '../components/CharadesCard'
import MurdokuCard from '../components/MurdokuCard'
import TriviaCard from '../components/TriviaCard'
import ChessCard from '../components/ChessCard'
import BattleshipCard from '../components/BattleshipCard'
import DominoCard from '../components/DominoCard'
import ParquesCard from '../components/ParquesCard'
import CrosswordsCard from '../components/CrosswordsCard'
import UnaLobbyCard from '../components/UnaLobbyCard'
import GolfCard from '../components/GolfCard'
import ColonosCard from '../components/ColonosCard'
import LobbyBoard from '../components/LobbyBoard'
import DeeperCard from '../components/DeeperCard'
import { PLAYER_COLORS } from '../lib/color'
import { storage } from '../lib/api'

// Each game is loaded only when it starts, so the first visit stays light
const ColorGame = lazy(() => import('../games/ColorGame'))
const StopGame = lazy(() => import('../games/StopGame'))
const TooLateGame = lazy(() => import('../games/TooLateGame'))
const BoggleGame = lazy(() => import('../games/BoggleGame'))
const HangmanGame = lazy(() => import('../games/HangmanGame'))
const WordleGame = lazy(() => import('../games/WordleGame'))
const WordSearchGame = lazy(() => import('../games/WordSearchGame'))
const GuessWhoGame = lazy(() => import('../games/GuessWhoGame'))
const PinturilloGame = lazy(() => import('../games/PinturilloGame'))
const CharadesGame = lazy(() => import('../games/CharadesGame'))
const MurdokuGame = lazy(() => import('../games/MurdokuGame'))
const TriviaGame = lazy(() => import('../games/TriviaGame'))
const ChessGame = lazy(() => import('../games/ChessGame'))
const BattleshipGame = lazy(() => import('../games/BattleshipGame'))
const DominoGame = lazy(() => import('../games/DominoGame'))
const ParquesGame = lazy(() => import('../games/ParquesGame'))
const CrosswordsGame = lazy(() => import('../games/CrosswordsGame'))
const UnaGame = lazy(() => import('../games/UnaGame'))
const GolfGame = lazy(() => import('../games/GolfGame'))
const ColonosGame = lazy(() => import('../games/ColonosGame'))
const DeeperGame = lazy(() => import('../games/DeeperGame'))

// Games that show server errors themselves, inside their own layout
const SHOWS_ERRORS = new Set(['parques', 'chess', 'domino', 'una', 'wordle', 'colonos', 'pinturillo', 'crosswords', 'golf', 'battleship', 'wordsearch', 'guesswho'])

const GAME_VIEWS = { color: ColorGame, stop: StopGame, toolate: TooLateGame, boggle: BoggleGame, hangman: HangmanGame, wordle: WordleGame, wordsearch: WordSearchGame, guesswho: GuessWhoGame, pinturillo: PinturilloGame, charades: CharadesGame, murdoku: MurdokuGame, trivia: TriviaGame, chess: ChessGame, battleship: BattleshipGame, domino: DominoGame, parques: ParquesGame, crosswords: CrosswordsGame, una: UnaGame, golf: GolfGame, colonos: ColonosGame, deeper: DeeperGame }
const UPCOMING = []
// Lobby: every game with its filter group and a one-line pitch shown while the card is folded
const LOBBY_GAMES = [
  { Card: DeeperCard, max: 2, kind: 'connect', tagline: 'Preguntas para conocerse y conectar de verdad.' },
  { Card: ColorCard, max: 6, kind: 'wits', tagline: 'Memoriza un color y recréalo.' },
  { Card: StopCard, max: 6, kind: 'words', tagline: 'Una letra, siete categorías y ¡Stop!' },
  { Card: BoggleCard, max: 6, kind: 'words', tagline: 'Une letras vecinas contra el reloj.' },
  { Card: HangmanCard, max: 6, kind: 'words', tagline: 'Adivinen la palabra antes de la horca.' },
  { Card: WordleCard, max: 6, kind: 'words', tagline: 'Cinco letras, en duelo o juntos.' },
  { Card: WordSearchCard, max: 6, kind: 'words', tagline: 'Encuentren las palabras escondidas.' },
  { Card: CrosswordsCard, max: 2, kind: 'words', tagline: 'Arma palabras en el tablero con premios.' },
  { Card: GuessWhoCard, max: 2, kind: 'wits', tagline: 'Pregunta, descarta y adivina quién es.' },
  { Card: MurdokuCard, max: 6, kind: 'wits', tagline: 'Sudoku con asesinato.' },
  { Card: TriviaCard, max: 6, kind: 'wits', tagline: 'Ruleta de preguntas y coronas.' },
  { Card: PinturilloCard, max: 6, kind: 'action', tagline: 'Uno dibuja y los demás adivinan.' },
  { Card: CharadesCard, max: 6, kind: 'action', tagline: 'Actúa sin hablar frente a la cámara.' },
  { Card: GolfCard, max: 4, kind: 'action', tagline: 'Nueve hoyos, un tiro a la vez.' },
  { Card: ChessCard, max: 2, kind: 'table', tagline: 'Una partida completa, con reloj opcional.' },
  { Card: BattleshipCard, max: 2, kind: 'table', tagline: 'Hundan la flota del otro.' },
  { Card: DominoCard, max: 2, kind: 'table', tagline: 'Doble seis para dos.' },
  { Card: ParquesCard, max: 4, kind: 'table', tagline: 'A la colombiana, con dos dados.' },
  { Card: UnaLobbyCard, max: 4, kind: 'table', tagline: 'Cartas, comodines y ¡Una!' },
  { Card: ColonosCard, max: 4, kind: 'table', tagline: 'Construyan en una isla al azar.' },
]
const FILTERS = [
  ['all', 'Todos'],
  ['words', 'Palabras'],
  ['table', 'Mesa y cartas'],
  ['wits', 'Ingenio'],
  ['action', 'Dibujo y acción'],
  ['connect', 'Para conectar'],
]

export default function Room({ code, name, onExit, onPlayingChange }) {
  const { room, status, error, errorId, fatal, send, subscribe } = useRoom(code, name)
  const gameName = room?.game?.name ?? null

  // Starting a game (or going back to the lobby) starts at the top of the page
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    onPlayingChange?.(gameName != null)
  }, [gameName, onPlayingChange])

  if (fatal) {
    return (
      <Centered>
        <h1 className="text-3xl font-bold">No pudiste entrar</h1>
        <p className="mt-2 text-muted">{fatal}</p>
        <button onClick={onExit} className="mt-6 rounded-2xl bg-ink px-5 py-3 font-semibold text-white">
          Volver al inicio
        </button>
      </Centered>
    )
  }

  if (!room) {
    return <Centered><p className="text-muted">Conectando a la sala {code}…</p></Centered>
  }

  const players = room.players
  // people keep their room color; players that only exist in the game (bots) come after them
  const gamePlayers = Array.isArray(room.game?.players) ? room.game.players : []
  const colorOf = (player) => {
    const i = players.findIndex((p) => p.name === player)
    if (i >= 0) return PLAYER_COLORS[i]
    const j = gamePlayers.filter((p) => !players.some((q) => q.name === p)).indexOf(player)
    return PLAYER_COLORS[j >= 0 ? Math.min(PLAYER_COLORS.length - 1, players.length + j) : 0]
  }
  const GameView = room.game ? GAME_VIEWS[room.game.name] : null

  return (
    <div className="relative z-10 flex min-h-dvh flex-col">
      <header className="relative z-10 mx-auto flex w-full max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <button onClick={onExit} aria-label="Salir de la sala"><Logo small /></button>
        <div className="flex items-center gap-2">
          <AnimatePresence initial={false}>
            {players.map((p, i) => (
              <motion.span
                key={p.name}
                layout
                initial={{ opacity: 0, scale: 0.5, x: 20 }}
                animate={{ opacity: p.online ? 1 : 0.45, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={spring}
                className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-white"
                style={{ background: PLAYER_COLORS[i] }}
                title={p.online ? 'Conectado' : 'Desconectado'}
              >
                {p.online && <span className="online-dot h-1.5 w-1.5 rounded-full bg-white" aria-hidden="true" />}
                {p.name}{p.name === name && ' (tú)'}
                {!p.online && <span className="font-normal">(sin conexión)</span>}
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence>
        {status === 'reconnecting' && (
          <motion.p
            role="status"
            className="overflow-hidden bg-ink text-center text-sm text-white"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
          >
            <span className="block py-2">Se perdió la conexión. Reconectando…</span>
          </motion.p>
        )}
      </AnimatePresence>
      {GameView && <TurnBanner game={room.game} me={name} color={colorOf(name)} />}

      <main className="relative z-10 mx-auto w-full max-w-[1600px] flex-1 px-4 pb-12 sm:px-6 lg:px-8">
        <AnimatePresence mode="wait" initial={false}>
        {GameView ? (
          <motion.div
            key={`game-${room.game.name}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.15 } }}
            transition={softSpring}
          >
            <Suspense fallback={<p className="mt-10 text-center text-muted">Cargando el juego…</p>}>
            <GameView
              room={room}
              me={name}
              send={send}
              colorOf={colorOf}
              error={error}
              errorId={errorId}
              subscribe={subscribe}
            />
            </Suspense>
            {room.game.phase !== 'finished' && (
              <button
                onClick={() => send({ type: 'back_to_lobby' })}
                className="mt-10 text-sm font-semibold text-muted underline underline-offset-2 hover:text-ink"
              >
                Salir de este juego
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.15 } }}
            transition={softSpring}
          >
            <Lobby room={room} send={send} />
          </motion.div>
        )}
        </AnimatePresence>
        {error && !(GameView && SHOWS_ERRORS.has(room.game.name)) && (
          <p key={errorId} role="alert" className="shake mt-4 text-center font-medium text-danger">{error}</p>
        )}
      </main>
    </div>
  )
}

function Lobby({ room, send }) {
  const [copied, setCopied] = useState(false)
  const [filter, setFilter] = useState(() => storage.get('cerquita:lobby:filter') || 'all')
  const count = room.players.length
  const alone = count < 2
  const items = useMemo(
    () =>
      LOBBY_GAMES.map(({ Card, kind, tagline, max }, i) => {
        const tooMany = count > max
        return {
          key: i,
          visible: filter === 'all' || kind === filter,
          render: (collapsed, toggle) => (
            <div className="lobby-card relative" data-collapsed={collapsed || undefined} style={{ '--tagline': JSON.stringify(tagline) }}>
              <span
                className="absolute left-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-ink shadow-sm"
                title={max > 2 ? `De 2 a ${max} jugadores` : 'Para 2 jugadores'}
              >
                👥 {max > 2 ? `2–${max}` : '2'}
              </span>
              <button onClick={toggle} className="lobby-toggle absolute right-3 top-3 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-ink shadow-sm hover:bg-white" aria-expanded={!collapsed}>
                {collapsed ? 'Opciones' : 'Menos'}
              </button>
              <div className={tooMany ? 'pointer-events-none opacity-45 grayscale' : undefined} aria-disabled={tooMany || undefined}>
                <Card send={send} alone={alone} count={count} />
              </div>
              {tooMany && (
                <p className="absolute inset-x-3 bottom-3 z-10 rounded-2xl bg-ink px-3 py-2 text-center text-sm font-semibold text-white">
                  Es para máximo {max} jugadores y en la sala hay {count}
                </p>
              )}
            </div>
          ),
        }
      }),
    [filter, alone, send, count],
  )
  useEffect(() => storage.set('cerquita:lobby:filter', filter), [filter])
  const link = `${window.location.origin}${window.location.pathname}?sala=${room.code}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="mt-2">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-paper/90 px-6 py-5 backdrop-blur sm:px-8">
        <div>
          <h1 className="text-3xl font-bold">{alone ? 'Esperando a tu pareja' : count === 2 ? 'Ya están los dos' : `Ya están ${count}`}</h1>
          <p className="mt-1 text-muted">
            {alone
              ? 'Envíale el código o el enlace. Apenas entre, aparecerá arriba.'
              : count === 2
                ? 'Elijan un juego; cualquiera de los dos puede empezarlo. Pueden entrar hasta 6 con el mismo enlace.'
                : 'Elijan un juego para todos; cualquiera puede empezarlo. Cada juego dice para cuántos es.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-4xl font-extrabold tracking-[0.18em]">{room.code}</span>
          <button onClick={copy} className="rounded-2xl border border-line px-4 py-2.5 font-semibold hover:border-ink">
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-bold">Juegos</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar juegos">
          {FILTERS.map(([key, label]) => {
            const count = key === 'all' ? LOBBY_GAMES.length : LOBBY_GAMES.filter((g) => g.kind === key).length
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${filter === key ? 'bg-ink text-white' : 'bg-paper text-muted hover:text-ink'}`}
              >
                {label} <span className="opacity-60">{count}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-4">
        <LobbyBoard items={items} />
      </div>

      <Credit className="mt-10 text-center" />

      {UPCOMING.length > 0 && (
        <p className="mt-6 rounded-3xl border border-dashed border-line px-6 py-4 text-muted">
          <span className="font-semibold text-ink">En camino:</span> {UPCOMING.join(' · ')}
        </p>
      )}
    </div>
  )
}

const COLOR_LEVELS = [
  ['normal', 'Normal', '5 s para mirar y 30 s para responder.'],
  ['hard', 'Difícil', '3 s para mirar, 20 s para responder, colores más apagados y puntaje más exigente.'],
  ['expert', 'Experto', '2 s para mirar, 15 s para responder, un color que te confunde y barras sin pistas.'],
]

function ColorCard({ send, alone }) {
  const [rounds, setRounds] = useState(5)
  const [level, setLevel] = useState(() => storage.get('cerquita:color:level') || 'normal')
  const current = COLOR_LEVELS.find(([key]) => key === level) ?? COLOR_LEVELS[0]

  function chooseLevel(key) {
    setLevel(key)
    storage.set('cerquita:color:level', key)
  }

  return (
    <article className="flex flex-col overflow-hidden rounded-3xl bg-paper">
      <div className="grid h-28 grid-cols-3" aria-hidden="true">
        <div style={{ background: 'hsl(14 78% 58%)' }} />
        <div style={{ background: 'hsl(46 85% 62%)' }} />
        <div style={{ background: 'hsl(190 60% 45%)' }} />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <h3 className="text-2xl font-bold">Color de memoria</h3>
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-stone p-1" role="group" aria-label="Nivel">
          {COLOR_LEVELS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => chooseLevel(key)}
              aria-pressed={level === key}
              className={`rounded-xl px-2 py-2 font-semibold ${level === key ? 'bg-paper shadow-sm' : 'text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-muted">
          Verán un color unos segundos. Después, cada uno lo recrea de memoria. Gana quien quede más cerca.
        </p>
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold text-ink">{current[1]}:</span> {current[2]}
        </p>
        <div className="mt-auto pt-6">
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              Rondas
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                className="rounded-xl border border-line bg-stone px-3 py-2"
              >
                {[3, 5, 7, 10].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <button
              onClick={() => send({ type: 'start_game', game: 'color', rounds, level: current[0] })}
              className="w-full rounded-2xl bg-ink px-5 py-3 font-semibold text-white"
            >
              {alone ? 'Practicar mientras llega' : 'Jugar'}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function Centered({ children }) {
  return <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-5 text-center">{children}</main>
}
