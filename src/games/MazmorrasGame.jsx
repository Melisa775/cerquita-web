/**
 * Mazmorras: a cooperative d20 dungeon crawl on the 3D stage.
 *
 * The dungeon fills the stage; on top float the party, the last roll, what
 * to do now and the actions. The side panel holds the chronicle (the story
 * so far), your hero's sheet, the party's supplies and, for a person who is
 * the Dungeon Master, their tools. The rulebook opens from a button at any
 * moment. Every log line carries a sound name, so the story is also heard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import Stage3D from '../components/stage/Stage3D'
import { Banner, Flash, Panel, Plates, StageLayout, useFlash, useViewKeys } from '../components/stage/hud'
import { EndActions } from '../components/EndActions'
import { cssColor } from '../lib/three/kit'
import { play } from '../lib/sound'
import { spring } from '../lib/motion'
import { ABILITIES, CLASSES, FEATURE_EMOJI, ITEMS, MONSTERS, POWERS, RULEBOOK } from '../lib/mazmorras'

const load = () => import('../lib/three/mazmorras3d.js')
const SKY = 'radial-gradient(ellipse at 50% 30%, #2A2333 0%, #141119 70%)'
const LOG_STYLE = {
  narr: 'italic text-ink',
  room: 'font-semibold text-ink',
  dm: 'italic text-[hsl(268_45%_42%)]',
  good: 'text-[hsl(145_45%_32%)]',
  heal: 'text-[hsl(145_45%_32%)]',
  level: 'font-bold text-[hsl(40_80%_38%)]',
  bad: 'text-danger',
  hurt: 'text-danger',
  down: 'font-semibold text-danger',
  kill: 'font-semibold',
  fight: 'font-bold',
  end: 'font-bold text-ink',
}

const sign = (n) => (n >= 0 ? `+${n}` : `−${-n}`)

export default function MazmorrasGame({ room, me, send, colorOf, error, errorId }) {
  const game = room.game
  if (import.meta.env.DEV) window.__mazmorrasGame = game // lets the browser tests read the game
  const finished = game.phase === 'finished'
  const isDm = game.isDm
  const myHero = game.heroes.find((h) => h.name === me && h.cls)
  const monsters = game.monsters.filter((m) => m.hp > 0)
  const turnHero = game.heroes.find((h) => h.name === game.turn)
  const turnMonster = game.monsters.find((m) => m.id === game.turn)
  const myTurn = game.phase === 'combat' && game.turn === me && myHero && !myHero.down
  const myCheck = game.pendingCheck?.hero === me
  const room_ = game.rooms.find((r) => r.id === game.room)
  const feature = room_?.feature && !room_.feature.done ? room_.feature : null
  const canExplore = game.phase === 'explore' && (myHero ? !myHero.down : isDm)
  const [aim, setAim] = useState(null) // { kind: 'attack' | 'power' | 'potion', power?, target: 'monster' | 'hero' }
  const [book, setBook] = useState(false)
  const flash = useFlash(error, errorId)
  const stageRef = useRef(null)
  useViewKeys(stageRef)

  // aiming only makes sense on your own turn (or exploring, for potions)
  useEffect(() => {
    if (!aim) return
    if (aim.kind === 'potion' ? !(myTurn || canExplore) : !myTurn) setAim(null)
  }, [aim, myTurn, canExplore])

  useStorySounds(game)

  const act = useCallback(
    (a, target) => {
      setAim(null)
      if (a.kind === 'attack') send({ type: 'mz_attack', target })
      else if (a.kind === 'power') send({ type: 'mz_power', power: a.power, target })
      else if (a.kind === 'potion') send({ type: 'mz_potion', target })
    },
    [send],
  )

  const onPick = useCallback(
    (data) => {
      if (data.kind === 'exit') return send({ type: 'mz_move', room: data.id })
      if (data.kind === 'feature') return send({ type: 'mz_feature' })
      if (aim && (data.kind === 'monster' || data.kind === 'hero')) act(aim, data.id)
    },
    [aim, act, send],
  )

  const colors = useMemo(() => Object.fromEntries(game.heroes.map((h) => [h.name, cssColor(colorOf(h.name))])), [game.heroes, colorOf])
  const state = useMemo(
    () => ({
      game,
      me,
      colors,
      canMove: canExplore,
      canFeature: canExplore && !!feature && !!myHero,
      targeting: aim?.target ?? null,
    }),
    [game, me, colors, canExplore, feature, myHero, aim],
  )

  /* -- what now --------------------------------------------------------- */
  let title
  let hint = null
  let color = myHero ? colorOf(me) : undefined
  if (finished) {
    title = game.result === 'victory' ? '¡Victoria!' : 'Derrota…'
    hint = game.result === 'victory' ? 'La aventura terminó. ¡Bien jugado!' : 'Todos los héroes cayeron. Pueden intentarlo otra vez.'
  } else if (game.phase === 'creating') {
    title = isDm ? 'Los héroes se preparan…' : myHero ? 'Esperando a los demás…' : 'Elige tu héroe'
    hint = isDm ? 'Tú eres el Dungeon Master. Cuando todos elijan, empieza la aventura.' : 'Cada clase juega distinto. Puedes leer el libro de reglas mientras tanto.'
  } else if (game.pendingCheck) {
    const c = game.pendingCheck
    title = myCheck ? `Tira ${ABILITIES[c.ability]}` : `${c.hero} hace una prueba`
    hint = `${c.reason || 'El DM pide una tirada'} · CD ${c.dc}`
  } else if (game.phase === 'combat') {
    if (myTurn) {
      title = aim ? (aim.target === 'monster' ? '¿A quién?' : '¿A quién ayudas?') : '¡Tu turno!'
      hint = aim ? 'Toca un objetivo en el tablero o elígelo abajo.' : 'Elige una acción.'
    } else if (turnMonster) {
      title = `Turno de ${turnMonster.name}`
      hint = isDm ? 'Tú decides a quién ataca.' : game.dm === 'auto' ? null : `${game.dm} decide qué hace.`
      color = '#E5484D'
    } else if (turnHero) {
      title = `Turno de ${turnHero.name}`
      color = colorOf(turnHero.name)
    }
  } else if (game.phase === 'explore') {
    title = room_?.name ?? 'Explorando'
    hint = feature ? `Toquen una puerta brillante para avanzar, o el ${FEATURE_EMOJI[feature.kind] ?? '✨'} para intentar algo.` : 'Toquen una puerta brillante para avanzar.'
  }

  /* -- party plates -------------------------------------------------------- */
  const plates = game.heroes.map((h) => ({
    name: h.name,
    you: h.name === me,
    color: colorOf(h.name),
    value: h.cls ? h.hp : '…',
    max: h.cls ? h.maxHp : 1,
    stats: h.cls ? `${CLASSES[h.cls].emoji} ${CLASSES[h.cls].label} · Nv ${h.level} · CA ${h.ac}` : 'Eligiendo…',
    badges: [h.bot && 'bot', h.down && 'caído', h.defending && '🛡️'].filter(Boolean),
    active: game.turn === h.name,
  }))

  return (
    <>
      <StageLayout
        stageRef={stageRef}
        sky={SKY}
        stage={<Stage3D ref={stageRef} load={load} state={state} onPick={onPick} label="Mazmorra en 3D" />}
        top={
          <>
            <Plates players={plates} />
            <div className="flex shrink-0 flex-col items-end gap-2">
              <button
                onClick={() => {
                  play('page')
                  setBook(true)
                }}
                className="pointer-events-auto rounded-full bg-paper/90 px-3 py-1.5 text-sm font-bold shadow-sm backdrop-blur hover:bg-paper"
              >
                📖 <span className="hidden sm:inline">Libro de reglas</span>
              </button>
              <RollChip roll={game.lastRoll} />
            </div>
          </>
        }
        bottom={
          <>
            <Banner title={title} hint={hint} color={color} />
            <Flash flash={flash} />
            {game.phase === 'creating' && !myHero && !isDm && game.picks && me in game.picks && <ClassPicker send={send} picks={game.picks} />}
            {myCheck && (
              <ActionBar>
                <Btn big onClick={() => send({ type: 'mz_roll' })} color={colorOf(me)}>🎲 Tirar el d20</Btn>
              </ActionBar>
            )}
            {!game.pendingCheck && canExplore && myHero && (
              <ActionBar>
                {feature && <Btn onClick={() => send({ type: 'mz_feature' })} color={colorOf(me)}>{FEATURE_EMOJI[feature.kind] ?? '✨'} {feature.label} <small>({feature.ability.toUpperCase()} {sign(myHero.mods[feature.ability])})</small></Btn>}
                <Btn onClick={() => setAim(aim?.kind === 'potion' ? null : { kind: 'potion', target: 'hero' })} disabled={!game.potions} active={aim?.kind === 'potion'}>🧪 Poción ({game.potions})</Btn>
                <Btn onClick={() => send({ type: 'mz_rest' })} disabled={!game.rests}>🏕️ Descansar ({game.rests})</Btn>
              </ActionBar>
            )}
            {myTurn && !game.pendingCheck && <CombatBar hero={myHero} aim={aim} setAim={setAim} send={send} potions={game.potions} color={colorOf(me)} />}
            {aim && (
              <ActionBar>
                {(aim.target === 'monster' ? monsters.map((m) => ({ id: m.id, name: m.name, extra: `CA ${m.ac}` })) : game.heroes.filter((h) => h.cls).map((h) => ({ id: h.name, name: h.name, extra: `${h.hp}/${h.maxHp}` }))).map((t) => (
                  <Btn key={t.id} small onClick={() => act(aim, t.id)}>
                    {t.name} <small className="opacity-70">{t.extra}</small>
                  </Btn>
                ))}
                <Btn small onClick={() => setAim(null)}>Cancelar</Btn>
              </ActionBar>
            )}
            {isDm && turnMonster && !game.pendingCheck && (
              <ActionBar>
                <span className="px-1 text-sm font-bold text-white">{turnMonster.name} ataca a:</span>
                {game.heroes.filter((h) => h.cls && !h.down).map((h) => (
                  <Btn key={h.name} small onClick={() => send({ type: 'mz_monster', target: h.name })}>{h.name}</Btn>
                ))}
                <Btn small onClick={() => send({ type: 'mz_monster', target: 'auto' })}>🎲 Al azar</Btn>
              </ActionBar>
            )}
          </>
        }
        aside={
          <>
            {finished && (
              <Panel title={game.result === 'victory' ? '¡Aventura completada!' : 'Fin de la aventura'}>
                <EndActions send={send} replay={{ type: 'start_game', game: 'mazmorras', ...game.options }} />
              </Panel>
            )}
            {isDm && !finished && <DmTools game={game} send={send} />}
            <Panel title="Crónica" right={<span className="text-xs text-muted">{game.adventure.title}</span>}>
              <Chronicle log={game.log} />
            </Panel>
            {myHero && <HeroSheet hero={myHero} />}
            <Panel title="El grupo">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-stone px-3 py-1 font-semibold">🧪 {game.potions} {game.potions === 1 ? 'poción' : 'pociones'}</span>
                <span className="rounded-full bg-stone px-3 py-1 font-semibold">🏕️ {game.rests} {game.rests === 1 ? 'descanso' : 'descansos'}</span>
                {game.items.map((it) => <span key={it} className="rounded-full bg-stone px-3 py-1 font-semibold">{ITEMS[it] ?? it}</span>)}
              </div>
              <p className="mt-2 text-xs text-muted">Dungeon Master: {game.dm === 'auto' ? 'el sistema 🤖' : game.dm}</p>
              {game.phase === 'combat' && (isDm || game.dm === 'auto') && turnHero && turnHero.name !== me && !turnHero.bot && (
                <button onClick={() => send({ type: 'mz_skip' })} className="mt-2 text-xs font-semibold text-muted underline underline-offset-2 hover:text-ink">
                  Saltar el turno de {turnHero.name} (si no está)
                </button>
              )}
            </Panel>
            {game.phase === 'combat' && <InitiativePanel game={game} colorOf={colorOf} />}
          </>
        }
      />
      <AnimatePresence>{book && <Rulebook onClose={() => setBook(false)} />}</AnimatePresence>
    </>
  )
}

