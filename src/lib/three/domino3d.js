/**
 * Dominoes in 3D: ivory tiles with real pips on a green felt table. The line
 * snakes across the table; your hand stands in front of you (playable tiles
 * rise and glow), your partner's stands face-down at the far side, and the
 * boneyard sits to one side. Tap a tile to play it; if it fits both ends,
 * the two ends light up so you can choose.
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, dropIn, glowRing, hitBox, makeGlow, makeTable, mat, shadowed } from './kit'
import { animate } from 'animejs'

const W = 0.42 // tile width (a tile is 2W long)
const T = 0.1 // thickness
const PIP = [[0, 0], [-0.5, -0.5], [0.5, 0.5], [0.5, -0.5], [-0.5, 0.5], [-0.5, 0], [0.5, 0]]
const PIPS = { 0: [], 1: [0], 2: [1, 2], 3: [1, 0, 2], 4: [1, 2, 3, 4], 5: [1, 2, 3, 4, 0], 6: [1, 2, 3, 4, 5, 6] }
const sameTile = (t, u) => t && u && ((t[0] === u[0] && t[1] === u[1]) || (t[0] === u[1] && t[1] === u[0]))

const tileGeo = new RoundedBoxGeometry(W, T, W * 2, 3, 0.03)
const pipGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.012, 14)

/** A tile lying flat, a on the far half (−z) and b on the near half. Face up is +y. */
function makeTile(a, b, faceDown = false) {
  const g = new THREE.Group()
  g.add(new THREE.Mesh(tileGeo, mat(faceDown ? '#2F3A44' : '#F7F2E6', { roughness: 0.35 })))
  if (!faceDown) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(W * 0.75, 0.012, 0.014), mat('#9C9585'))
    line.position.y = T / 2
    g.add(line)
    ;[a, b].forEach((n, half) => {
      for (const k of PIPS[n]) {
        const [u, v] = PIP[k]
        const p = new THREE.Mesh(pipGeo, mat('#22252E', { roughness: 0.5 }))
        p.position.set(u * W * 0.28, T / 2, (half ? 1 : -1) * W * 0.5 + v * W * 0.28)
        g.add(p)
      }
    })
  } else {
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 20), mat('#C9A86A'))
    dot.position.y = T / 2
    g.add(dot)
  }
  g.userData.tile = [a, b]
  return shadowed(g)
}

