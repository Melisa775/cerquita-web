/**
 * Chess in 3D: a wooden board with turned pieces. Tap one of your pieces to
 * light up where it can go, then tap a glowing square. Moves slide (knights
 * jump), captured pieces pop away, and a king in check glows red.
 * Squares use chess names ("e4"); the board turns around for black.
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, floorLabel, glowRing, hitBox, hop, makeGlow, makeTable, mat, shadowed, vanish } from './kit'
import { animate } from 'animejs'

const FILES = 'abcdefgh'
const WHITE = '#F2EBDD'
const BLACK = '#2E2A28'
const LIGHT = '#E9DFC8'
const DARK = '#7E9A8F'

const sqName = (i) => FILES[i % 8] + (Math.floor(i / 8) + 1)
const sqXZ = (name) => [FILES.indexOf(name[0]) - 3.5, 3.5 - (Number(name[1]) - 1)]

function lathe(points, color, segments = 32) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments), mat(color, { roughness: 0.35 }))
  return m
}

const BASE = [[0, 0], [0.34, 0], [0.35, 0.06], [0.3, 0.1], [0.3, 0.13], [0.24, 0.16]]

/** One chess piece (FEN letter: uppercase white, lowercase black). */
export function makePiece(letter) {
  const color = letter === letter.toUpperCase() ? WHITE : BLACK
  const kind = letter.toLowerCase()
  const g = new THREE.Group()
  if (kind === 'p') {
    g.add(lathe([...BASE, [0.14, 0.32], [0.18, 0.36], [0.11, 0.4], [0.16, 0.48], [0.15, 0.58], [0.08, 0.64], [0, 0.66]], color))
  } else if (kind === 'r') {
    g.add(lathe([...BASE, [0.19, 0.5], [0.24, 0.54], [0.24, 0.66], [0, 0.66]], color, 8))
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.09), mat(color, { roughness: 0.35 }))
      const a = (i / 4) * Math.PI * 2
      b.position.set(Math.cos(a) * 0.18, 0.7, Math.sin(a) * 0.18)
      b.rotation.y = -a
      g.add(b)
    }
  } else if (kind === 'n') {
    g.add(lathe([...BASE, [0.2, 0.24], [0.22, 0.28], [0, 0.28]], color))
    // horse head: an extruded profile, turned to face forward
    const s = new THREE.Shape()
    s.moveTo(-0.16, 0)
    s.lineTo(0.16, 0)
    s.bezierCurveTo(0.2, 0.2, 0.08, 0.3, 0.2, 0.42)
    s.lineTo(0.3, 0.5)
    s.bezierCurveTo(0.32, 0.6, 0.22, 0.66, 0.12, 0.66)
    s.lineTo(0.02, 0.74)
    s.bezierCurveTo(-0.12, 0.7, -0.2, 0.5, -0.16, 0)
    const head = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 }), mat(color, { roughness: 0.35 }))
    head.position.set(0, 0.26, -0.08)
    head.rotation.y = -Math.PI / 2
    g.add(head)
  } else if (kind === 'b') {
    g.add(lathe([...BASE, [0.15, 0.34], [0.2, 0.38], [0.11, 0.44], [0.17, 0.56], [0.15, 0.72], [0.06, 0.82], [0.05, 0.86], [0, 0.88]], color))
  } else if (kind === 'q') {
    g.add(lathe([...BASE, [0.16, 0.4], [0.23, 0.46], [0.13, 0.52], [0.16, 0.74], [0.24, 0.86], [0.15, 0.88], [0, 0.9]], color))
    for (let i = 0; i < 8; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(color, { roughness: 0.35 }))
      const a = (i / 8) * Math.PI * 2
      b.position.set(Math.cos(a) * 0.22, 0.9, Math.sin(a) * 0.22)
      g.add(b)
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), mat(color, { roughness: 0.35 }))
    top.position.y = 0.94
    g.add(top)
  } else if (kind === 'k') {
    g.add(lathe([...BASE, [0.17, 0.42], [0.24, 0.48], [0.14, 0.54], [0.17, 0.8], [0.22, 0.88], [0, 0.9]], color))
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.06), mat(color, { roughness: 0.35 }))
    v.position.y = 1.0
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.06), mat(color, { roughness: 0.35 }))
    h.position.y = 1.02
    g.add(v, h)
  }
  // black pieces look the other way
  if (color === BLACK) g.rotation.y = Math.PI
  g.userData.letter = letter
  return shadowed(g)
}

