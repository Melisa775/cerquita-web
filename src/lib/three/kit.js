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
let colorCtx = null
export function cssColor(value) {
  const m = /var\((--[^)]+)\)/.exec(value ?? '')
  const raw = m ? getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || '#888888' : value
  // three.js doesn't read every CSS syntax (like "hsl(207 68% 46%)"): let the browser normalize it
  if (!raw || /^#[0-9a-f]{3,8}$/i.test(raw)) return raw
  colorCtx ??= document.createElement('canvas').getContext('2d')
  colorCtx.fillStyle = '#888888'
  colorCtx.fillStyle = raw
  return colorCtx.fillStyle
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

/* --- cards --------------------------------------------------------------------- */

/** Rounded rectangle lying in the XY plane, with UVs spanning the whole shape. */
export function roundedPlane(w, h, r) {
  const s = new THREE.Shape()
  const x = -w / 2
  const y = -h / 2
  s.moveTo(x + r, y)
  s.lineTo(x + w - r, y)
  s.quadraticCurveTo(x + w, y, x + w, y + r)
  s.lineTo(x + w, y + h - r)
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  s.lineTo(x + r, y + h)
  s.quadraticCurveTo(x, y + h, x, y + h - r)
  s.lineTo(x, y + r)
  s.quadraticCurveTo(x, y, x + r, y)
  const g = new THREE.ShapeGeometry(s, 6)
  const pos = g.attributes.position
  const uv = []
  for (let i = 0; i < pos.count; i++) uv.push((pos.getX(i) - x) / w, (pos.getY(i) - y) / h)
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return g
}

/** Canvas texture drawn by `draw(ctx, w, h)` (cached by `key` when given). */
const texCache = new Map()
export function canvasTexture(w, h, draw, key) {
  if (key && texCache.has(key)) return texCache.get(key)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  if (key) {
    tex.userData.shared = true
    texCache.set(key, tex)
  }
  return tex
}

/**
 * A playing card lying flat (face up is +y, its top edge toward −z): a thin
 * body plus a printed front and back. `card.userData.setFront(tex)` reprints it.
 */
export function makeCard(w, h, front, back, { thickness = 0.012, radius = 0.07, edge = '#F4F1EA' } = {}) {
  const g = new THREE.Group()
  const shape = roundedPlane(w, h, radius)
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(shape.parameters.shapes.getPoints(6)), { depth: thickness, bevelEnabled: false }), mat(edge, { roughness: 0.6 }))
  body.rotation.x = -Math.PI / 2
  body.position.y = -thickness / 2
  const faceMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })
  const f = new THREE.Mesh(shape, faceMat(front))
  f.rotation.x = -Math.PI / 2
  f.position.y = thickness / 2 + 0.001
  // the back is seen from below: mirror its UVs so its print reads the right way
  const backShape = shape.clone()
  const uv = backShape.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i))
  const b = new THREE.Mesh(backShape, faceMat(back))
  b.rotation.x = Math.PI / 2
  b.rotation.z = Math.PI
  b.position.y = -thickness / 2 - 0.001
  g.add(body, f, b)
  g.userData.setFront = (tex) => {
    f.material.map = tex
    f.material.needsUpdate = true
  }
  g.userData.size = [w, h]
  return shadowed(g)
}

/* --- letter tiles ------------------------------------------------------------- */

/** Printed face of a letter tile (cached per letter and colors). */
export function letterTexture(ch = '', { bg = '#FBF6EA', fg = INK, small = '' } = {}) {
  return canvasTexture(
    192,
    192,
    (ctx) => {
      ctx.fillStyle = bg
      ctx.beginPath()
      ctx.roundRect(0, 0, 192, 192, 26)
      ctx.fill()
      if (ch) {
        ctx.fillStyle = fg
        ctx.font = `800 ${ch.length > 1 ? 92 : 124}px "Bricolage Grotesque", system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(ch.toUpperCase(), small ? 90 : 96, small ? 98 : 104)
      }
      if (small) {
        ctx.fillStyle = fg
        ctx.globalAlpha = 0.7
        ctx.font = '700 38px "Instrument Sans", system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(small, 176, 182)
      }
    },
    `letter|${ch}|${bg}|${fg}|${small}`,
  )
}

const tileGeoCache = new Map()
/**
 * A wooden letter tile lying flat, size `s`. It has two printed faces, the
 * top one and the one underneath (for tiles that flip over, like Wordle's).
 * `tile.userData.setTop(ch, opts)` / `setBottom(ch, opts)` reprint them.
 */
export function makeLetterTile(s = 0.9, { body = '#E9DFC8', thickness = 0.16 } = {}) {
  const key = `${s}|${thickness}`
  if (!tileGeoCache.has(key)) tileGeoCache.set(key, [new RoundedBoxGeometry(s, thickness, s, 3, Math.min(0.06, s * 0.08)), roundedPlane(s * 0.92, s * 0.92, s * 0.1)])
  const [boxGeo, faceGeo] = tileGeoCache.get(key)
  const g = new THREE.Group()
  const box = new THREE.Mesh(boxGeo, mat(body, { roughness: 0.55 }))
  const top = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: letterTexture(''), roughness: 0.5 }))
  top.rotation.x = -Math.PI / 2
  top.position.y = thickness / 2 + 0.002
  const bottom = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: letterTexture(''), roughness: 0.5 }))
  bottom.rotation.x = Math.PI / 2
  // (it reads the right way once the tile turns over on its x axis)
  bottom.position.y = -thickness / 2 - 0.002
  g.add(box, top, bottom)
  const print = (m) => (ch, opts) => {
    const tex = letterTexture(ch, opts)
    if (m.material.map !== tex) {
      m.material.map = tex
      m.material.needsUpdate = true
    }
  }
  g.userData.setTop = print(top)
  g.userData.setBottom = print(bottom)
  g.userData.body = box
  g.userData.size = s
  return shadowed(g)
}
