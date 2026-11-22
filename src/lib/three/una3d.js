/**
 * Una on a 3D card table. The draw pile and the discard pile sit in the
 * middle (a ring around the discard shows the color in play), your hand fans
 * out in front of you and your partner's stands face-down across the table.
 * Played cards fly onto the pile; drawn ones fly from the pile to a hand.
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { canvasTexture, floorLabel, glowRing, hitBox, makeCard, makeGlow, makeTable, roundedPlane } from './kit'
import { animate } from 'animejs'

const COLORS = { r: '#D7352D', y: '#F6B91C', g: '#2E9157', b: '#2D74C4' }
const WILD = '#22252E'
const W = 0.9
const H = 1.35
const PILE = [-1.35, -0.35]
const DISCARD = [0.75, -0.35]
const HAND_Z = 2.55
const THEIR_Z = -2.75
const TILT = 0.95 // my cards lean back toward the camera

/* -- printing the cards ------------------------------------------------------ */

function symbol(ctx, value, size, fill) {
  ctx.save()
  ctx.strokeStyle = fill
  ctx.fillStyle = fill
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (value === 'skip') {
    ctx.lineWidth = size * 0.12
    ctx.beginPath()
    ctx.arc(0, 0, size * 0.42, 0, Math.PI * 2)
    ctx.moveTo(-size * 0.3, size * 0.3)
    ctx.lineTo(size * 0.3, -size * 0.3)
    ctx.stroke()
  } else if (value === 'reverse') {
    const s = size * 0.42
    ctx.lineWidth = size * 0.11
    ctx.beginPath()
    ctx.moveTo(-s, -s * 0.25)
    ctx.lineTo(s * 0.7, -s * 0.25)
    ctx.moveTo(s * 0.35, -s * 0.6)
    ctx.lineTo(s * 0.75, -s * 0.25)
    ctx.lineTo(s * 0.35, s * 0.1)
    ctx.moveTo(s, s * 0.45)
    ctx.lineTo(-s * 0.7, s * 0.45)
    ctx.moveTo(-s * 0.35, s * 0.1)
    ctx.lineTo(-s * 0.75, s * 0.45)
    ctx.lineTo(-s * 0.35, s * 0.8)
    ctx.stroke()
  } else {
    const text = value === 'draw2' ? '+2' : value === 'wild4' ? '+4' : value === 'wild' ? '' : String(value)
    ctx.font = `800 ${size * (text.length > 1 ? 0.82 : 1.05)}px "Bricolage Grotesque", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 0, size * 0.04)
  }
  ctx.restore()
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Same design as the SVG cards: colored body, tilted white oval, big symbol. */
function frontTexture(card) {
  return canvasTexture(
    400,
    600,
    (ctx, w, h) => {
      const k = w / 100
      ctx.scale(k, k)
      ctx.fillStyle = '#FFFFFF'
      rounded(ctx, 0, 0, 100, 150, 12)
      ctx.fill()
      const wild = card.color === null
      const bg = wild ? WILD : COLORS[card.color]
      ctx.fillStyle = bg
      rounded(ctx, 6, 6, 88, 138, 8)
      ctx.fill()
      ctx.save()
      ctx.translate(50, 75)
      ctx.rotate((-28 * Math.PI) / 180)
      ctx.beginPath()
      ctx.ellipse(0, 0, 30, 50, 0, 0, Math.PI * 2)
      if (wild) {
        ctx.save()
        ctx.clip()
        ;['r', 'b', 'y', 'g'].forEach((c, i) => {
          ctx.fillStyle = COLORS[c]
          ctx.fillRect(i % 2 ? 0 : -30, i < 2 ? -50 : 0, 30, 50)
        })
        ctx.restore()
      } else {
        ctx.fillStyle = '#FFFFFF'
        ctx.fill()
      }
      ctx.restore()
      ctx.translate(50, 75)
      symbol(ctx, card.value, 44, wild ? '#FFFFFF' : bg)
      ctx.translate(-28, -49)
      symbol(ctx, card.value, 18, '#FFFFFF')
      ctx.translate(56, 98)
      ctx.rotate(Math.PI)
      symbol(ctx, card.value, 18, '#FFFFFF')
    },
    `una|${card.color}|${card.value}`,
  )
}

const backTexture = () =>
  canvasTexture(
    400,
    600,
    (ctx, w) => {
      const k = w / 100
      ctx.scale(k, k)
      ctx.fillStyle = '#FFFFFF'
      rounded(ctx, 0, 0, 100, 150, 12)
      ctx.fill()
      ctx.fillStyle = WILD
      rounded(ctx, 6, 6, 88, 138, 8)
      ctx.fill()
      ctx.translate(50, 75)
      ctx.rotate((-28 * Math.PI) / 180)
      ctx.fillStyle = COLORS.r
      ctx.beginPath()
      ctx.ellipse(0, 0, 32, 52, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.font = '800 27px "Bricolage Grotesque", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Una', 0, 1)
    },
    'una|back',
  )

const blankFront = () => canvasTexture(8, 12, (ctx) => ((ctx.fillStyle = '#FFFFFF'), ctx.fillRect(0, 0, 8, 12)), 'una|blank')
const newCard = (card) => makeCard(W, H, card ? frontTexture(card) : blankFront(), backTexture())

/* -- the table ------------------------------------------------------------------ */

export function create(container, handlers) {
  const stage = createStage(container, { fitHalfWidth: 4.4, fitHalfDepth: 4.0, background: '#D5D9E6', tilt: 0.88, portraitTilt: 0.95, target: [0, 0, 0.25] }, handlers)
  const { world } = stage
  const glow = makeGlow(stage)
  world.add(makeTable(9, 7.6, { cloth: '#2B3A63', wood: '#5B3D2A', border: 0.45 }))

  const pileGroup = new THREE.Group()
  const discardGroup = new THREE.Group()
  const mineGroup = new THREE.Group()
  const theirGroup = new THREE.Group()
  const marks = new THREE.Group()
  world.add(pileGroup, discardGroup, mineGroup, theirGroup, marks)

  // the color in play: a ring under the discard pile
  const colorRing = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.16, 64), new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.35, roughness: 0.5 }))
  colorRing.rotation.x = -Math.PI / 2
  colorRing.position.set(DISCARD[0], 0.02, DISCARD[1])
  world.add(colorRing)
  let ringColor = null

  const mine = new Map() // card id -> mesh
  const discards = [] // meshes on the discard pile, oldest first
  let topId = null
  let round = null
  let current = null
  let pileSize = -1

  const outlineGeo = roundedPlane(W + 0.14, H + 0.14, 0.12)

  function syncPile(n) {
    const shown = Math.min(Math.ceil(n / 4), 14)
    if (shown === pileSize) return
    pileSize = shown
    pileGroup.clear()
    for (let i = 0; i < shown; i++) {
      const c = newCard(null)
      c.position.set(PILE[0] + ((i * 13) % 5) * 0.006, 0.02 + i * 0.022, PILE[1] + ((i * 7) % 3) * 0.006)
      c.rotation.set(Math.PI, ((i * 31) % 9 - 4) * 0.01, 0) // face down
      pileGroup.add(c)
    }
  }
  const pileTop = () => new THREE.Vector3(PILE[0], 0.05 + pileSize * 0.022, PILE[1])

  /** Fan layout for n cards at depth z: x, a slight arc and the fan angle. */
  function fan(n, i, z, dir = 1, maxSpread = null) {
    const spread = maxSpread ?? Math.min(0.72, 7.2 / Math.max(n, 1))
    const x = (i - (n - 1) / 2) * spread
    const a = (n > 1 ? (i - (n - 1) / 2) / (n - 1) : 0) * Math.min(0.35, n * 0.04)
    return { x, z: z - dir * Math.abs(a) * 0.5, angle: -a * dir }
  }

  function flyTo(mesh, pos, rot, { duration = 520, height = 0.9, delay = 0 } = {}) {
    if (stage.reduce) {
      mesh.position.copy(pos)
      mesh.rotation.set(rot.x, rot.y, rot.z)
      return
    }
    const from = mesh.position.clone()
    const k = { t: 0 }
    animate(k, {
      t: 1,
      duration,
      delay,
      ease: 'inOutQuad',
      onUpdate: () => {
        mesh.position.lerpVectors(from, pos, k.t)
        mesh.position.y += Math.sin(k.t * Math.PI) * height
      },
    })
    animate(mesh.rotation, { x: rot.x, y: rot.y, z: rot.z, duration, delay, ease: 'outQuad' })
  }

  function syncDiscard(game, me) {
    if (!game.top) return
    if (game.top.id === topId) return
    const first = topId === null
    topId = game.top.id
    const card = newCard(game.top)
    const r = ((game.top.id * 37) % 21 - 10) * 0.025
    const target = new THREE.Vector3(DISCARD[0], 0.02 + discards.length * 0.014, DISCARD[1])
    const last = game.log[game.log.length - 1]
    // the card leaves the hand of whoever played it
    const fromMine = last?.action === 'play' && last.player === me && mine.get(game.top.id)
    if (fromMine) {
      card.position.copy(fromMine.position)
      card.rotation.copy(fromMine.rotation)
      mineGroup.remove(fromMine)
      mine.delete(game.top.id)
    } else if (!first && last?.action === 'play') {
      // from the hand of whoever played it
      const seat = seats.get(last.player)
      const from = seat?.cards.at(-1)
      if (from) from.getWorldPosition(card.position)
      else card.position.set(0, 1.2, THEIR_Z + 0.4)
      card.position.y = 1.2
      card.rotation.set(Math.PI - 0.6, seat ? seat.group.rotation.y : 0, 0)
    } else {
      card.position.copy(target)
      card.rotation.set(0, r, 0)
    }
    discardGroup.add(card)
    discards.push(card)
    if (card.position.distanceTo(target) > 0.01) flyTo(card, target, { x: 0, y: r + Math.PI * 2 * (fromMine ? 0 : 1), z: 0 }, { duration: 560, height: 1.1 })
    // keep the pile short
    while (discards.length > 9) discardGroup.remove(discards.shift())
  }

  function syncColor(color, pending) {
    const c = COLORS[color] ?? '#FFFFFF'
    if (c === ringColor) return
    ringColor = c
    const col = new THREE.Color(c)
    colorRing.material.color.copy(col)
    colorRing.material.emissive.copy(col)
    if (!stage.reduce) {
      colorRing.scale.setScalar(0.6)
      animate(colorRing.scale, { x: 1, y: 1, z: 1, duration: 700, ease: 'outElastic(1, .5)' })
    }
    void pending
  }

  function syncMine(game, myTurn) {
    const hand = game.phase === 'playing' ? game.hand : []
    const ids = new Set(hand.map((c) => c.id))
    for (const [id, m] of mine) {
      if (!ids.has(id)) {
        mineGroup.remove(m)
        mine.delete(id)
      }
    }
    const playable = new Set(myTurn ? game.playable : [])
    const n = hand.length
    hand.forEach((c, i) => {
      let m = mine.get(c.id)
      const f = fan(n, i, HAND_Z)
      const ok = playable.has(c.id)
      const lift = ok ? 0.22 : 0
      const pos = new THREE.Vector3(f.x, 0.75 + lift + i * 0.004, f.z - i * 0.006)
      const rot = { x: TILT, y: f.angle, z: 0 }
      if (!m) {
        m = newCard(c)
        m.userData.id = c.id
        mineGroup.add(m)
        mine.set(c.id, m)
        if (current) {
          // drawn from the pile: flies over face down and turns over
          m.position.copy(pileTop())
          m.rotation.set(Math.PI, 0, 0)
          flyTo(m, pos, rot, { duration: 620, height: 1.2 })
        } else {
          // the deal at the start
          m.position.copy(pileTop())
          m.rotation.set(Math.PI, 0, 0)
          flyTo(m, pos, rot, { duration: 520, delay: i * 70, height: 0.8 })
        }
      } else {
        animate(m.position, { x: pos.x, y: pos.y, z: pos.z, duration: 300, ease: 'outQuad' })
        animate(m.rotation, { x: rot.x, y: rot.y, z: rot.z, duration: 300, ease: 'outQuad' })
      }
      m.renderOrder = i
      // dim what you can't play on your turn
      const front = m.children[1]
      front.material.color.setScalar(myTurn && !ok ? 0.62 : 1)
      if (ok) {
        stage.pickable(m, { kind: 'card', id: c.id, marker: m })
        const halo = new THREE.Mesh(outlineGeo, glow)
        halo.rotation.x = -Math.PI / 2
        halo.position.y = -0.02
        halo.userData.halo = true
        m.add(halo)
      }
    })
  }

  /** Seats around the table for the others, in playing order: left, across, right. */
  const SEAT_ANGLES = { 1: [0], 2: [Math.PI / 2, -Math.PI / 2], 3: [Math.PI / 2, 0, -Math.PI / 2] }
  const seats = new Map() // player -> { group, cards, label }

  function seatFor(name, angle, color) {
    let seat = seats.get(name)
    if (!seat) {
      const group = new THREE.Group()
      theirGroup.add(group)
      seat = { group, cards: [], label: null }
      seats.set(name, seat)
    }
    seat.group.rotation.y = angle
    if (!seat.label || seat.label.userData.color !== color) {
      if (seat.label) seat.group.remove(seat.label)
      seat.label = floorLabel(name, 2.2, 0.42, { fg: color, font: '800 150px "Bricolage Grotesque", system-ui' })
      seat.label.userData.color = color
      seat.label.position.set(0, 0.02, THEIR_Z - 0.85) // behind their cards, by the edge of the table
      seat.group.add(seat.label)
    }
    return seat
  }

  function syncTheirs(game, me, colors) {
    const playing = game.phase === 'playing'
    const order = game.players.slice(game.players.indexOf(me) + 1).concat(game.players.slice(0, game.players.indexOf(me)))
    const angles = SEAT_ANGLES[order.length] ?? order.map((_, i) => Math.PI / 2 - (i * Math.PI) / Math.max(1, order.length - 1))
    for (const [name, seat] of seats) {
      if (!order.includes(name)) {
        theirGroup.remove(seat.group)
        seats.delete(name)
      }
    }
    const side = order.length > 1
    order.forEach((name, k) => {
      const seat = seatFor(name, angles[k], colors?.[name] ?? '#FFFFFF')
      const n = playing ? Math.min(game.counts[name] ?? 0, 24) : 0
      const cards = seat.cards
      while (cards.length > n) seat.group.remove(cards.pop())
      while (cards.length < n) {
        const m = newCard(null)
        seat.group.add(m)
        m.position.copy(seat.group.worldToLocal(pileTop()))
        m.rotation.set(Math.PI, 0, 0)
        cards.push(m)
      }
      cards.forEach((m, i) => {
        // seats on the sides get a narrower fan so they don't reach my hand
        const spread = side && Math.abs(angles[k]) > 0.1 ? Math.min(0.42, 3.6 / Math.max(n, 1)) : null
        const f = fan(n, i, THEIR_Z, -1, spread)
        const key = `${n}|${i}`
        if (m.userData.slot === key) return
        const fresh = m.userData.slot === undefined
        m.userData.slot = key
        // standing up, backs toward me
        flyTo(m, new THREE.Vector3(-f.x, 0.75 + i * 0.004, f.z + i * 0.006), { x: Math.PI + TILT, y: f.angle, z: 0 }, { duration: fresh ? 560 : 300, height: fresh ? 0.9 : 0, delay: fresh && !current ? i * 70 : 0 })
      })
    })
  }


  stage.onFrame((t) => {
    marks.children.forEach((m, i) => m.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.06))
  })

  return {
    update(state) {
      const { game, me } = state
      const myTurn = game.phase === 'playing' && game.turn === me
      if (game.round !== round) {
        // a new hand: clear the table
        round = game.round
        mine.forEach((m) => mineGroup.remove(m))
        mine.clear()
        seats.forEach((seat) => seat.cards.splice(0).forEach((m) => seat.group.remove(m)))
        discards.splice(0).forEach((m) => discardGroup.remove(m))
        topId = null
        current = null
      }
      // remove last update's halos
      mine.forEach((m) => m.children.filter((c) => c.userData.halo).forEach((c) => m.remove(c)))
      marks.clear()
      stage.clearPickables()
      syncPile(game.pile)
      syncDiscard(game, me)
      syncColor(game.color, game.pending)
      syncMine(game, myTurn)
      syncTheirs(game, me, state.colors)
      if (myTurn && game.drawn == null) {
        const ring = glowRing(glow, 0.95, 0.04)
        ring.position.set(PILE[0], 0.03, PILE[1])
        marks.add(ring)
        const hit = hitBox(1.3, 0.9, 1.7)
        hit.position.set(PILE[0], 0.3, PILE[1])
        marks.add(hit)
        stage.pickable(hit, { kind: 'pile', id: 'draw', marker: ring })
      }
      current = state
    },
    get state() {
      return current
    },
    resetView: stage.resetView,
    setInsets: stage.setInsets,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose: stage.dispose,
  }
}

