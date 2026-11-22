/**
 * Murdoku as a little 3D crime-scene diorama: each room has its own floor
 * color and low walls around it, furniture stands in its cells, and the
 * suspects are cardboard standees you place on the floor. Empty cells can be
 * crossed out with an X. When someone is selected, the rows and columns
 * already taken get darker.
 *
 * state: { game, portraits: { index: svg }, selected, canEdit, colors: { player: css } }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, canvasTexture, floorLabel, glowRing, hitBox, makeGlow, mat, roundedPlane, shadowed } from './kit'
import { animate } from 'animejs'

const ROOM_COLORS = ['#F6E3C6', '#DCEBDD', '#DDE6F4', '#F2DCE5', '#E8E1F2', '#F4EEC9']
const CELL = 1
const BLOCKING = new Set(['table', 'plant', 'shelf'])

/* -- furniture ---------------------------------------------------------------- */

function furniture(kind) {
  const g = new THREE.Group()
  const wood = mat('#8A5A3B', { roughness: 0.6 })
  const dark = mat('#6E4630', { roughness: 0.6 })
  if (kind === 'table') {
    const top = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.07, 0.6, 2, 0.02), wood)
    top.position.y = 0.42
    g.add(top)
    for (const [x, z] of [[-0.32, -0.23], [0.32, -0.23], [-0.32, 0.23], [0.32, 0.23]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), dark)
      leg.position.set(x, 0.2, z)
      g.add(leg)
    }
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.16, 12), mat('#3B7DC4'))
    vase.position.set(0.12, 0.54, 0)
    g.add(vase)
  } else if (kind === 'plant') {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.28, 16), mat('#C46F42'))
    pot.position.y = 0.14
    g.add(pot)
    const leaf = mat('#3E9460', { roughness: 0.7 })
    for (let i = 0; i < 6; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leaf)
      const a = (i / 6) * Math.PI * 2
      l.scale.set(0.6, 1.4, 0.6)
      l.position.set(Math.cos(a) * 0.1, 0.48, Math.sin(a) * 0.1)
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5)
      g.add(l)
    }
  } else if (kind === 'shelf') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.3), wood)
    box.position.y = 0.45
    g.add(box)
    const colors = ['#B23A5A', '#3B7DC4', '#3E9460', '#D08A2E']
    for (let s = 0; s < 3; s++) {
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.22, 0.02), mat('#F2E6C9'))
      back.position.set(0, 0.17 + s * 0.27, 0.15)
      g.add(back)
      for (let b = 0; b < 4; b++) {
        const book = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.16 + ((b + s) % 3) * 0.02, 0.18), mat(colors[(b + s) % 4]))
        book.position.set(-0.22 + b * 0.1 + s * 0.04, 0.16 + s * 0.27, 0.07)
        g.add(book)
      }
    }
  } else if (kind === 'chair') {
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.05, 0.4, 2, 0.015), mat('#B07A52'))
    seat.position.y = 0.26
    const back = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.34, 0.05, 2, 0.015), mat('#B07A52'))
    back.position.set(0, 0.45, -0.18)
    g.add(seat, back)
    for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.04), dark)
      leg.position.set(x, 0.13, z)
      g.add(leg)
    }
    g.scale.setScalar(0.8)
    g.position.x = 0.22
    g.position.z = -0.18
  } else if (kind === 'rug') {
    const tex = canvasTexture(
      128,
      96,
      (ctx) => {
        ctx.fillStyle = '#B23A5A'
        ctx.beginPath()
        ctx.roundRect(0, 0, 128, 96, 12)
        ctx.fill()
        ctx.strokeStyle = '#F2E6C9'
        ctx.lineWidth = 6
        ctx.strokeRect(14, 14, 100, 68)
        ctx.fillStyle = '#F2E6C9'
        ctx.beginPath()
        ctx.arc(64, 48, 12, 0, Math.PI * 2)
        ctx.fill()
      },
      'md|rug',
    )
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.66), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 1 }))
    rug.rotation.x = -Math.PI / 2
    rug.position.y = 0.012
    rug.receiveShadow = true
    g.add(rug)
    return g
  }
  return shadowed(g)
}

