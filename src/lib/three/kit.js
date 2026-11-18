/**
 * Reusable 3D pieces for the boards: materials, dice, pawns, tables,
 * printed text, cards and the little animations they all share.
 */
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { animate } from 'animejs'
import { reducedMotion } from './stage'

export const INK = '#22252E'
export { RoundedBoxGeometry }

const matCache = new Map()
/** Shared (cached) standard material; safe to reuse across meshes. */
export function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`
  if (!matCache.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts })
    m.userData.shared = true
    matCache.set(key, m)
  }
  return matCache.get(key)
}

export function shadowed(obj, cast = true, receive = true) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = cast
      o.receiveShadow = receive
    }
  })
  return obj
}

export function seeded(seed) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

export function darker(color, f = 0.72) {
  return new THREE.Color(color).multiplyScalar(f)
}

/** Resolves CSS colors like var(--color-p1) to something three.js understands. */
export function cssColor(value) {
  const m = /var\((--[^)]+)\)/.exec(value ?? '')
  if (!m) return value
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888888'
}

/* --- animations ---------------------------------------------------------- */

/** A new piece drops onto the board with a bounce. */
export function dropIn(obj, { from = 1.2, delay = 0 } = {}) {
  if (reducedMotion()) return
  const y = obj.position.y
  obj.position.y = y + from
  obj.scale.setScalar(0.4)
  animate(obj.position, { y, duration: 650, delay, ease: 'outBounce' })
  animate(obj.scale, { x: 1, y: 1, z: 1, duration: 450, delay, ease: 'outBack(2)' })
}

/** Moves an object to (x, y, z) in an arc. Resolves when it lands. */
export function hop(obj, to, { height = 0.8, duration = 520, delay = 0 } = {}) {
  return new Promise((resolve) => {
    if (reducedMotion()) {
      obj.position.set(...to)
      return resolve()
    }
    const from = obj.position.clone()
    const k = { t: 0 }
    animate(k, {
      t: 1,
      duration,
      delay,
      ease: 'inOutQuad',
      onUpdate: () => {
        obj.position.x = from.x + (to[0] - from.x) * k.t
        obj.position.z = from.z + (to[2] - from.z) * k.t
        obj.position.y = from.y + (to[1] - from.y) * k.t + Math.sin(k.t * Math.PI) * height
      },
      onComplete: resolve,
    })
  })
}

/** Pops an object out of existence and removes it. */
export function vanish(obj, onDone) {
  if (reducedMotion()) {
    obj.parent?.remove(obj)
    return onDone?.()
  }
  animate(obj.scale, {
    x: 0.01,
    y: 0.01,
    z: 0.01,
    duration: 260,
    ease: 'inBack(2)',
    onComplete: () => {
      obj.parent?.remove(obj)
      onDone?.()
    },
  })
}

/* --- text and textures ------------------------------------------------------ */

/** Canvas texture with centered text (and an optional rounded background). */
export function textTexture(text, { size = 256, width = size, bg = null, fg = INK, font = '800 120px "Bricolage Grotesque", system-ui, sans-serif', radius = 0, border = null, y = 0.53 } = {}) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = size
  const ctx = c.getContext('2d')
  if (bg) {
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(4, 4, width - 8, size - 8, radius)
    ctx.fill()
    if (border) {
      ctx.lineWidth = 8
      ctx.strokeStyle = border
      ctx.stroke()
    }
  }
  ctx.fillStyle = fg
  ctx.font = font
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, width / 2, size * y)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** A flat label lying on the table, readable from the camera. */
export function floorLabel(text, w, h, opts = {}) {
  const tex = textTexture(text, { width: Math.round(256 * (w / h)), ...opts })
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.8 }))
  m.rotation.x = -Math.PI / 2
  return m
}

export function emojiSprite(emoji, scale = 0.42) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgba(255,255,255,.92)'
  ctx.beginPath()
  ctx.arc(64, 64, 58, 0, Math.PI * 2)
  ctx.fill()
  ctx.font = '72px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, 64, 70)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  s.scale.setScalar(scale)
  s.renderOrder = 10
  return s
}

/* --- furniture ----------------------------------------------------------------- */

/** A wooden table top with an inset cloth, centered on the origin. */
export function makeTable(width, depth, { cloth = '#2F6B4F', wood = '#8A5A35', border = 0.35, height = 0.3 } = {}) {
  const g = new THREE.Group()
  const top = new THREE.Mesh(new RoundedBoxGeometry(width + border * 2, height, depth + border * 2, 4, 0.12), mat(wood, { roughness: 0.6 }))
  top.position.y = -height / 2
  const felt = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, depth), mat(cloth, { roughness: 0.95 }))
  felt.position.y = 0.005
  g.add(top, felt)
  return shadowed(g, false, true)
}

/* --- dice ------------------------------------------------------------------------ */

const PIPS = {
  1: [[0, 0]],
  2: [[-0.5, -0.5], [0.5, 0.5]],
  3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-0.5, -0.55], [0.5, -0.55], [-0.5, 0], [0.5, 0], [-0.5, 0.55], [0.5, 0.55]],
}
// face value on each local axis: +x 1, -x 6, +y 2, -y 5, +z 3, -z 4
const FACE_UP = {
  1: new THREE.Euler(0, 0, Math.PI / 2),
  6: new THREE.Euler(0, 0, -Math.PI / 2),
  2: new THREE.Euler(0, 0, 0),
  5: new THREE.Euler(Math.PI, 0, 0),
  3: new THREE.Euler(-Math.PI / 2, 0, 0),
  4: new THREE.Euler(Math.PI / 2, 0, 0),
}

/** A die of size `s` (1 by default) with real pips; `showFace(n)` turns n up. */
export function makeDie(s = 1, { color = '#FBF8F0', pip = INK } = {}) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new RoundedBoxGeometry(s, s, s, 4, s * 0.16), mat(color, { roughness: 0.4 }))
  g.add(body)
  const pipGeo = new THREE.SphereGeometry(s * 0.085, 12, 8)
  const pipMat = mat(pip, { roughness: 0.6 })
  const faces = [
    [1, (u, v) => [0.5, v, u]], [6, (u, v) => [-0.5, v, u]],
    [2, (u, v) => [u, 0.5, v]], [5, (u, v) => [u, -0.5, v]],
    [3, (u, v) => [u, v, 0.5]], [4, (u, v) => [u, v, -0.5]],
  ]
  for (const [n, at] of faces) {
    for (const [u, v] of PIPS[n]) {
      const m = new THREE.Mesh(pipGeo, pipMat)
      m.position.set(...at(u * 0.5, v * 0.5).map((c) => c * s))
      g.add(m)
    }
  }
  g.userData.size = s
  return shadowed(g)
}

/** Throws a die onto (x, z): it tumbles through the air and lands showing `value`. */
export function throwDie(die, value, [x, z], { y = 0, delay = 0, from = [0, 2.2, 3] } = {}) {
  const end = FACE_UP[value]
  const half = (die.userData.size ?? 1) / 2
  if (reducedMotion()) {
    die.position.set(x, y + half, z)
    die.rotation.copy(end)
    return Promise.resolve()
  }
  die.position.set(x + from[0], y + from[1], z + from[2])
  const spins = { x: end.x + Math.PI * 4, y: end.y + Math.PI * 2, z: end.z + Math.PI * 2 }
  die.rotation.set(spins.x, spins.y, spins.z)
  return new Promise((resolve) => {
    animate(die.position, { x, z, duration: 800, delay, ease: 'outQuad' })
    animate(die.position, { y: [y + from[1], y + half], duration: 800, delay, ease: 'outBounce' })
    animate(die.rotation, { x: end.x, y: end.y, z: end.z, duration: 850, delay, ease: 'outCubic', onComplete: resolve })
  })
}

/* --- pawns ------------------------------------------------------------------------ */

/** A turned wooden pawn (parqués, ludo…) in the given color. */
export function makePawn(color, scale = 1, opts = {}) {
  const pts = [
    [0, 0], [0.3, 0], [0.31, 0.05], [0.24, 0.1], [0.16, 0.18], [0.12, 0.34], [0.1, 0.42],
    [0.16, 0.46], [0.16, 0.5], [0.1, 0.52], [0.15, 0.6], [0.15, 0.7], [0.08, 0.78], [0, 0.8],
  ].map(([x, y]) => new THREE.Vector2(x, y))
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), mat(color, { roughness: 0.35, ...opts }))
  m.scale.setScalar(scale)
  return shadowed(m)
}

/** Breathing white glow material for "you can tap this" markers (one per stage). */
export function makeGlow(stage) {
  const m = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.6, transparent: true, opacity: 0.85, roughness: 0.4, depthWrite: false })
  stage.onFrame((t) => (m.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.25))
  return m
}

/** A flat glowing ring to mark a tappable spot. */
export function glowRing(material, radius = 0.4, tube = 0.035) {
  const r = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 40), material)
  r.rotation.x = Math.PI / 2
  return r
}

/** Invisible, generous hit area (taps don't need to be pixel-perfect). */
export function hitBox(w, h, d) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }))
}
