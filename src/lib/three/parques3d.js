/**
 * Parqués in 3D: the cross-shaped board on a wooden table, colored jails,
 * the cielo as a small pyramid, turned pawns that hop square by square and
 * real dice thrown onto the board. The board is rotated so each player sees
 * their own jail at the bottom left (same rule as the 2D board).
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, darker, dropIn, floorLabel, glowRing, hitBox, hop, makeDie, makeGlow, makePawn, makeTable, mat, shadowed, throwDie } from './kit'
import { ARM, N, jailOrigin, laneCell, pathCell, toView, viewRotation } from '../parques'

const CELL = 0.5
const HOME = 71
const TOP = 0.09
const cellPos = ([r, c]) => [(c - (N - 1) / 2) * CELL, (r - (N - 1) / 2) * CELL]

export function create(container, handlers) {
  const stage = createStage(container, { fitHalfWidth: 5.1, fitHalfDepth: 5.4, background: '#EADFCB', tilt: 0.86, portraitTilt: 0.94, target: [0, 0, 0.1] }, handlers)
  const { world } = stage
  const glow = makeGlow(stage)
  const boardGroup = new THREE.Group()
  const pawnsGroup = new THREE.Group()
  const fx = new THREE.Group()
  world.add(boardGroup, pawnsGroup, fx)

  let key = '' // rebuilds the board when players/arms/rotation change
  let turns = 0
  const pawns = new Map() // `${player}-${i}` -> { mesh, prog, ring }
  const dice = [makeDie(0.42), makeDie(0.42)]
  let lastRoll = null
  let current = null

  const view = (cell) => cellPos(toView(cell, turns))

  function buildBoard(game, colors) {
    boardGroup.clear()
    const armOwner = Object.fromEntries(Object.entries(game.arms).map(([p, k]) => [k, p]))
    const tint = (k, a) => (armOwner[k] ? new THREE.Color('#FFFFFF').lerp(new THREE.Color(colors[armOwner[k]]), a) : new THREE.Color('#D9DBE0'))
    const size = N * CELL
    boardGroup.add(makeTable(size + 0.3, size + 0.3, { cloth: '#F4EBD7', wood: '#7A4E2D', border: 0.45 }))

    const tileGeo = new RoundedBoxGeometry(CELL * 0.9, 0.08, CELL * 0.9, 2, 0.025)
    const safe = new Set(game.safe)
    for (let idx = 0; idx < 4 * ARM; idx++) {
      const k = Math.floor(idx / ARM)
      const isExit = idx % ARM === 13
      const [x, z] = view(pathCell(idx))
      const tile = new THREE.Mesh(tileGeo, isExit ? new THREE.MeshStandardMaterial({ color: tint(k, 0.6), roughness: 0.6 }) : mat('#FFFDF7', { roughness: 0.6 }))
      tile.position.set(x, 0.045, z)
      tile.receiveShadow = true
      boardGroup.add(tile)
      if (safe.has(idx) && !isExit) {
        const star = floorLabel('★', CELL * 0.7, CELL * 0.7, { fg: '#C9B48A', font: '800 190px system-ui' })
        star.position.set(x, TOP + 0.002, z)
        boardGroup.add(star)
      }
    }
    for (let k = 0; k < 4; k++) {
      const m = new THREE.MeshStandardMaterial({ color: tint(k, 0.38), roughness: 0.6 })
      for (let j = 0; j < 7; j++) {
        const [x, z] = view(laneCell(k, j))
        const tile = new THREE.Mesh(tileGeo, m)
        tile.position.set(x, 0.045, z)
        tile.receiveShadow = true
        boardGroup.add(tile)
      }
      // jail: a raised colored yard in the corner, with its owner's name
      const [r0, c0] = jailOrigin(k)
      const [ax, az] = view([r0, c0])
      const [bx, bz] = view([r0 + 7, c0 + 7])
      const owner = armOwner[k]
      const yard = new THREE.Mesh(new RoundedBoxGeometry(CELL * 7, 0.14, CELL * 7, 3, 0.1), new THREE.MeshStandardMaterial({ color: owner ? tint(k, 0.85) : new THREE.Color('#D9DBE0'), roughness: 0.55 }))
      yard.position.set((ax + bx) / 2, 0.07, (az + bz) / 2)
      shadowed(yard, false, true)
      boardGroup.add(yard)
      if (owner) {
        const label = floorLabel(owner, 2.6, 0.55, { fg: '#FFFFFF', font: '800 120px "Bricolage Grotesque", system-ui' })
        label.position.set((ax + bx) / 2, 0.142, (az + bz) / 2 + 1.15)
        boardGroup.add(label)
      }
    }
    // cielo: a stepped pyramid with a slice for each player
    const [cx, cz] = view([9, 9])
    const sky = new THREE.Group()
    const colorsList = game.players.map((p) => colors[p])
    for (let q = 0; q < 4; q++) {
      const piece = new THREE.Mesh(new THREE.ConeGeometry(CELL * 1.45, 0.45, 4, 1, false, q * (Math.PI / 2) + Math.PI / 4, Math.PI / 2), mat(colorsList[q % colorsList.length] ?? '#F7E3A1', { roughness: 0.5 }))
      piece.position.y = 0.225
      sky.add(piece)
    }
    sky.position.set(cx, 0.02, cz)
    shadowed(sky)
    boardGroup.add(sky)
  }

  /* -- where a piece stands ------------------------------------------------ */
  function spotOf(game, p, i) {
    const prog = game.pieces[p][i]
    if (prog === -1) {
      // its slot in the jail yard (2×2 per row)
      const k = game.arms[p]
      const [r0, c0] = jailOrigin(k)
      const jailed = game.pieces[p].map((x, j) => (x === -1 ? j : null)).filter((j) => j !== null)
      const slot = jailed.indexOf(i)
      const [x, z] = view([r0 + 2.5 + Math.floor(slot / 2) * 2, c0 + 2.5 + (slot % 2) * 2])
      return [x, 0.14, z, 'jail']
    }
    if (prog === HOME) {
      const [cx, cz] = view([9, 9])
      const homeIdx = game.players.flatMap((q) => game.pieces[q].map((x, j) => (x === HOME ? `${q}-${j}` : null))).filter(Boolean).indexOf(`${p}-${i}`)
      const a = (homeIdx / 8) * Math.PI * 2
      return [cx + Math.cos(a) * 0.62, 0.05, cz + Math.sin(a) * 0.62, 'home']
    }
    if (prog >= 64) {
      const [x, z] = view(laneCell(game.arms[p], prog - 64))
      return [x, TOP, z, `l${game.arms[p]}-${prog - 64}`]
    }
    const [x, z] = view(pathCell(game.squares[p][i]))
    return [x, TOP, z, `p${game.squares[p][i]}`]
  }

  // positions of every square from `from` to `to` progress, to hop square by square
  function stepsBetween(game, p, from, to) {
    if (from < 0 || to <= from || to === HOME) return []
    const start = (game.arms[p] * ARM + 13) % (4 * ARM) // progress 0 is the exit square
    const out = []
    for (let k = from + 1; k < to; k++) {
      const [x, z] = k >= 64 ? view(laneCell(game.arms[p], k - 64)) : view(pathCell((start + k) % (4 * ARM)))
      out.push([x, TOP, z])
    }
    return out.length > 12 ? out.filter((_, j) => j % 2 === 1) : out
  }

  async function travel(mesh, steps, final) {
    for (const s of steps) await hop(mesh, s, { height: 0.25, duration: 150 })
    await hop(mesh, final, { height: steps.length ? 0.35 : 0.9, duration: steps.length ? 220 : 520 })
  }

  function syncPawns(state, first) {
    const { game, colors, movable, me } = state
    // group the pieces that share a square, to spread them a little
    const placed = new Map()
    for (const p of game.players) {
      game.pieces[p].forEach((_, i) => {
        const spot = spotOf(game, p, i)
        if (spot[3] !== 'jail' && spot[3] !== 'home') placed.set(spot[3], [...(placed.get(spot[3]) ?? []), `${p}-${i}`])
      })
    }
    for (const p of game.players) {
      game.pieces[p].forEach((prog, i) => {
        const id = `${p}-${i}`
        let entry = pawns.get(id)
        if (!entry) {
          const mesh = makePawn(colors[p], 0.55)
          const ring = glowRing(glow, 0.22)
          ring.visible = false
          ring.position.y = 0.02
          mesh.add(ring)
          const hit = hitBox(0.75, 1.3, 0.75) // pawns are small: a generous invisible tap area
          hit.position.y = 0.6
          mesh.add(hit)
          pawnsGroup.add(mesh)
          entry = { mesh, prog: null, ring }
          pawns.set(id, entry)
        }
        const [x, y, z, at] = spotOf(game, p, i)
        const same = placed.get(at) ?? [id]
        const n = same.indexOf(id)
        const off = same.length > 1 ? [(n % 2 ? 1 : -1) * 0.1, Math.floor(n / 2) * 0.12 - 0.06] : [0, 0]
        const target = [x + off[0], y, z + off[1]]
        if (entry.prog === null || first) {
          entry.mesh.position.set(...target)
          if (!first && entry.prog === null) dropIn(entry.mesh)
        } else if (entry.prog !== prog || entry.mesh.position.distanceTo(new THREE.Vector3(...target)) > 0.01) {
          travel(entry.mesh, stepsBetween(game, p, entry.prog, prog), target)
        }
        entry.prog = prog
        // tappable when it's one of my pieces that can move
        const can = p === me && movable.has(i)
        entry.ring.visible = can
        entry.mesh.userData.pick = undefined
        if (can) stage.pickable(entry.mesh, { kind: 'piece', id: i, marker: entry.mesh })
      })
    }
  }

  stage.onFrame((t) => {
    pawns.forEach(({ ring }, id) => ring.visible && ring.scale.setScalar(1 + Math.sin(t * 4 + id.length) * 0.12))
  })

  return {
    update(state) {
      const { game, me, colors } = state
      turns = viewRotation(game.arms[me] ?? 0)
      const k = `${game.players.join('|')}:${JSON.stringify(game.arms)}:${turns}:${game.pieces[game.players[0]]?.length}`
      const first = k !== key
      if (first) {
        key = k
        pawns.forEach(({ mesh }) => pawnsGroup.remove(mesh))
        pawns.clear()
        buildBoard(game, colors)
      }
      stage.clearPickables()
      syncPawns(state, first)
      // dice: thrown in front of the cielo on every new roll
      if (game.dice && game.rollId !== lastRoll) {
        dice.forEach((d) => !d.parent && fx.add(d))
        const [cx, cz] = view([9, 9])
        const fresh = lastRoll !== null
        game.dice.forEach((v, i) => throwDie(dice[i], v, [cx - 0.35 + i * 0.7, cz + 1.55], { y: 0, delay: i * 90, from: fresh ? [0.6 - i * 1.2, 2.4, 2.5] : [0, 0, 0] }))
        lastRoll = game.rollId
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

export { darker }