export function create(container, handlers) {
  const stage = createStage(container, { fitHalfWidth: 4.9, fitHalfDepth: 4.8, background: '#DCD3C3', tilt: 0.8, portraitTilt: 0.9, target: [0, 0, 0.2], minDistance: 4 }, handlers)
  const { world } = stage
  const glow = makeGlow(stage)
  const boardGroup = new THREE.Group()
  const piecesGroup = new THREE.Group()
  const marks = new THREE.Group()
  world.add(boardGroup, piecesGroup, marks)

  // board: 64 squares on a frame, with the file and rank names
  boardGroup.add(makeTable(8, 8, { cloth: '#3B2A20', wood: '#6B4428', border: 0.6, height: 0.35 }))
  const squareGeo = new RoundedBoxGeometry(0.98, 0.06, 0.98, 2, 0.015)
  for (let i = 0; i < 64; i++) {
    const name = sqName(i)
    const [x, z] = sqXZ(name)
    const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 0
    const sq = new THREE.Mesh(squareGeo, mat(dark ? DARK : LIGHT, { roughness: 0.55 }))
    sq.position.set(x, 0.03, z)
    sq.receiveShadow = true
    boardGroup.add(sq)
  }
  const labels = []
  for (let k = 0; k < 8; k++) {
    for (const [txt, x, z] of [[FILES[k], k - 3.5, 4.3], [FILES[k], k - 3.5, -4.3], [String(8 - k), -4.3, k - 3.5], [String(8 - k), 4.3, k - 3.5]]) {
      const l = floorLabel(txt, 0.4, 0.4, { fg: '#E9DFC8', font: '800 150px "Bricolage Grotesque", system-ui' })
      l.position.set(x, 0.002, z)
      boardGroup.add(l)
      labels.push(l)
    }
  }

  const pieces = new Map() // square -> mesh
  let lastKey = null
  let flipped = null
  let selected = null
  let current = null
  const ply = { n: -1 }

  const place = (mesh, name) => {
    const [x, z] = sqXZ(name)
    mesh.position.set(x, 0.06, z)
  }

  // Makes the meshes match the board exactly (after animations, or on first load)
  function reconcile(board) {
    const want = new Map()
    board.forEach((letter, i) => letter && want.set(sqName(i), letter))
    for (const [name, mesh] of pieces) {
      if (want.get(name) !== mesh.userData.letter) {
        piecesGroup.remove(mesh)
        pieces.delete(name)
      }
    }
    for (const [name, letter] of want) {
      if (!pieces.has(name)) {
        const m = makePiece(letter)
        place(m, name)
        piecesGroup.add(m)
        pieces.set(name, m)
      }
    }
  }

  function animateMove(game) {
    const { from, to } = game.lastMove
    const mover = pieces.get(from)
    if (!mover) return reconcile(game.board)
    const victim = pieces.get(to)
    if (victim) {
      pieces.delete(to)
      setTimeout(() => vanish(victim), 180)
    }
    pieces.delete(from)
    pieces.set(to, mover)
    const [x, z] = sqXZ(to)
    const knight = mover.userData.letter.toLowerCase() === 'n'
    hop(mover, [x, 0.06, z], { height: knight ? 0.9 : 0.12, duration: knight ? 480 : 380 }).then(() => {
      // castling, en passant and promotion are fixed up here
      reconcile(game.board)
    })
    // en passant / castling extra moves don't come in lastMove: reconcile after
  }

  function showTargets(game, me, myTurn) {
    marks.clear()
    stage.clearPickables()
    if (!myTurn) return
    const legal = game.legal ?? {}
    // pieces you can move
    for (const from of Object.keys(legal)) {
      const mesh = pieces.get(from)
      if (!mesh) continue
      if (!mesh.userData.hit) {
        const h = hitBox(0.85, 1.0, 0.85)
        h.position.y = 0.45
        mesh.add(h)
        mesh.userData.hit = h
      }
      stage.pickable(mesh, { kind: 'square', id: from, marker: mesh })
    }
    if (!selected || !legal[selected]) return
    const [sx, sz] = sqXZ(selected)
    const sel = glowRing(glow, 0.42, 0.04)
    sel.position.set(sx, 0.08, sz)
    marks.add(sel)
    for (const to of legal[selected]) {
      const [x, z] = sqXZ(to)
      const capture = pieces.has(to)
      const m = capture ? glowRing(glow, 0.44, 0.05) : new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.03, 24), glow)
      m.position.set(x, 0.08, z)
      marks.add(m)
      const hit = hitBox(0.96, 0.4, 0.96)
      hit.position.set(x, 0.2, z)
      marks.add(hit)
      stage.pickable(hit, { kind: 'target', id: to, marker: m, priority: 2 })
      if (!stage.reduce) {
        m.scale.setScalar(0.01)
        animate(m.scale, { x: 1, y: 1, z: 1, duration: 260, ease: 'outBack(2)' })
      }
    }
  }

  const lastMarks = new THREE.Group()
  world.add(lastMarks)
  function showLastMove(game) {
    lastMarks.clear()
    const add = (name, color, opacity) => {
      if (!name) return
      const [x, z] = sqXZ(name)
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }))
      m.rotation.x = -Math.PI / 2
      m.position.set(x, 0.062, z)
      lastMarks.add(m)
    }
    if (game.lastMove) {
      add(game.lastMove.from, '#F7C948', 0.35)
      add(game.lastMove.to, '#F7C948', 0.5)
    }
    if (game.check) add(game.check, '#D63031', 0.6)
  }

  stage.onFrame((t) => {
    marks.children.forEach((m, i) => m.material === glow && m.scale.x > 0.5 && m.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.08))
  })

  return {
    update(state) {
      const { game, me, myTurn, select } = state
      const flip = (game.colors[me] ?? 'w') === 'b'
      if (flip !== flipped) {
        flipped = flip
        world.rotation.y = flip ? Math.PI : 0
        labels.forEach((l) => (l.rotation.z = flip ? Math.PI : 0)) // keep the coordinates readable
      }
      const key = game.lastMove ? `${game.moves.length}:${game.lastMove.from}${game.lastMove.to}` : `${game.moves.length}`
      if (ply.n === -1 || game.moves.length < ply.n || !game.lastMove) reconcile(game.board)
      else if (key !== lastKey && game.moves.length === ply.n + 1) animateMove(game)
      else if (key !== lastKey) reconcile(game.board)
      lastKey = key
      ply.n = game.moves.length
      selected = select ?? null
      showLastMove(game)
      showTargets(game, me, myTurn)
      current = state
    },
    get state() {
      return current
    },
    resetView: stage.resetView,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose: stage.dispose,
  }
}
