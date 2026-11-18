/**
 * Living 3D background for the home page and the lobby: dice, domino tiles,
 * cards, game pieces and hearts floating slowly in the players' colors. The
 * camera leans toward the pointer and the objects drift with the scroll.
 *
 * Plain three.js, loaded on demand (see components/Backdrop3D.jsx), so it
 * never weighs on the first load. `mountBackdrop` returns a controller to
 * pause, resume and dispose the scene.
 */
import {
  AmbientLight,
  Color,
  CylinderGeometry,
  DirectionalLight,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  SphereGeometry,
  WebGLRenderer,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const P1 = '#0F6E6A'
const P2 = '#B23A5A'
const GOLD = '#F2C43D'
const CORAL = '#E8734A'
const SKY = '#4A9FD8'
const CREAM = '#F7F5EF'
const INK = '#22252E'

// Pip positions on a die face, in units of the half face size
const PIPS = {
  1: [[0, 0]],
  2: [[-0.5, -0.5], [0.5, 0.5]],
  3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0], [0.5, 0], [-0.5, 0.55], [0.5, 0.55]],
}

function material(color, extra = {}) {
  return new MeshStandardMaterial({ color: new Color(color), roughness: 0.45, metalness: 0.05, ...extra })
}

function makeDie(pipMat) {
  const g = new Group()
  g.add(new Mesh(new RoundedBoxGeometry(1, 1, 1, 4, 0.16), material(CREAM)))
  const pip = new SphereGeometry(0.085, 12, 8)
  // faces: +x 1, -x 6, +y 2, -y 5, +z 3, -z 4 (opposite faces add up to 7)
  const faces = [
    [1, (u, v) => [0.5, v, u]], [6, (u, v) => [-0.5, v, u]],
    [2, (u, v) => [u, 0.5, v]], [5, (u, v) => [u, -0.5, v]],
    [3, (u, v) => [u, v, 0.5]], [4, (u, v) => [u, v, -0.5]],
  ]
  for (const [n, at] of faces) {
    for (const [u, v] of PIPS[n]) {
      const m = new Mesh(pip, pipMat)
      m.position.set(...at(u * 0.5, v * 0.5))
      m.scale.setScalar(0.9)
      g.add(m)
    }
  }
  return g
}

function makeDomino(pipMat) {
  const g = new Group()
  g.add(new Mesh(new RoundedBoxGeometry(0.62, 1.2, 0.16, 3, 0.06), material(CREAM)))
  const line = new Mesh(new RoundedBoxGeometry(0.46, 0.03, 0.02, 1, 0.01), pipMat)
  line.position.z = 0.085
  g.add(line)
  const pip = new SphereGeometry(0.05, 10, 6)
  const halves = [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)]
  halves.forEach((n, h) => {
    for (const [u, v] of PIPS[n]) {
      const m = new Mesh(pip, pipMat)
      m.position.set(u * 0.36, (h ? -0.3 : 0.3) + v * 0.36, 0.08)
      m.scale.z = 0.5
      g.add(m)
    }
  })
  return g
}

function makeCard(color) {
  const g = new Group()
  g.add(new Mesh(new RoundedBoxGeometry(0.78, 1.12, 0.03, 2, 0.012), material(color)))
  const oval = new Mesh(new CylinderGeometry(0.24, 0.24, 0.035, 32), material('#FFFFFF'))
  oval.rotation.x = Math.PI / 2
  oval.scale.set(1, 1, 1.55)
  oval.rotation.z = 0.5
  g.add(oval)
  return g
}

function makePiece(color) {
  const g = new Group()
  const base = new Mesh(new CylinderGeometry(0.34, 0.38, 0.22, 40), material(color))
  const top = new Mesh(new SphereGeometry(0.24, 24, 16), material(color))
  top.position.y = 0.26
  g.add(base, top)
  return g
}

function makeHeart(color) {
  const s = new Shape()
  s.moveTo(0, -0.45)
  s.bezierCurveTo(-0.15, -0.3, -0.55, -0.05, -0.55, 0.22)
  s.bezierCurveTo(-0.55, 0.48, -0.3, 0.6, -0.12, 0.52)
  s.bezierCurveTo(-0.04, 0.48, 0, 0.42, 0, 0.36)
  s.bezierCurveTo(0, 0.42, 0.04, 0.48, 0.12, 0.52)
  s.bezierCurveTo(0.3, 0.6, 0.55, 0.48, 0.55, 0.22)
  s.bezierCurveTo(0.55, -0.05, 0.15, -0.3, 0, -0.45)
  const geo = new ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 4, curveSegments: 18 })
  geo.center()
  return new Mesh(geo, material(color))
}

