/**
 * Battleship in 3D: one sea while you place your fleet, two seas side by side
 * during the battle (like the real game: the enemy waters you shoot at and your
 * own fleet with their shots). On tall screens the two stack, with yours
 * smaller below. Each sea moves, ships have a hull, deck and bridge, misses
 * splash and hits burn. Sunk ships list and settle lower in the water.
 *
 * state: { size, lengths, boards: [{ key, ships, shots, lastShot, preview,
 *          interactive, skipShot, label, labelColor, highlight }] }
 * Only interactive boards have tappable cells ("cell", "r,c").
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, cssColor, floorLabel, hitBox, mat, shadowed } from './kit'
import { animate } from 'animejs'

const COLS = 'ABCDEFGHIJ'
const SEA = '#3E8CC4'
const SMALL = 0.56 // your own sea, below the enemy's on tall screens
const GAP = 1.1
const NAME = 0.95 // room for the name under each sea

function makeShip(length, sunk) {
  const g = new THREE.Group()
  const hullMat = mat(sunk ? '#3A3F47' : '#5C6773', { roughness: 0.5 })
  const L = length * 0.92
  const hull = new THREE.Mesh(new RoundedBoxGeometry(L - 0.3, 0.26, 0.62, 3, 0.1), hullMat)
  hull.position.y = 0.05
  const bow = new THREE.Mesh(new THREE.ConeGeometry(0.31, 0.5, 4), hullMat)
  bow.rotation.z = -Math.PI / 2
  bow.rotation.x = Math.PI / 4
  bow.scale.set(1, 1, 0.72)
  bow.position.set((L - 0.3) / 2 + 0.2, 0.05, 0)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(L - 0.5, 0.04, 0.48), mat(sunk ? '#4A4E55' : '#9AA4AE'))
  deck.position.y = 0.2
  const bridge = new THREE.Mesh(new RoundedBoxGeometry(Math.min(0.7, L * 0.25), 0.26, 0.34, 2, 0.05), mat(sunk ? '#555A61' : '#E9EDF1'))
  bridge.position.set(-L * 0.12, 0.34, 0)
  g.add(hull, bow, deck, bridge)
  if (length >= 3) {
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.1, 12), mat('#47505A'))
    gun.position.set(L * 0.22, 0.27, 0)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 8), mat('#47505A'))
    barrel.rotation.z = Math.PI / 2
    barrel.position.set(L * 0.22 + 0.18, 0.3, 0)
    g.add(gun, barrel)
  }
  return shadowed(g)
}

function splash(x, z) {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 28), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9 }))
  ring.rotation.x = Math.PI / 2
  const buoy = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat('#F4F7FA', { roughness: 0.3 }))
  buoy.position.y = 0.06
  g.add(ring, buoy)
  g.position.set(x, 0.06, z)
  return g
}

function fire(x, z) {
  const g = new THREE.Group()
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 16), mat('#D63031', { roughness: 0.4 }))
  peg.position.y = 0.3
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 10), new THREE.MeshStandardMaterial({ color: '#FFB347', emissive: '#FF7A1A', emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }))
  flame.position.y = 0.6
  flame.userData.flame = true
  g.add(peg, flame)
  g.position.set(x, 0, z)
  return shadowed(g)
}

/** One sea with its frame, grid, ships, shots and tap areas. */
function makeBoard(stage, n) {
  const root = new THREE.Group() // placed in the world; holds the name
  const inner = new THREE.Group() // the sea itself, scaled down when it's the small one
  root.add(inner)
  const sea = new THREE.Group()
  const shipsGroup = new THREE.Group()
  const shotsGroup = new THREE.Group()
  const cellsGroup = new THREE.Group()
  const previewGroup = new THREE.Group()
  inner.add(sea, shipsGroup, shotsGroup, cellsGroup, previewGroup)

  const ships = new Map() // id -> { mesh, key, placed }
  const shotKeys = new Map()
  let lastShotKey = null
  let instant = true // the first build shows things as they are
  let label = null
  let labelKey = ''

  const cell = (r, c) => [c - (n - 1) / 2, r - (n - 1) / 2]

  const geo = new THREE.PlaneGeometry(n + 0.2, n + 0.2, n * 4, n * 4)
  geo.rotateX(-Math.PI / 2)
  const waves = { geo, base: Float32Array.from(geo.attributes.position.array) }
  const water = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: SEA, roughness: 0.3, metalness: 0.05, flatShading: true }))
  water.receiveShadow = true
  // the waves stay between the frame (well below) and the grid lines and markers (above),
  // so nothing flickers through the water as it moves
  sea.add(water)
  const frame = new THREE.Mesh(new RoundedBoxGeometry(n + 1.4, 0.3, n + 1.4, 3, 0.12), mat('#E9E2D2', { roughness: 0.7 }))
  frame.position.y = -0.32
  frame.receiveShadow = true
  sea.add(frame)
  // a colored rim around the sea being shot at
  const rimMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.5, emissive: '#000000' })
  const rim = new THREE.Mesh(new RoundedBoxGeometry(n + 1.9, 0.26, n + 1.9, 3, 0.16), rimMat)
  rim.position.y = -0.4
  rim.visible = false
  sea.add(rim)
  const lines = []
  for (let i = 0; i <= n; i++) {
    const p = i - n / 2
    lines.push(-n / 2, 0.05, p, n / 2, 0.05, p, p, 0.05, -n / 2, p, 0.05, n / 2)
  }
  const lg = new THREE.BufferGeometry()
  lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3))
  sea.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#BFE0F5', transparent: true, opacity: 0.55 })))
  for (let i = 0; i < n; i++) {
    const [x] = cell(0, i)
    const [, z] = cell(i, 0)
    const col = floorLabel(COLS[i], 0.45, 0.45, { fg: '#6B6F7B', font: '800 150px "Bricolage Grotesque", system-ui' })
    col.position.set(x, -0.165, -n / 2 - 0.4)
    const row = floorLabel(String(i + 1), 0.5, 0.45, { fg: '#6B6F7B', font: '800 140px "Bricolage Grotesque", system-ui' })
    row.position.set(-n / 2 - 0.4, -0.165, z)
    sea.add(col, row)
  }
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const [x, z] = cell(r, c)
      const h = hitBox(0.98, 0.3, 0.98)
      h.position.set(x, 0.1, z)
      h.userData.rc = [r, c]
      cellsGroup.add(h)
    }
  }

  function syncShips(list, lengths) {
    const seen = new Set()
    for (const s of list) {
      const len = s.length ?? lengths?.[s.id]
      const key = `${len}|${s.sunk ? 1 : 0}`
      seen.add(s.id)
      let entry = ships.get(s.id)
      if (!entry || entry.key !== key) {
        if (entry) shipsGroup.remove(entry.mesh)
        const mesh = makeShip(len, s.sunk)
        shipsGroup.add(mesh)
        entry = { mesh, key, placed: false }
        ships.set(s.id, entry)
        if (s.sunk && !stage.reduce && !instant) {
          // it goes down: lists to one side and settles lower
          mesh.rotation.x = 0
          animate(mesh.rotation, { x: s.dir === 'h' ? 0.22 : 0, z: s.dir === 'h' ? 0 : 0.22, duration: 1200, ease: 'outQuad' })
          animate(mesh.position, { y: -0.12, duration: 1400, ease: 'outQuad' })
        }
      }
      const [x0, z0] = cell(s.row, s.col)
      const horizontal = s.dir === 'h'
      const cx = horizontal ? x0 + (len - 1) / 2 : x0
      const cz = horizontal ? z0 : z0 + (len - 1) / 2
      const rotY = horizontal ? 0 : -Math.PI / 2
      const m = entry.mesh
      if (!entry.placed || stage.reduce) {
        m.position.set(cx, s.sunk ? -0.12 : 0.05, cz)
        m.rotation.y = rotY
        entry.placed = true
      } else if (m.position.x !== cx || m.position.z !== cz || m.rotation.y !== rotY) {
        // ships glide (and turn) into place while you arrange the fleet
        animate(m.position, { x: cx, z: cz, duration: 320, ease: 'outBack(1.4)' })
        animate(m.rotation, { y: rotY, duration: 320, ease: 'outQuad' })
      }
    }
    for (const [id, e] of ships) {
      if (!seen.has(id)) {
        shipsGroup.remove(e.mesh)
        ships.delete(id)
      }
    }
  }

  function syncShots(shots, lastShot) {
    const want = new Map()
    shots.forEach(([r, c, v]) => want.set(`${r},${c}`, v))
    for (const [k, obj] of shotKeys) {
      if (want.get(k) !== obj.userData.v) {
        shotsGroup.remove(obj)
        shotKeys.delete(k)
      }
    }
    const lastKey = lastShot ? `${lastShot.row},${lastShot.col}` : null
    for (const [k, v] of want) {
      if (shotKeys.has(k)) continue
      const [r, c] = k.split(',').map(Number)
      const [x, z] = cell(r, c)
      const obj = v === 'hit' ? fire(x, z) : splash(x, z)
      obj.userData.v = v
      shotsGroup.add(obj)
      shotKeys.set(k, obj)
      if (k === lastKey && lastKey !== lastShotKey && !stage.reduce && !instant) {
        // the new shot: a burst of water or a blast
        const burst = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 12), new THREE.MeshStandardMaterial({ color: v === 'hit' ? '#FF8A3D' : '#FFFFFF', emissive: v === 'hit' ? '#FF5A1A' : '#000000', transparent: true, opacity: 0.9 }))
        burst.position.set(x, 0.25, z)
        shotsGroup.add(burst)
        animate(burst.scale, { x: [0.2, 2.2], y: [0.2, v === 'hit' ? 2.2 : 3], z: [0.2, 2.2], duration: 650, ease: 'outQuad' })
        animate(burst.material, { opacity: [0.9, 0], duration: 650, ease: 'outQuad', onComplete: () => shotsGroup.remove(burst) })
        obj.scale.setScalar(0.2)
        animate(obj.scale, { x: 1, y: 1, z: 1, duration: 500, delay: 250, ease: 'outBack(2)' })
      }
    }
    lastShotKey = lastKey
  }

  function syncPreview(preview) {
    previewGroup.clear()
    if (!preview) return
    const ghost = makeShip(preview.length, false)
    ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({ color: preview.bad ? '#E15A4A' : '#FFFFFF', transparent: true, opacity: 0.5 })
        o.castShadow = false
      }
    })
    const [x0, z0] = cell(preview.row, preview.col)
    const h = preview.dir === 'h'
    ghost.position.set(h ? x0 + (preview.length - 1) / 2 : x0, 0.08, h ? z0 : z0 + (preview.length - 1) / 2)
    ghost.rotation.y = h ? 0 : -Math.PI / 2
    previewGroup.add(ghost)
  }

  function syncLabel(text, color) {
    const key = `${text ?? ''}|${color ?? ''}`
    if (key === labelKey) return
    labelKey = key
    if (label) root.remove(label)
    label = null
    if (!text) return
    label = floorLabel(text, 7, 0.8, { fg: color ? cssColor(color) : '#3A3D45', font: '800 150px "Bricolage Grotesque", system-ui' })
    root.add(label)
  }

  return {
    root,
    /** Moves the sea to (x, z) at the given scale, with its name just below it. */
    place(x, z, scale) {
      root.position.set(x, 0, z)
      inner.scale.setScalar(scale)
      if (label) label.position.set(0, -0.15, (scale * (n + 1.4)) / 2 + NAME / 2)
    },
    update(b, lengths) {
      syncShips(b.ships ?? [], lengths)
      syncShots(b.shots ?? [], b.lastShot)
      syncPreview(b.preview)
      syncLabel(b.label, b.labelColor)
      rim.visible = Boolean(b.highlight)
      if (b.highlight) {
        const c = cssColor(b.highlight)
        rimMat.color.set(c)
        rimMat.emissive.set(c)
        rimMat.emissiveIntensity = 0.25
      }
      instant = false
      if (b.interactive) {
        const shot = new Set((b.shots ?? []).map(([r, c]) => `${r},${c}`))
        cellsGroup.children.forEach((h) => {
          const id = h.userData.rc.join(',')
          if (!b.skipShot || !shot.has(id)) stage.pickable(h, { kind: 'cell', id, marker: h })
        })
      }
    },
    tick(t) {
      if (!stage.reduce) {
        const pos = waves.geo.attributes.position
        for (let i = 0; i < pos.count; i++) {
          const x = waves.base[i * 3]
          const z = waves.base[i * 3 + 2]
          pos.array[i * 3 + 1] = Math.sin(x * 1.3 + t * 1.4) * 0.018 + Math.cos(z * 1.1 + t * 1.1) * 0.018
        }
        pos.needsUpdate = true
        waves.geo.computeVertexNormals()
      }
      // ships bob, flames flicker
      let k = 0
      for (const e of ships.values()) if (!e.key.endsWith('|1')) e.mesh.position.y = 0.05 + Math.sin(t * 1.6 + k++) * 0.015
      shotsGroup.children.forEach((g) => g.children?.forEach((o) => o.userData.flame && o.scale.set(1, 1 + Math.sin(t * 14 + g.id) * 0.15, 1)))
    },
    dispose() {
      root.parent?.remove(root)
    },
  }
}

