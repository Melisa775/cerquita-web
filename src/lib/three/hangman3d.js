/**
 * Hangman in 3D: a wooden gallows that gets built and a little wooden doll
 * whose parts appear with every mistake, behind a shelf with the word as
 * letter tiles. A found letter turns its tile over; when they win the doll
 * climbs down and jumps, when they lose it swings.
 *
 * state: { slots, misses, lives, over, won, isSetter, color, round }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, makeLetterTile, mat, shadowed } from './kit'
import { animate } from 'animejs'

const GALLOWS = ['base', 'pole', 'beam', 'rope']
const BODY = ['head', 'body', 'armL', 'armR', 'legL', 'legR']
const T = 0.62 // tile size
const GAP = 0.7
const MAX_ROW = 11

export function create(container, handlers) {
  let rows = 1
  const stage = createStage(
    container,
    {
      background: '#E3E8EE',
      tilt: 0.55,
      portraitTilt: 0.62,
      maxPolar: 1.35,
      target: [0, 1.3, 1.9],
      shadowSize: 6,
      layout: (aspect) => ({ fitHalfWidth: 4.4, fitHalfDepth: aspect < 0.9 ? 5.4 + rows * 0.3 : 4.9 + rows * 0.35 }),
    },
    handlers,
  )
  const { world } = stage
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 60), mat('#CBD5DD', { roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  world.add(shadowed(floor, false, true))

  /* -- gallows ------------------------------------------------------------------ */
  const wood = mat('#8B5E3C', { roughness: 0.7 })
  const gallows = new THREE.Group()
  gallows.position.set(-0.6, 0, -1.2)
  const parts = {}
  parts.base = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.25, 1.4, 2, 0.05), wood)
  parts.base.position.set(0, 0.125, 0)
  parts.pole = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 0.22), wood)
  parts.pole.position.set(-1.1, 2.3, 0)
  parts.beam = new THREE.Group()
  const beamBar = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.2, 0.22), wood)
  beamBar.position.set(-0.05, 4.3, 0)
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), wood)
  brace.position.set(-0.75, 3.85, 0)
  brace.rotation.z = -Math.PI / 4
  parts.beam.add(beamBar, brace)
  parts.rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.7, 8), mat('#C9A86A', { roughness: 0.9 }))
  parts.rope.position.set(1.0, 3.85, 0)
  GALLOWS.forEach((k) => gallows.add(parts[k]))
  world.add(shadowed(gallows))

  /* -- the doll -------------------------------------------------------------------- */
  const doll = new THREE.Group() // hangs from the rope's end
  doll.position.set(1.0, 3.5, 0)
  gallows.add(doll)
  const dollMat = new THREE.MeshStandardMaterial({ color: '#22252E', roughness: 0.5 })
  const skin = mat('#F2D6B8', { roughness: 0.6 })
  const limb = (len, r = 0.07) => {
    const g = new THREE.Group()
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), dollMat)
    m.position.y = -len / 2 - r
    g.add(m)
    return g
  }
  const bodyParts = {}
  bodyParts.head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 18), skin)
  bodyParts.head.position.y = -0.3
  const eyes = new THREE.Group()
  for (const x of [-0.1, 0.1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat('#22252E'))
    e.position.set(x, 0.04, 0.27)
    eyes.add(e)
  }
  bodyParts.head.add(eyes)
  bodyParts.body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.6, 4, 12), dollMat)
  bodyParts.body.position.y = -0.98
  bodyParts.armL = limb(0.5)
  bodyParts.armL.position.set(-0.17, -0.75, 0)
  bodyParts.armL.rotation.z = -0.6
  bodyParts.armR = limb(0.5)
  bodyParts.armR.position.set(0.17, -0.75, 0)
  bodyParts.armR.rotation.z = 0.6
  bodyParts.legL = limb(0.6, 0.08)
  bodyParts.legL.position.set(-0.1, -1.3, 0)
  bodyParts.legL.rotation.z = -0.25
  bodyParts.legR = limb(0.6, 0.08)
  bodyParts.legR.position.set(0.1, -1.3, 0)
  bodyParts.legR.rotation.z = 0.25
  BODY.forEach((k) => doll.add(bodyParts[k]))
  shadowed(doll)

  /* -- word shelf ----------------------------------------------------------------------- */
  const shelf = new THREE.Group()
  world.add(shelf)
  let tiles = [] // per slot: tile or null
  let wordKey = ''

  function layout(slots) {
    // break into words, then words into rows that fit the shelf
    const words = [[]]
    slots.forEach((s, i) => (s.char === ' ' ? words.push([]) : words.at(-1).push(i)))
    const lines = [[]]
    for (const w of words.filter((x) => x.length)) {
      const line = lines.at(-1)
      const len = line.length ? line.length + 1 + w.length : w.length
      if (line.length && len > MAX_ROW) lines.push([...w])
      else {
        if (line.length) line.push(null)
        line.push(...w)
      }
    }
    return lines
  }

  function buildShelf(slots) {
    shelf.clear()
    tiles = slots.map(() => null)
    const lines = layout(slots)
    rows = lines.length
    lines.forEach((line, li) => {
      const z = 1.6 + li * 0.95
      const width = line.length * GAP
      const board = new THREE.Mesh(new RoundedBoxGeometry(width + 0.5, 0.18, 0.85, 2, 0.05), mat('#6E4A2E', { roughness: 0.6 }))
      board.position.set(0, 0.35 - li * 0.08, z)
      shelf.add(board)
      line.forEach((i, k) => {
        if (i == null) return
        const s = slots[i]
        const x = (k - (line.length - 1) / 2) * GAP
        if (!s.letter) {
          // punctuation stays printed, standing
          const t = makeLetterTile(T, { thickness: 0.1 })
          t.userData.setTop(s.char)
          t.position.set(x, 0.5 - li * 0.08, z)
          shelf.add(t)
          return
        }
        const t = makeLetterTile(T, { thickness: 0.12 })
        t.position.set(x, 0.5 - li * 0.08, z)
        t.userData.state = null
        shelf.add(t)
        tiles[i] = t
      })
    })
    shadowed(shelf)
    stage.refit()
  }

  function syncTiles(state) {
    state.slots.forEach((s, i) => {
      const t = tiles[i]
      if (!t) return
      const missed = state.over && !s.found
      const ghost = state.isSetter && !s.found && !state.over
      const st = s.found ? 'found' : missed ? 'missed' : ghost ? 'ghost' : 'hidden'
      if (st === t.userData.state) return
      const first = t.userData.state === null
      t.userData.state = st
      if (st === 'hidden') {
        t.userData.setTop('', { bg: '#E9DFC8' })
        t.rotation.x = 0
        return
      }
      if (st === 'ghost') {
        t.userData.setTop(s.char, { bg: '#EFE8D8', fg: '#C9C2B2' })
        return
      }
      const face = st === 'found' ? { bg: state.color, fg: '#FFFFFF' } : { bg: '#FBEDEA', fg: '#C4473A' }
      t.userData.setBottom(s.char, face)
      if (first || stage.reduce) {
        t.rotation.x = Math.PI
        return
      }
      // turns over with a little hop
      const y = t.position.y
      animate(t.position, { y: [y, y + 0.5, y], duration: 480, delay: i * 40, ease: 'inOutQuad' })
      animate(t.rotation, { x: [0, Math.PI], duration: 480, delay: i * 40, ease: 'inOutCubic' })
    })
  }

  let shown = -1
  let ending = null
  let current = null
  function syncDrawing(state) {
    const pre = GALLOWS.length + BODY.length - state.lives
    const count = Math.min(GALLOWS.length + BODY.length, pre + state.misses)
    if (count === shown && ending === (state.over ? (state.won ? 'won' : 'lost') : null)) return
    const fresh = shown < 0
    const before = shown
    shown = count
    dollMat.color.set(state.color)
    const all = [...GALLOWS.map((k) => parts[k]), ...BODY.map((k) => bodyParts[k])]
    all.forEach((obj, i) => {
      const vis = i < count || (state.over && state.won && i >= GALLOWS.length)
      const was = obj.visible
      obj.visible = vis
      // a new part pops in
      if (vis && !was && !fresh && i >= before && !stage.reduce) {
        obj.scale.setScalar(0.01)
        animate(obj.scale, { x: 1, y: 1, z: 1, duration: 420, ease: 'outBack(2.5)' })
      }
    })
    const end = state.over ? (state.won ? 'won' : 'lost') : null
    if (end !== ending) {
      ending = end
      if (end === 'won') {
        // the doll climbs down and celebrates with arms up
        parts.rope.visible = false
        animate(doll.position, { x: 1.9, y: 1.95, duration: 700, ease: 'outBack(1.2)' })
        animate(bodyParts.armL.rotation, { z: -2.6, duration: 400 })
        animate(bodyParts.armR.rotation, { z: 2.6, duration: 400 })
      } else {
        doll.position.set(1.0, 3.5, 0)
        bodyParts.armL.rotation.z = -0.6
        bodyParts.armR.rotation.z = 0.6
      }
    }
  }

  stage.onFrame((t) => {
    if (ending === 'won') doll.position.y = 1.95 + Math.abs(Math.sin(t * 6)) * 0.35
    else if (ending === 'lost') doll.rotation.z = Math.sin(t * 2) * 0.18
    else doll.rotation.z = Math.sin(t * 1.3) * 0.03
  })

  return {
    update(state) {
      const k = `${state.round}|${state.slots.map((s) => (s.letter ? '_' : s.char)).join('')}`
      if (k !== wordKey) {
        wordKey = k
        buildShelf(state.slots)
        shown = -1
        ending = null
        doll.rotation.z = 0
        doll.position.set(1.0, 3.5, 0)
        bodyParts.armL.rotation.z = -0.6
        bodyParts.armR.rotation.z = 0.6
      }
      syncTiles(state)
      syncDrawing(state)
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