/* -- sounds of the story ------------------------------------------------------ */

function useStorySounds(game) {
  const seen = useRef(null)
  const rollSeen = useRef(null)
  useEffect(() => {
    const last = game.log.at(-1)?.id ?? 0
    const roll = game.lastRoll?.id ?? null
    if (seen.current === null) {
      seen.current = last
      rollSeen.current = roll
      return
    }
    let delay = 0
    if (roll !== rollSeen.current && roll !== null) {
      rollSeen.current = roll
      play('dice')
      delay = 650
    }
    const fresh = game.log.filter((l) => l.id > seen.current && l.sound)
    seen.current = last
    const timers = fresh.slice(-3).map((l, i) => setTimeout(() => play(l.sound), delay + i * 380))
    return () => timers.forEach(clearTimeout)
  }, [game.log, game.lastRoll])
}

/* -- small pieces ---------------------------------------------------------------- */

function ActionBar({ children }) {
  return (
    <motion.div
      className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-3xl bg-ink/70 p-1.5 backdrop-blur"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={spring}
    >
      {children}
    </motion.div>
  )
}

function Btn({ children, onClick, disabled, color, active, big, small }) {
  const size = big ? 'px-7 py-3 text-xl font-display font-extrabold' : small ? 'px-3 py-1.5 text-sm font-semibold' : 'px-4 py-2 text-sm font-bold sm:text-base'
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full shadow-sm disabled:opacity-40 ${size} ${color ? 'text-white' : active ? 'bg-ink text-white ring-2 ring-white' : 'bg-paper text-ink hover:bg-white'}`}
      style={color ? { background: color } : undefined}
    >
      {children}
    </motion.button>
  )
}

function RollChip({ roll }) {
  if (!roll) return null
  const ok = roll.ok
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={roll.id}
        className="max-w-[15rem] rounded-2xl bg-paper/92 px-3 py-1.5 text-right shadow-sm backdrop-blur"
        initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ ...spring, delay: 0.55 }}
        aria-live="polite"
      >
        <p className="truncate text-[0.7rem] font-semibold text-muted">{roll.who} · {roll.label}</p>
        <p className="font-display text-lg font-extrabold tabular-nums">
          <span className={roll.natural === 20 ? 'text-[hsl(40_90%_42%)]' : roll.natural === 1 ? 'text-danger' : ''}>🎲 {roll.natural}</span>
          <span className="text-sm text-muted"> {sign(roll.mod)} = </span>
          {roll.total}
          {roll.target != null && <span className="text-sm text-muted"> vs {roll.target}</span>}
          {ok != null && <span className={`ml-1 ${ok ? 'text-[hsl(145_50%_36%)]' : 'text-danger'}`}>{ok ? '✔' : '✘'}</span>}
        </p>
      </motion.div>
    </AnimatePresence>
  )
}

function ClassPicker({ send, picks }) {
  const taken = Object.values(picks).filter(Boolean)
  return (
    <motion.div className="pointer-events-auto grid w-full max-w-3xl grid-cols-2 gap-2 sm:grid-cols-4" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring}>
      {Object.entries(CLASSES).map(([key, c], i) => (
        <motion.button
          key={key}
          onClick={() => send({ type: 'mz_pick', cls: key })}
          className="flex flex-col rounded-3xl bg-paper p-3 text-left shadow-lg hover:-translate-y-0.5 hover:shadow-xl"
          style={{ borderTop: `6px solid ${c.color}` }}
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...spring, delay: i * 0.06 }}
        >
          <span className="text-3xl">{c.emoji}</span>
          <span className="font-display text-lg font-extrabold">{c.label}</span>
          <span className="text-xs font-semibold text-muted">❤️ {c.hp} PV · 🛡️ CA {c.ac}{taken.includes(key) ? ' · ya elegido' : ''}</span>
          <span className="mt-1 hidden text-xs text-muted sm:block">{c.blurb}</span>
        </motion.button>
      ))}
    </motion.div>
  )
}

function CombatBar({ hero, aim, setAim, send, potions, color }) {
  const toggle = (a) => setAim(aim && aim.kind === a.kind && aim.power === a.power ? null : a)
  return (
    <ActionBar>
      <Btn onClick={() => toggle({ kind: 'attack', target: 'monster' })} active={aim?.kind === 'attack'} color={aim?.kind === 'attack' ? undefined : color}>
        ⚔️ {hero.weapon} <small>({sign(hero.attack)})</small>
      </Btn>
      {hero.powers.map((p) => {
        const info = POWERS[p]
        if (info.passive) return null
        const out = (info.uses === 'slot' && hero.slots <= 0) || (info.uses === 'rest' && !hero.aliento)
        const a = { kind: 'power', power: p, target: info.target }
        return (
          <Btn key={p} disabled={out} active={aim?.power === p} onClick={() => (info.target ? toggle(a) : send({ type: 'mz_power', power: p }))}>
            {info.emoji} {info.label}{info.uses === 'slot' ? ` (${hero.slots})` : ''}
          </Btn>
        )
      })}
      <Btn onClick={() => send({ type: 'mz_defend' })}>🛡️ Defender</Btn>
      <Btn onClick={() => toggle({ kind: 'potion', target: 'hero' })} disabled={!potions} active={aim?.kind === 'potion'}>🧪 ({potions})</Btn>
    </ActionBar>
  )
}

function Chronicle({ log }) {
  const list = [...log].reverse()
  return (
    <ul className="max-h-80 space-y-2 overflow-y-auto pr-1 text-sm leading-snug">
      <AnimatePresence initial={false}>
        {list.map((l, i) => (
          <motion.li
            key={l.id}
            className={`${LOG_STYLE[l.kind] ?? 'text-muted'} ${i > 6 ? 'opacity-70' : ''} ${l.kind === 'room' || l.kind === 'narr' ? 'rounded-xl bg-stone px-3 py-2' : ''}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {l.kind === 'dm' && <span className="mr-1 not-italic">🎭</span>}
            {l.text}
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  )
}