export function create(container, handlers) {
  const stage = createStage(container, { fitHalfWidth: 4.6, fitHalfDepth: 4.2, background: '#D9E4DD', tilt: 0.86, portraitTilt: 0.95, target: [0, 0, 0.4] }, handlers)
  const { world } = stage
  const glow = makeGlow(stage)
  world.add(makeTable(8.6, 7.4, { cloth: '#2F6B4F', wood: '#6E4628', border: 0.45 }))

  const lineGroup = new THREE.Group()
  const handGroup = new THREE.Group()
  const theirGroup = new THREE.Group()
  const pileGroup = new THREE.Group()
  const marks = new THREE.Group()
  world.add(lineGroup, handGroup, theirGroup, pileGroup, marks)

  let lineKey = ''
  let handNo = null
  const handMeshes = new Map() // "a-b" -> mesh
  let current = null

  /* -- the line: rows that snake across the table ----------------------- */
  function layoutLine(line) {
    const capacity = 15 // half-tile units per row
    const rows = []
    let row = []
    let used = 0
    line.forEach((t, i) => {
      const size = t[0] === t[1] ? 1 : 2
      if (row.length && used + size > capacity) {
        rows.push(row)
        row = []
        used = 0
      }
      row.push({ t, i, size })
      used += size
    })
    if (row.length) rows.push(row)
    const out = []
    const gapZ = W * 2.4
    rows.forEach((r, ri) => {
      const reversed = ri % 2 === 1
      const width = r.reduce((s, e) => s + e.size, 0) * W + (r.length - 1) * 0.02
      let x = reversed ? width / 2 : -width / 2
      const z = (ri - (rows.length - 1) / 2) * gapZ - 0.3
      for (const e of r) {
        const span = e.size * W
        const cx = reversed ? x - span / 2 : x + span / 2
        x += (reversed ? -1 : 1) * (span + 0.02)
        const double = e.size === 1
        const [a, b] = reversed ? [e.t[1], e.t[0]] : e.t
        out.push({ i: e.i, t: e.t, a, b, x: cx, z, double })
      }
    })
    return out
  }

  function syncLine(game, fresh) {
    const key = game.line.map((t) => t.join('')).join(',')
    if (key === lineKey) return
    lineGroup.clear()
    const placed = layoutLine(game.line)
    const lastPlay = [...game.log].reverse().find((l) => l.action === 'play')
    for (const p of placed) {
      // a lying tile has a on the far half; rotate so the halves run left→right
      const m = makeTile(p.a, p.b)
      m.rotation.y = p.double ? 0 : Math.PI / 2
      m.position.set(p.x, T / 2 + 0.01, p.z)
      lineGroup.add(m)
      const isNew = fresh && lastPlay && sameTile(lastPlay.tile, p.t) && lineKey !== ''
      if (isNew) dropIn(m, { from: 1.4 })
      m.userData.index = p.i
    }
    lineKey = key
  }

  /* -- my hand: standing tiles in front of me ---------------------------- */
  function syncHand(game, me, myTurn, selected) {
    const hand = game.hands[me] ?? []
    const keys = new Set(hand.map((t) => `${t[0]}-${t[1]}`))
    for (const [k, m] of handMeshes) {
      if (!keys.has(k)) {
        handGroup.remove(m)
        handMeshes.delete(k)
      }
    }
    const playable = (t) => myTurn && game.moves.some((m) => sameTile(m.tile, t))
    const gap = W + 0.1
    hand.forEach((t, i) => {
      const k = `${t[0]}-${t[1]}`
      let m = handMeshes.get(k)
      const x = (i - (hand.length - 1) / 2) * gap
      if (!m) {
        m = makeTile(t[0], t[1])
        m.rotation.x = 1.1 // standing up, its face turned toward me
        m.position.set(x, 0.55, 3.25)
        handGroup.add(m)
        handMeshes.set(k, m)
        const hit = hitBox(W * 1.3, 0.4, W * 2.4)
        m.add(hit)
        if (!stage.reduce) {
          m.position.y = -0.6
          animate(m.position, { y: 0.55, duration: 500, delay: i * 60, ease: 'outBack(1.4)' })
        }
      }
      const up = playable(t) ? 0.12 : 0
      const sel = sameTile(selected, t) ? 0.22 : 0
      animate(m.position, { x, y: 0.55 + up + sel, duration: 280, ease: 'outQuad' })
      m.children[0].material = playable(t) || !myTurn ? mat('#F7F2E6', { roughness: 0.35 }) : mat('#D8D3C6', { roughness: 0.5 })
      if (playable(t)) {
        stage.pickable(m, { kind: 'tile', id: k, marker: m })
        // a glowing outline on the table under each tile you can play
        const halo = glowRing(glow, 0.3, 0.03)
        halo.scale.set(0.9, 1.6, 1)
        halo.position.set(x, 0.02, 3.42)
        marks.add(halo)
      }
    })
  }

  function syncTheirs(count) {
    if (theirGroup.children.length === count) return
    theirGroup.clear()
    for (let i = 0; i < count; i++) {
      const m = makeTile(0, 0, true)
      m.rotation.x = -1.1
      m.position.set((i - (count - 1) / 2) * (W + 0.06), 0.5, -3.3)
      theirGroup.add(m)
    }
  }

  function syncPile(game, me) {
    pileGroup.clear()
    if (!game.options?.boneyard) return
    const n = Math.min(game.pool, 14)
    for (let i = 0; i < n; i++) {
      const m = makeTile(0, 0, true)
      m.rotation.y = Math.PI / 2 + ((i * 37) % 10) / 40
      m.position.set(3.55 + ((i % 2) * 0.05), T / 2 + Math.floor(i / 2) * (T + 0.005), -1.9 + (i % 2) * (W * 1.2))
      pileGroup.add(m)
    }
    if (game.mustDraw && game.turn === me && n) {
      const ring = glowRing(glow, 0.75, 0.04)
      ring.position.set(3.6, 0.03, -1.65)
      marks.add(ring)
      const hit = hitBox(1.6, 1.4, 1.8)
      hit.position.set(3.6, 0.4, -1.65)
      marks.add(hit)
      stage.pickable(hit, { kind: 'pile', id: 'draw', marker: ring, priority: 1 })
    }
  }

  function showEnds(game, selected) {
    if (!selected || !game.line.length) return
    const tiles = lineGroup.children
    const ends = { left: tiles.find((m) => m.userData.index === 0), right: tiles.find((m) => m.userData.index === game.line.length - 1) }
    for (const side of ['left', 'right']) {
      const t = ends[side]
      if (!t) continue
      const ring = glowRing(glow, 0.46, 0.04)
      ring.position.set(t.position.x, 0.14, t.position.z)
      marks.add(ring)
      const hit = hitBox(1.0, 0.6, 1.0)
      hit.position.set(t.position.x, 0.3, t.position.z)
      marks.add(hit)
      stage.pickable(hit, { kind: 'end', id: side, marker: ring, priority: 2 })
    }
  }

  stage.onFrame((t) => marks.children.forEach((m, i) => m.material === glow && m.scale.setScalar(1 + Math.sin(t * 4 + i) * 0.08)))

  return {
    update(state) {
      const { game, me, selected } = state
      const myTurn = game.phase === 'playing' && game.turn === me
      if (game.handNo !== handNo) {
        handNo = game.handNo
        lineKey = ''
        handMeshes.forEach((m) => handGroup.remove(m))
        handMeshes.clear()
      }
      marks.clear()
      stage.clearPickables()
      syncLine(game, true)
      syncHand(game, me, myTurn, selected)
      const other = game.players.find((p) => p !== me)
      syncTheirs(game.phase === 'playing' ? game.counts[other] ?? 0 : 0)
      syncPile(game, me)
      if (myTurn) showEnds(game, selected)
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
