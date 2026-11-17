import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TurnBanner, spring, softSpring } from '../lib/motion'
import { useRoom } from '../hooks/useRoom'
import { Logo } from './Home'
import Credit from '../components/Credit'
import ColorGame from '../games/ColorGame'
import StopGame from '../games/StopGame'
import TooLateGame from '../games/TooLateGame'
import BoggleGame from '../games/BoggleGame'
import HangmanGame from '../games/HangmanGame'
import WordleGame from '../games/WordleGame'
import WordSearchGame from '../games/WordSearchGame'
import GuessWhoGame from '../games/GuessWhoGame'
import PinturilloGame from '../games/PinturilloGame'
import CharadesGame from '../games/CharadesGame'
import MurdokuGame from '../games/MurdokuGame'
import TriviaGame from '../games/TriviaGame'
import ChessGame from '../games/ChessGame'
import BattleshipGame from '../games/BattleshipGame'
import DominoGame from '../games/DominoGame'
import ParquesGame from '../games/ParquesGame'
import CrosswordsGame from '../games/CrosswordsGame'
import UnaGame from '../games/UnaGame'
import GolfGame from '../games/GolfGame'
import ColonosGame from '../games/ColonosGame'
import DeeperGame from '../games/DeeperGame'
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
import DeeperCard from '../components/DeeperCard'
import { PLAYER_COLORS } from '../lib/color'
import { storage } from '../lib/api'

const GAME_VIEWS = { color: ColorGame, stop: StopGame, toolate: TooLateGame, boggle: BoggleGame, hangman: HangmanGame, wordle: WordleGame, wordsearch: WordSearchGame, guesswho: GuessWhoGame, pinturillo: PinturilloGame, charades: CharadesGame, murdoku: MurdokuGame, trivia: TriviaGame, chess: ChessGame, battleship: BattleshipGame, domino: DominoGame, parques: ParquesGame, crosswords: CrosswordsGame, una: UnaGame, golf: GolfGame, colonos: ColonosGame, deeper: DeeperGame }
const UPCOMING = []
const LOBBY_CARDS = [ColorCard, StopCard, BoggleCard, HangmanCard, WordleCard, WordSearchCard, GuessWhoCard, PinturilloCard, CharadesCard, MurdokuCard, TriviaCard, ChessCard, BattleshipCard, DominoCard, ParquesCard, CrosswordsCard, UnaLobbyCard, GolfCard, ColonosCard, DeeperCard]

export default function Room({ code, name, onExit }) {
  const { room, status, error, errorId, fatal, send, subscribe } = useRoom(code, name)

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
  const colorOf = (player) => PLAYER_COLORS[Math.max(0, players.findIndex((p) => p.name === player))]
  const GameView = room.game ? GAME_VIEWS[room.game.name] : null

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
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

      <main className="mx-auto w-full max-w-4xl flex-1 px-5 pb-12">
        <AnimatePresence mode="wait" initial={false}>
        {GameView ? (
          <motion.div
            key={`game-${room.game.name}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16, transition: { duration: 0.15 } }}
            transition={softSpring}
          >
            <GameView
              room={room}
              me={name}
              send={send}
              colorOf={colorOf}
              error={error}
              errorId={errorId}
              subscribe={subscribe}
            />
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
        {error && !GameView?.showsErrors && (
          <p key={errorId} role="alert" className="shake mt-4 text-center font-medium text-danger">{error}</p>
        )}
      </main>
    </div>
  )
}

function Lobby({ room, send }) {
  const [copied, setCopied] = useState(false)
  const alone = room.players.length < 2
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
    <div className="mt-6">
      <section className="rounded-3xl bg-paper p-6 sm:p-8">
        {alone ? (
          <>
            <h1 className="text-3xl font-bold">Esperando a tu pareja</h1>
            <p className="mt-2 text-muted">Envíale el código o el enlace. Apenas entre, aparecerá arriba.</p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold">Ya están los dos</h1>
            <p className="mt-2 text-muted">Elijan un juego; cualquiera de los dos puede empezarlo.</p>
          </>
        )}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <span className="font-display text-4xl font-extrabold tracking-[0.18em]">{room.code}</span>
          <button onClick={copy} className="rounded-2xl border border-line px-4 py-2.5 font-semibold hover:border-ink">
            {copied ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        </div>
      </section>

      <h2 className="mt-10 text-2xl font-bold">Juegos</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {LOBBY_CARDS.map((Card, i) => (
          <motion.div
            key={i}
            className="lobby-card"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '0px 0px -40px 0px' }}
            whileHover={{ y: -5 }}
            transition={{ ...softSpring, delay: (i % 2) * 0.07 }}
          >
            <Card send={send} alone={alone} />
          </motion.div>
        ))}
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