function HeroSheet({ hero }) {
  const c = CLASSES[hero.cls]
  return (
    <Panel title={`${c.emoji} ${hero.name}`} right={<span className="text-xs font-semibold text-muted">{c.label} · nivel {hero.level}</span>}>
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Vida" value={`${hero.hp}/${hero.maxHp}`} />
        <Stat label="Armadura" value={hero.ac} />
        <Stat label="Ataque" value={sign(hero.attack)} />
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone" title="Experiencia">
        <motion.div className="h-full rounded-full bg-[hsl(40_85%_55%)]" animate={{ width: `${hero.nextXp ? Math.min(100, (hero.xp / hero.nextXp) * 100) : 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{hero.nextXp ? `${hero.xp} / ${hero.nextXp} PX para el nivel ${hero.level + 1}` : `${hero.xp} PX · nivel máximo`}</p>
      <div className="mt-3 grid grid-cols-6 gap-1 text-center text-xs">
        {Object.entries(hero.mods).map(([k, v]) => (
          <div key={k} className="rounded-xl bg-stone py-1" title={ABILITIES[k]}>
            <p className="font-bold text-muted">{k.toUpperCase()}</p>
            <p className="font-display text-base font-extrabold">{sign(v)}</p>
          </div>
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li><b>⚔️ {hero.weapon}</b> <span className="text-muted">— ataque {sign(hero.attack)}</span></li>
        {hero.powers.map((p) => (
          <li key={p}>
            <b>{POWERS[p].emoji} {POWERS[p].label}</b>
            {POWERS[p].uses === 'slot' && <span className="ml-1 text-xs font-bold">{'✦'.repeat(hero.slots)}<span className="text-line">{'✦'.repeat(Math.max(0, hero.maxSlots - hero.slots))}</span></span>}
            {POWERS[p].uses === 'rest' && <span className="ml-1 text-xs font-bold">{hero.aliento ? '✦' : <span className="text-line">✦</span>}</span>}
            <span className="block text-xs text-muted">{POWERS[p].text}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-stone py-1.5">
      <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="font-display text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  )
}

function InitiativePanel({ game, colorOf }) {
  return (
    <Panel title={`Orden de turnos · ronda ${game.round}`}>
      <ol className="space-y-1 text-sm">
        {game.order.map((id) => {
          const h = game.heroes.find((x) => x.name === id)
          const m = game.monsters.find((x) => x.id === id)
          const name = h?.name ?? m?.name ?? id
          const out = h ? h.down : !m || m.hp <= 0
          return (
            <li key={id} className={`flex items-center gap-2 rounded-xl px-2 py-1 ${game.turn === id ? 'bg-stone font-bold' : ''} ${out ? 'line-through opacity-50' : ''}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: h ? colorOf(h.name) : '#E5484D' }} />
              {name}
              <span className="ml-auto text-xs text-muted tabular-nums">{h ? `${h.hp}/${h.maxHp}` : m ? `${m.hp}/${m.maxHp}` : ''}</span>
            </li>
          )
        })}
      </ol>
    </Panel>
  )
}