/* -- standees ----------------------------------------------------------------- */

const portraitCache = new Map()
function portraitTexture(key, svg) {
  if (portraitCache.has(key)) return portraitCache.get(key)
  const tex = canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#EEE'
    ctx.fillRect(0, 0, 256, 256)
  })
  const img = new Image()
  img.onload = () => {
    tex.image.getContext('2d').drawImage(img, 0, 0, 256, 256)
    tex.needsUpdate = true
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  portraitCache.set(key, tex)
  return tex
}

function standee(person, svg, ring) {
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.05, 28), mat(ring, { roughness: 0.4 }))
  base.position.y = 0.025
  const stand = new THREE.Group() // the board leans back a little so its face looks up at the camera
  stand.rotation.x = -0.3
  stand.position.z = 0.05
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.66, 0.03, 2, 0.06), mat('#FFFFFF', { roughness: 0.5 }))
  board.position.y = 0.4
  const face = new THREE.Mesh(roundedPlane(0.56, 0.6, 0.05), new THREE.MeshStandardMaterial({ map: portraitTexture(`${person.index}|${svg.length}`, svg), roughness: 0.6 }))
  face.position.set(0, 0.4, 0.016)
  if (person.role === 'victim') face.material.color.setScalar(0.75)
  const back = new THREE.Mesh(roundedPlane(0.56, 0.6, 0.05), mat(ring))
  back.rotation.y = Math.PI
  back.position.set(0, 0.4, -0.016)
  stand.add(board, face, back)
  g.add(base, stand)
  g.userData.face = face
  return shadowed(g)
}