export function create(container, handlers) {
  let size = 0
  let boards = [] // [{ key, board }]
  let lastFree = 1.6

  // where each sea goes and what the camera must take in
  function layout(aspect, world, freeAspect = lastFree) {
    lastFree = freeAspect
    const F = size + 1.4
    if (boards.length < 2) {
      boards[0]?.board.place(0, 0, 1)
      return { fitHalfWidth: F / 2 + 0.6, fitHalfDepth: F / 2 + 0.6, target: [0, 0, 0] }
    }
    const [a, b] = boards
    if (freeAspect >= 1.2) {
      // side by side, the same size: theirs on the left, yours on the right
      const x = (F + GAP) / 2
      a.board.place(-x, 0, 1)
      b.board.place(x, 0, 1)
      return { fitHalfWidth: F + GAP / 2 + 2.1, fitHalfDepth: (F + NAME) / 2 + 0.4, target: [0, 0, NAME / 2] }
    }
    // stacked: theirs on top, big enough to aim; yours below, smaller
    const zb = F / 2 + NAME + GAP * 0.5 + (SMALL * F) / 2
    a.board.place(0, 0, 1)
    b.board.place(0, zb, SMALL)
    const top = -F / 2
    const bottom = zb + (SMALL * F) / 2 + NAME + 0.5
    return { fitHalfWidth: F / 2 + 0.3, fitHalfDepth: (bottom - top) / 2 + 0.2, target: [0, 0, (top + bottom) / 2] }
  }

  const stage = createStage(container, { fitHalfWidth: 6.0, fitHalfDepth: 6.0, background: '#CFE6F3', tilt: 0.95, portraitTilt: 0.97, target: [0, 0, 0], shadowSize: 13, autoInsets: true, layout }, handlers)
  const { world } = stage

  stage.onFrame((t) => boards.forEach((b) => b.board.tick(t)))

  let current = null
  return {
    update(state) {
      const list = state.boards ?? []
      const keys = list.map((b) => b.key).join('|')
      if (state.size !== size || keys !== boards.map((b) => b.key).join('|')) {
        // a new set of seas (placing → battle): build them fresh
        boards.forEach((b) => b.board.dispose())
        size = state.size
        boards = list.map((b) => {
          const board = makeBoard(stage, size)
          world.add(board.root)
          return { key: b.key, board }
        })
        stage.clearPickables()
        list.forEach((b, i) => boards[i].board.update(b, state.lengths))
        stage.refit()
      } else {
        stage.clearPickables()
        list.forEach((b, i) => boards[i].board.update(b, state.lengths))
      }
      // the names are made on update: put them in place
      layout()
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