/* -- the person Dungeon Master's tools -------------------------------------------- */

function DmTools({ game, send }) {
  const heroes = game.heroes.filter((h) => h.cls)
  const [text, setText] = useState('')
  const [check, setCheck] = useState({ hero: '', ability: 'des', dc: 12, reason: '' })
  const [monster, setMonster] = useState('goblin')
  const [hp, setHp] = useState({ hero: '', amount: 4 })
  // the chosen hero, or the first one (heroes appear as people pick their class)
  const valid = (name) => (heroes.some((h) => h.name === name) ? name : heroes[0]?.name ?? '')
  const checkHero = valid(check.hero)
  const hpHero = valid(hp.hero)
  const ready = game.phase !== 'creating'
  const field = 'rounded-xl border border-line bg-stone px-2 py-1.5 text-sm'
  const r = game.rooms.find((x) => x.id === game.room)
  return (
    <Panel title="🎭 Herramientas del DM">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!text.trim()) return
          send({ type: 'mz_narrate', text })
          setText('')
        }}
      >
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={300} rows={2} placeholder="Narra lo que pasa: «Un viento helado apaga las antorchas…»" className={`${field} w-full resize-none`} />
        <button className="mt-1 w-full rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" disabled={!text.trim()}>Narrar</button>
      </form>
      {ready && (
        <>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Pedir una prueba</p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            <select value={checkHero} onChange={(e) => setCheck({ ...check, hero: e.target.value })} className={field} aria-label="Héroe">
              {heroes.map((h) => <option key={h.name} value={h.name}>{h.name}</option>)}
            </select>
            <select value={check.ability} onChange={(e) => setCheck({ ...check, ability: e.target.value })} className={field} aria-label="Habilidad">
              {Object.entries(ABILITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={check.dc} onChange={(e) => setCheck({ ...check, dc: Number(e.target.value) })} className={field} aria-label="Dificultad">
              {[8, 10, 12, 13, 15, 18, 20].map((n) => <option key={n} value={n}>CD {n}</option>)}
            </select>
          </div>
          <div className="mt-1 flex gap-1">
            <input value={check.reason} onChange={(e) => setCheck({ ...check, reason: e.target.value })} maxLength={80} placeholder="¿Para qué? (saltar el foso…)" className={`${field} min-w-0 flex-1`} />
            <button onClick={() => send({ type: 'mz_check', ...check, hero: checkHero })} disabled={!!game.pendingCheck} className="rounded-xl bg-ink px-3 text-sm font-semibold text-white disabled:opacity-40">Pedir</button>
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Monstruos y vida</p>
          <div className="mt-1 flex gap-1">
            <select value={monster} onChange={(e) => setMonster(e.target.value)} className={`${field} min-w-0 flex-1`} aria-label="Monstruo">
              {Object.entries(MONSTERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <button onClick={() => send({ type: 'mz_spawn', monster })} className="rounded-xl bg-danger px-3 text-sm font-semibold text-white">Agregar</button>
          </div>
          <div className="mt-1 flex gap-1">
            <select value={hpHero} onChange={(e) => setHp({ ...hp, hero: e.target.value })} className={`${field} min-w-0 flex-1`} aria-label="Héroe">
              {heroes.map((h) => <option key={h.name} value={h.name}>{h.name}</option>)}
            </select>
            <select value={hp.amount} onChange={(e) => setHp({ ...hp, amount: Number(e.target.value) })} className={field} aria-label="Cantidad">
              {[2, 4, 6, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <button onClick={() => send({ type: 'mz_hp', hero: hpHero, amount: hp.amount })} className="rounded-xl bg-[hsl(145_45%_36%)] px-2 text-sm font-semibold text-white">Curar</button>
            <button onClick={() => send({ type: 'mz_hp', hero: hpHero, amount: -hp.amount })} className="rounded-xl bg-danger px-2 text-sm font-semibold text-white">Herir</button>
          </div>
          <button onClick={() => send({ type: 'mz_give' })} className="mt-1 w-full rounded-xl border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink">🧪 Regalar una poción</button>
          {game.phase === 'explore' && r && (
            <>
              <p className="mt-3 text-xs font-bold uppercase tracking-wide text-muted">Mover al grupo</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.exits.map((id) => {
                  const ex = game.rooms.find((x) => x.id === id)
                  return <button key={id} onClick={() => send({ type: 'mz_move', room: id })} className="rounded-xl bg-stone px-3 py-1.5 text-sm font-semibold hover:bg-line">{ex.name ?? 'Sala sin explorar'}</button>
                })}
              </div>
            </>
          )}
        </>
      )}
    </Panel>
  )
}

/* -- the rulebook ---------------------------------------------------------------- */

function Rulebook({ onClose }) {
  const [chapter, setChapter] = useState(RULEBOOK[0].id)
  const ch = RULEBOOK.find((c) => c.id === chapter)
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-3 sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Libro de reglas"
        className="flex max-h-[88dvh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.8rem] shadow-2xl sm:flex-row"
        style={{ background: 'linear-gradient(135deg, #F7EBD3, #EBD9B4)' }}
        initial={{ rotateY: -35, scale: 0.9, opacity: 0 }}
        animate={{ rotateY: 0, scale: 1, opacity: 1 }}
        exit={{ rotateY: 25, scale: 0.92, opacity: 0 }}
        transition={spring}
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[#D8C39A] bg-[#5B3A22] p-2 sm:w-52 sm:flex-col sm:overflow-visible sm:border-b-0 sm:p-3" aria-label="Capítulos">
          <p className="hidden px-2 pb-2 font-display text-lg font-extrabold text-[#F7EBD3] sm:block">📖 Reglamento</p>
          {RULEBOOK.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                play('page')
                setChapter(c.id)
              }}
              aria-current={c.id === chapter || undefined}
              className={`shrink-0 rounded-xl px-3 py-1.5 text-left text-sm font-semibold ${c.id === chapter ? 'bg-[#F7EBD3] text-[#5B3A22]' : 'text-[#F7EBD3]/85 hover:bg-white/10'}`}
            >
              {c.emoji} {c.title}
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-2xl font-extrabold text-[#4A2E1A]">{ch.emoji} {ch.title}</h2>
            <button onClick={onClose} className="rounded-full bg-[#5B3A22] px-3 py-1 text-sm font-bold text-[#F7EBD3]" aria-label="Cerrar el libro">✕</button>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={ch.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }} className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-[#3B2A1E]">
              {ch.body.map((p, i) =>
                Array.isArray(p) ? (
                  <ul key={i} className="space-y-1.5 pl-1">
                    {p.map((li) => (
                      <li key={li} className="flex gap-2">
                        <span className="text-[#A0522D]">◆</span>
                        <span>{li}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p key={i}>{p}</p>
                ),
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