export function mountBackdrop(canvas, { reduced = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  const scene = new Scene()
  const camera = new PerspectiveCamera(40, 1, 1, 100)
  camera.position.set(0, 0, 16)

  scene.add(new HemisphereLight('#ffffff', '#c9ccd3', 1.1))
  scene.add(new AmbientLight('#ffffff', 0.35))
  const sun = new DirectionalLight('#ffffff', 1.6)
  sun.position.set(4, 6, 8)
  scene.add(sun)

  const pipMat = material(INK, { roughness: 0.6 })
  const small = window.innerWidth < 700
  const makers = [
    () => makeDie(pipMat), () => makeDie(pipMat), () => makeDie(pipMat),
    () => makeDomino(pipMat), () => makeDomino(pipMat),
    () => makeCard(CORAL), () => makeCard(SKY), () => makeCard(GOLD), () => makeCard(P1),
    () => makePiece(P1), () => makePiece(P2), () => makePiece(P1), () => makePiece(P2),
    () => makeHeart(P2), () => makeHeart(CORAL), () => makeHeart(P2),
  ]
  const count = small ? 8 : makers.length + 6
  const things = []
  for (let i = 0; i < count; i++) {
    const obj = makers[i % makers.length]()
    // Spread over a shallow slab, but outside the central column where the text lives.
    // On phones the text takes the whole width, so objects stay far back instead.
    const depth = small ? MathUtils.randFloat(-12, -6) : MathUtils.randFloat(-9, 2)
    const halfW = Math.tan(MathUtils.degToRad(20)) * (16 - depth) * (window.innerWidth / window.innerHeight)
    const keepOut = small ? 0 : 6.2 * (16 - depth) / 16
    const side = i % 2 ? 1 : -1
    const x = small ? MathUtils.randFloatSpread(halfW * 2) : side * MathUtils.randFloat(Math.min(keepOut, halfW * 0.8), halfW * 0.98)
    obj.userData = {
      base: [x, MathUtils.randFloatSpread(small ? 22 : 16), depth],
      spin: [MathUtils.randFloatSpread(0.5), MathUtils.randFloatSpread(0.5), MathUtils.randFloatSpread(0.3)],
      phase: Math.random() * Math.PI * 2,
      bob: MathUtils.randFloat(0.25, 0.6),
      scroll: MathUtils.mapLinear(depth, -9, 2, 0.15, 0.55), // nearer objects drift faster with the scroll
    }
    obj.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
    obj.scale.setScalar(MathUtils.randFloat(0.75, 1.15))
    scene.add(obj)
    things.push(obj)
  }

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
  const onPointer = (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1
  }
  window.addEventListener('pointermove', onPointer, { passive: true })

  // On phones the address bar comes and goes while scrolling and fires resize
  // events; resizing clears the canvas (a flash). Only resize when the width
  // changes or the height changes a lot, and redraw right away.
  let size = [0, 0]
  const resize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    if (w === size[0] && Math.abs(h - size[1]) < 160) return
    size = [w, h]
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.render(scene, camera)
  }
  resize()
  window.addEventListener('resize', resize)

  let raf = 0
  let running = false
  let last = performance.now()
  let t = 0

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    t += dt
    pointer.x += (pointer.tx - pointer.x) * 0.04
    pointer.y += (pointer.ty - pointer.y) * 0.04
    camera.position.x = pointer.x * 1.4
    camera.position.y = -pointer.y * 0.9
    camera.lookAt(0, 0, 0)
    const scrollShift = window.scrollY / 120
    for (const o of things) {
      const d = o.userData
      o.position.set(d.base[0], d.base[1] + Math.sin(t * d.bob + d.phase) * 0.35 + scrollShift * d.scroll, d.base[2])
      o.rotation.x += d.spin[0] * dt
      o.rotation.y += d.spin[1] * dt
      o.rotation.z += d.spin[2] * dt
    }
    renderer.render(scene, camera)
    if (running) raf = requestAnimationFrame(frame)
  }

  const controller = {
    start() {
      if (running) return
      if (reduced) {
        frame(performance.now()) // a single still frame
        return
      }
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    dispose() {
      controller.stop()
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', resize)
      scene.traverse((o) => {
        o.geometry?.dispose()
        if (o.material && o.material !== pipMat) o.material.dispose()
      })
      pipMat.dispose()
      renderer.dispose()
    },
  }
  return controller
}