export function create(container, handlers) {
  let n = 6
  const stage = createStage(
    container,
    { background: '#E6DFD3', tilt: 0.86, portraitTilt: 0.93, target: [0, 0, 0.75], shadowSize: 5, layout: () => ({ fitHalfWidth: n / 2 + 0.55, fitHalfDepth: n / 2 + 1.3 }) },
    handlers,
  )
  const { world } = stage
  const glow = makeGlow(stage)
  const planGroup = new THREE.Group()
  const peopleGroup = new THREE.Group()
  const notesGroup = new THREE.Group()
  const shade = new THREE.Group()
  const marks = new THREE.Group()
  world.add(planGroup, peopleGroup, notesGroup, shade, marks)

  let current = null
  let planKey = ''
  const cells = [] // hit boxes
  const people = new Map() // index -> { mesh, key }

  const at = (r, c) => [(c - (n - 1) / 2) * CELL, (r - (n - 1) / 2) * CELL]

  function buildPlan(game) {
    planGroup.clear()
    cells.length = 0
    n = game.size
    const rooms = game.rooms
    // base under the house
    const base = new THREE.Mesh(new RoundedBoxGeometry(n * CELL + 0.5, 0.3, n * CELL + 0.5, 3, 0.1), mat('#4A3F3A', { roughness: 0.8 }))
    base.position.y = -0.16
    planGroup.add(base)
    const labelAt = {}
    rooms.forEach((row, r) => row.forEach((k, c) => !(k in labelAt) && (labelAt[k] = [r, c])))
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const k = rooms[r][c]
        const [x, z] = at(r, c)
        const floor = new THREE.Mesh(new THREE.BoxGeometry(CELL, 0.04, CELL), mat(ROOM_COLORS[k % ROOM_COLORS.length], { roughness: 0.85 }))
        floor.position.set(x, -0.02, z)
        planGroup.add(floor)
        const hit = hitBox(CELL * 0.98, 0.5, CELL * 0.98)
        hit.position.set(x, 0.25, z)
        hit.userData.rc = [r, c]
        planGroup.add(hit)
        cells.push(hit)
      }
    }
    // thin lines between cells, walls between rooms and around the house
    const lineMat = new THREE.LineBasicMaterial({ color: '#22252E', transparent: true, opacity: 0.16 })
    const pts = []
    const wallMat = mat('#FBF7EF', { roughness: 0.6 })
    const wallTop = mat('#22252E', { roughness: 0.6 })
    const wall = (x, z, w, d) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.32, d), wallMat)
      m.position.set(x, 0.16, z)
      const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.02, d), wallTop)
      top.position.y = 0.17
      m.add(top)
      planGroup.add(m)
    }
    const half = (n * CELL) / 2
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const [x, z] = at(r, c)
        if (c < n - 1) {
          if (rooms[r][c] !== rooms[r][c + 1]) wall(x + CELL / 2, z, 0.07, CELL + 0.07)
          else pts.push(x + CELL / 2, 0.002, z - CELL / 2, x + CELL / 2, 0.002, z + CELL / 2)
        }
        if (r < n - 1) {
          if (rooms[r][c] !== rooms[r + 1][c]) wall(x, z + CELL / 2, CELL + 0.07, 0.07)
          else pts.push(x - CELL / 2, 0.002, z + CELL / 2, x + CELL / 2, 0.002, z + CELL / 2)
        }
      }
    }
    // outer walls: lower in front so nothing hides behind them
    wall(0, -half, n * CELL + 0.1, 0.1)
    wall(-half, 0, 0.1, n * CELL + 0.1)
    wall(half, 0, 0.1, n * CELL + 0.1)
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    planGroup.add(new THREE.LineSegments(lg, lineMat))

    // room names on the floor
    for (const [k, [r, c]] of Object.entries(labelAt)) {
      const [x, z] = at(r, c)
      const lab = floorLabel(game.roomNames[k].toUpperCase(), 0.9, 0.18, { fg: 'rgba(34,37,46,.55)', font: '800 120px "Instrument Sans", system-ui', y: 0.55 })
      lab.position.set(x, 0.005, z - CELL / 2 + 0.12)
      planGroup.add(lab)
    }
    // furniture
    for (const o of game.objects) {
      const [x, z] = at(o.cell[0], o.cell[1])
      const f = furniture(o.kind)
      f.position.x += x
      f.position.z += z
      planGroup.add(f)
    }
    shadowed(planGroup, true, true)
    if (!stage.reduce) {
      planGroup.scale.setScalar(0.85)
      animate(planGroup.scale, { x: 1, y: 1, z: 1, duration: 650, ease: 'outBack(1.6)' })
    }
  }

  function syncPeople(state) {
    const { game, portraits, colors } = state
    const placed = game.placed
    const seen = new Set()
    for (const [pid, v] of Object.entries(placed)) {
      const person = game.people[Number(pid)]
      const ring = v.by ? colors[v.by] ?? '#FFFFFF' : '#FFFFFF'
      const key = `${ring}|${portraits[pid]?.length ?? 0}`
      seen.add(pid)
      let entry = people.get(pid)
      const [x, z] = at(v.cell[0], v.cell[1])
      if (!entry || entry.key !== key) {
        if (entry) peopleGroup.remove(entry.mesh)
        const mesh = standee(person, portraits[pid] ?? '', ring)
        mesh.position.set(x, 0, z + 0.08)
        peopleGroup.add(mesh)
        if (!entry && !stage.reduce) {
          mesh.position.y = 1.2
          mesh.scale.setScalar(0.4)
          animate(mesh.position, { y: 0, duration: 600, ease: 'outBounce' })
          animate(mesh.scale, { x: 1, y: 1, z: 1, duration: 420, ease: 'outBack(2)' })
        }
        entry = { mesh, key, cell: v.cell.join(',') }
        people.set(pid, entry)
      } else if (entry.cell !== v.cell.join(',')) {
        // moved: hops across the plan
        entry.cell = v.cell.join(',')
        const m = entry.mesh
        if (stage.reduce) m.position.set(x, 0, z + 0.08)
        else {
          const from = m.position.clone()
          const k = { t: 0 }
          animate(k, {
            t: 1,
            duration: 480,
            ease: 'inOutQuad',
            onUpdate: () => {
              m.position.x = from.x + (x - from.x) * k.t
              m.position.z = from.z + (z + 0.08 - from.z) * k.t
              m.position.y = Math.sin(k.t * Math.PI) * 0.7
            },
          })
        }
      }
    }
    for (const [pid, e] of people) {
      if (!seen.has(pid)) {
        peopleGroup.remove(e.mesh)
        people.delete(pid)
      }
    }
  }

  function syncNotes(game) {
    notesGroup.clear()
    const occupied = new Set(Object.values(game.placed).map((v) => v.cell.join(',')))
    const xMat = mat('#C4473A', { roughness: 0.6 })
    for (const [r, c] of game.notes) {
      if (occupied.has(`${r},${c}`)) continue
      const [x, z] = at(r, c)
      const g = new THREE.Group()
      for (const a of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.07), xMat)
        bar.rotation.y = a
        g.add(bar)
      }
      g.position.set(x, 0.02, z)
      notesGroup.add(g)
    }
  }

  function syncShade(state) {
    shade.clear()
    marks.clear()
    const { game, selected } = state
    if (selected == null) return
    const rows = new Set()
    const cols = new Set()
    for (const [pid, v] of Object.entries(game.placed)) {
      if (Number(pid) === selected) continue
      rows.add(v.cell[0])
      cols.add(v.cell[1])
    }
    const dim = new THREE.MeshBasicMaterial({ color: '#22252E', transparent: true, opacity: 0.34, depthWrite: false })
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!rows.has(r) && !cols.has(c)) continue
        const [x, z] = at(r, c)
        const p = new THREE.Mesh(new THREE.PlaneGeometry(CELL, CELL), dim)
        p.rotation.x = -Math.PI / 2
        p.position.set(x, 0.004, z)
        shade.add(p)
      }
    }
    // the selected person glows where they stand
    const v = game.placed[String(selected)]
    if (v) {
      const [x, z] = at(v.cell[0], v.cell[1])
      const ring = glowRing(glow, 0.4, 0.03)
      ring.position.set(x, 0.03, z)
      marks.add(ring)
    }
  }

  function highlightReveal(game) {
    if (game.phase !== 'round_over' || !game.result) return
    const m = people.get(String(game.result.murderer))
    if (m && !m.revealed && !stage.reduce) {
      m.revealed = true
      animate(m.mesh.position, { y: [0, 0.6, 0], duration: 700, ease: 'outBounce' })
      animate(m.mesh.rotation, { y: [0, Math.PI * 2], duration: 900, ease: 'inOutQuad' })
    }
  }

  stage.onFrame((t) => marks.children.forEach((m) => m.scale.setScalar(1 + Math.sin(t * 4) * 0.08)))

  return {
    update(state) {
      const { game } = state
      const key = `${game.round}|${game.size}|${JSON.stringify(game.rooms)}`
      if (key !== planKey) {
        planKey = key
        people.forEach((e) => peopleGroup.remove(e.mesh))
        people.clear()
        const resized = game.size !== n
        buildPlan(game)
        if (resized) stage.refit()
      }
      syncPeople(state)
      syncNotes(game)
      syncShade(state)
      highlightReveal(game)
      stage.clearPickables()
      if (state.canEdit) {
        const objects = new Map(game.objects.map((o) => [o.cell.join(','), o.kind]))
        for (const h of cells) {
          const id = h.userData.rc.join(',')
          if (BLOCKING.has(objects.get(id))) continue
          stage.pickable(h, { kind: 'cell', id, marker: h })
        }
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
