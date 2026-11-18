/**
 * Colonos 3D board, in plain three.js.
 *
 * The board comes from the server in "hex units": hex centers, vertices and
 * edges on a flat (x, y) plane, pointy-top hexes of radius 1. Here (x, y)
 * becomes (x, z) in 3D, so the island lies on the ground and the camera looks
 * at it from the front (+z), the same orientation the 2D board had.
 *
 * `createColonosScene(container, { onPick, onHover })` builds everything once
 * and returns a controller:
 *   - update(state)     redraws what changed (pieces, robber, glowing targets…)
 *   - rolled(sum, …)    plays the production effect after a dice roll
 *   - resetView()       puts the camera back
 *   - dispose()
 * Pieces drop in and the robber hops with anime.js; the sea moves every frame.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { animate, createSpring } from 'animejs'

const TILE_H = 0.26
const TOP = TILE_H // height of the tile tops
const SKY = '#BFE3F2'
const INK = '#22252E'

export const TERRAIN_3D = {
  forest: { top: '#3F8C4C', side: '#5B4A35' },
  hills: { top: '#C8673F', side: '#6E4A33' },
  pasture: { top: '#8FCB5F', side: '#5E6B3A' },
  fields: { top: '#E7C04B', side: '#7A6235' },
  mountains: { top: '#8F98A4', side: '#55595F' },
  desert: { top: '#E8D5A3', side: '#9C8558' },
}

const RES_EMOJI = { wood: '🌲', brick: '🧱', wool: '🐑', grain: '🌾', ore: '⛰️' }
const TERRAIN_RES = { forest: 'wood', hills: 'brick', pasture: 'wool', fields: 'grain', mountains: 'ore' }

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Small deterministic random generator, so every hex always looks the same
function seeded(seed) {
  let s = seed * 9301 + 49297
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const matCache = new Map()
function mat(color, opts = {}) {
  const key = `${color}|${JSON.stringify(opts)}`
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, flatShading: true, ...opts }))
  return matCache.get(key)
}

function shadowed(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true
      o.receiveShadow = true
    }
  })
  return obj
}

/* --- terrain decorations -------------------------------------------------- */

// Spots around the hex for decorations, leaving the center free for the number token
function ringSpots(rand, n, inner = 0.48, outer = 0.74) {
  const spots = []
  const offset = rand() * Math.PI * 2
  for (let i = 0; i < n; i++) {
    const a = offset + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5
    const r = inner + rand() * (outer - inner)
    spots.push([Math.cos(a) * r, Math.sin(a) * r])
  }
  return spots
}

function tree(rand) {
  const g = new THREE.Group()
  const h = 0.32 + rand() * 0.14
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.1, 5), mat('#7A5134'))
  trunk.position.y = 0.05
  const shade = rand() > 0.5 ? '#2E6B3A' : '#3B8048'
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(0.12, h * 0.65, 6), mat(shade))
  c1.position.y = 0.1 + h * 0.3
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(0.09, h * 0.5, 6), mat(shade))
  c2.position.y = 0.1 + h * 0.62
  g.add(trunk, c1, c2)
  return g
}

function bricks(rand) {
  const g = new THREE.Group()
  const colors = ['#A84B2E', '#C2603C', '#B5543A']
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 3 - row; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.07), mat(colors[(row + i) % 3]))
      b.position.set((i - (2 - row) / 2) * 0.115, 0.03 + row * 0.058, 0)
      g.add(b)
    }
  }
  g.rotation.y = rand() * Math.PI
  return g
}

function mound(color, rand, size = 0.2) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(size, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(color))
  m.scale.y = 0.45 + rand() * 0.3
  return m
}

function sheep(rand) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.1, 0.09, 2, 0.035), mat('#F4F1EA', { flatShading: false }))
  body.position.y = 0.09
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.055, 0.05), mat('#33302C'))
  head.position.set(0.09, 0.11, 0)
  for (const [x, z] of [[-0.045, -0.03], [0.045, -0.03], [-0.045, 0.03], [0.045, 0.03]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.05, 0.018), mat('#33302C'))
    leg.position.set(x, 0.025, z)
    g.add(leg)
  }
  g.add(body, head)
  g.rotation.y = rand() * Math.PI * 2
  return g
}

function wheat(rand) {
  const g = new THREE.Group()
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09 + rand() * 0.05, 0.035), mat(i % 2 ? '#D9A82E' : '#E9BE45'))
    s.position.set(0, 0.05, (i - 1.5) * 0.06)
    g.add(s)
  }
  g.rotation.y = rand() * Math.PI
  return g
}

function rock(rand, big = false) {
  const g = new THREE.Group()
  const h = big ? 0.5 + rand() * 0.15 : 0.3 + rand() * 0.1
  const r = big ? 0.24 : 0.16
  const peak = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), mat(rand() > 0.5 ? '#7B8490' : '#6D7580'))
  peak.position.y = h / 2
  g.add(peak)
  if (big) {
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, h * 0.32, 5), mat('#F3F5F8'))
    snow.position.y = h - h * 0.16 + 0.005
    g.add(snow)
  }
  g.rotation.y = rand() * Math.PI
  return g
}

function cactus() {
  const g = new THREE.Group()
  const m = mat('#5E9E5A')
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 6), m)
  trunk.position.y = 0.13
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 6), m)
  arm.position.set(0.06, 0.16, 0)
  const elbow = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 6), m)
  elbow.rotation.z = Math.PI / 2
  elbow.position.set(0.035, 0.12, 0)
  g.add(trunk, arm, elbow)
  return g
}

function decorate(terrain, index) {
  const g = new THREE.Group()
  const rand = seeded(index + 7)
  const place = (obj, [x, z]) => {
    obj.position.x += x
    obj.position.z += z
    g.add(obj)
  }
  if (terrain === 'forest') ringSpots(rand, 7).forEach((p) => place(tree(rand), p))
  if (terrain === 'hills') {
    ringSpots(rand, 3, 0.5, 0.68).forEach((p) => place(bricks(rand), p))
    ringSpots(rand, 3, 0.55, 0.72).forEach((p) => place(mound('#B35A38', rand, 0.16), p))
  }
  if (terrain === 'pasture') {
    ringSpots(rand, 4, 0.5, 0.7).forEach((p) => place(sheep(rand), p))
    ringSpots(rand, 2, 0.6, 0.75).forEach((p) => place(tree(rand), p))
  }
  if (terrain === 'fields') ringSpots(rand, 6, 0.5, 0.72).forEach((p) => place(wheat(rand), p))
  if (terrain === 'mountains') {
    ringSpots(rand, 3, 0.52, 0.66).forEach((p) => place(rock(rand, true), p))
    ringSpots(rand, 3, 0.6, 0.76).forEach((p) => place(rock(rand), p))
  }
  if (terrain === 'desert') {
    ringSpots(rand, 3, 0.3, 0.6).forEach((p) => place(mound('#DCC48C', rand, 0.26), p))
    place(cactus(), [0.42, -0.3])
    place(cactus(), [-0.5, 0.25])
  }
  return shadowed(g)
}

/* --- canvas textures ------------------------------------------------------ */

function pipCount(n) {
  return 6 - Math.abs(7 - n)
}

function numberTexture(n) {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#F6EFD9'
  ctx.beginPath()
  ctx.arc(128, 128, 126, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#D8CBA6'
  ctx.stroke()
  const hot = n === 6 || n === 8
  ctx.fillStyle = hot ? '#C0392B' : INK
  ctx.font = `800 ${hot ? 118 : 108}px "Bricolage Grotesque", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(n), 128, 114)
  const p = pipCount(n)
  for (let i = 0; i < p; i++) {
    ctx.beginPath()
    ctx.arc(128 + (i - (p - 1) / 2) * 22, 196, 8, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function labelTexture(text, { bg = '#F6EFD9', fg = INK, emoji = null } = {}) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(128, 128, 120, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 10
  ctx.strokeStyle = '#8B6A43'
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (emoji) {
    ctx.font = '96px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'
    ctx.fillText(emoji, 128, 100)
    ctx.fillStyle = fg
    ctx.font = '800 64px "Bricolage Grotesque", system-ui, sans-serif'
    ctx.fillText(text, 128, 186)
  } else {
    ctx.fillStyle = fg
    ctx.font = '800 88px "Bricolage Grotesque", system-ui, sans-serif'
    ctx.fillText(text, 128, 132)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function emojiSprite(emoji, scale = 0.42) {
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

/* --- pieces ---------------------------------------------------------------- */

function darker(hex, f = 0.72) {
  return new THREE.Color(hex).multiplyScalar(f)
}

export function makeSettlement(color, opts = {}) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.2), mat(color, opts))
  body.position.y = 0.085
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.15, 4), mat(darker(color), opts))
  roof.rotation.y = Math.PI / 4
  roof.position.y = 0.17 + 0.075
  roof.scale.z = 0.85
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.01), mat('#2A2D36', opts))
  door.position.set(0, 0.04, 0.101)
  g.add(body, roof, door)
  return g
}

export function makeCity(color, opts = {}) {
  const g = new THREE.Group()
  const hall = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.17, 0.24), mat(color, opts))
  hall.position.set(-0.05, 0.085, 0)
  const tower = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.34, 0.17), mat(color, opts))
  tower.position.set(0.1, 0.17, 0)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.16, 4), mat(darker(color), opts))
  roof.rotation.y = Math.PI / 4
  roof.position.set(0.1, 0.34 + 0.08, 0)
  const hallRoof = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.035, 0.26), mat(darker(color), opts))
  hallRoof.position.set(-0.05, 0.185, 0)
  for (const x of [-0.16, -0.05]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.05, 0.01), mat('#FFE9A8', { ...opts, emissive: '#FFD66B', emissiveIntensity: 0.4 }))
    win.position.set(x, 0.1, 0.121)
    g.add(win)
  }
  g.add(hall, tower, roof, hallRoof)
  return g
}

export function makeRoad(color, length, opts = {}) {
  const g = new THREE.Group()
  const bar = new THREE.Mesh(new RoundedBoxGeometry(length, 0.08, 0.13, 2, 0.03), mat(color, { ...opts, flatShading: false }))
  bar.position.y = 0.04
  g.add(bar)
  return g
}

function makeRobber() {
  const g = new THREE.Group()
  const m = mat('#2A2D36', { roughness: 0.5, flatShading: false })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.08, 20), m)
  base.position.y = 0.04
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.12, 0.3, 20), m)
  body.position.y = 0.22
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), m)
  head.position.y = 0.44
  g.add(base, body, head)
  return shadowed(g)
}

/* --- scene ------------------------------------------------------------------ */

export function createColonosScene(container, { onPick, onHover } = {}) {
  const reduce = reducedMotion()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.domElement.style.display = 'block'
  renderer.domElement.style.width = '100%'
  renderer.domElement.style.height = '100%'
  renderer.domElement.style.touchAction = 'none'
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SKY)
  scene.fog = new THREE.Fog(SKY, 16, 38)

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
  const HOME = new THREE.Vector3(0, 10.5, 9.2)
  camera.position.copy(HOME)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 0, 0.35)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 6.5
  controls.maxDistance = 20
  controls.minPolarAngle = 0.12
  controls.maxPolarAngle = 1.12
  controls.rotateSpeed = 0.55
  controls.zoomSpeed = 0.8

  // light: soft sky + warm sun with shadows
  scene.add(new THREE.HemisphereLight('#E4F3FF', '#B49B6E', 1.05))
  const sun = new THREE.DirectionalLight('#FFF1D6', 2.3)
  sun.position.set(5, 11, 6)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.camera.left = -7
  sun.shadow.camera.right = 7
  sun.shadow.camera.top = 7
  sun.shadow.camera.bottom = -7
  sun.shadow.camera.near = 1
  sun.shadow.camera.far = 30
  sun.shadow.bias = -0.0006
  sun.shadow.normalBias = 0.02
  scene.add(sun)

  // sea: a faceted plane whose vertices bob every frame
  const seaGeo = new THREE.PlaneGeometry(70, 70, 56, 56)
  seaGeo.rotateX(-Math.PI / 2)
  const seaBase = Float32Array.from(seaGeo.attributes.position.array)
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({ color: '#3D93CC', roughness: 0.35, metalness: 0.05, flatShading: true }))
  sea.position.y = -0.18
  sea.receiveShadow = true
  scene.add(sea)

  // island base: sand under the tiles, with a lighter shallow-water ring around it
  const shallow = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 0.1, 6), new THREE.MeshStandardMaterial({ color: '#7CC4E4', roughness: 0.4, transparent: true, opacity: 0.75 }))
  shallow.rotation.y = Math.PI / 6
  shallow.position.y = -0.17
  scene.add(shallow)
  const sand = new THREE.Mesh(new THREE.CylinderGeometry(4.95, 5.35, 0.32, 6), mat('#E9D7A6'))
  sand.rotation.y = Math.PI / 6
  sand.position.y = -0.1
  sand.receiveShadow = true
  scene.add(sand)

  const world = new THREE.Group()
  scene.add(world)
  const tilesGroup = new THREE.Group()
  const piecesGroup = new THREE.Group()
  const targetsGroup = new THREE.Group()
  const fxGroup = new THREE.Group()
  world.add(tilesGroup, piecesGroup, targetsGroup, fxGroup)

  let board = null // static board signature and data
  const tiles = [] // { group, top material, terrain, number }
  let robber = null
  let robberHex = null
  const buildings = new Map() // vertex -> { obj, kind, owner }
  const roads = new Map() // edge -> obj
  let pickables = []
  let targetKey = ''
  let ghost = null
  let hovered = null
  let colors = {}
  let me = null
  let current = null // last state given to update()

  const V = (i) => board.vertices[i]

  /* -- static board ------------------------------------------------------ */
  function buildBoard(b) {
    tilesGroup.clear()
    tiles.length = 0
    b.hexes.forEach((h, i) => {
      const t = TERRAIN_3D[h.terrain]
      const g = new THREE.Group()
      const top = new THREE.MeshStandardMaterial({ color: t.top, roughness: 0.85, flatShading: true, emissive: '#FFF6C8', emissiveIntensity: 0 })
      const side = mat(t.side)
      const tile = new THREE.Mesh(new THREE.CylinderGeometry(0.965, 0.985, TILE_H, 6), [side, top, side])
      tile.position.y = TILE_H / 2
      tile.receiveShadow = true
      tile.castShadow = true
      g.add(tile)
      const deco = decorate(h.terrain, i)
      deco.position.y = TOP
      g.add(deco)
      if (h.number) {
        // a wooden disc with the number printed on a flat face on top (so it always reads upright)
        const token = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.05, 40), mat('#E9DFC2', { flatShading: false }))
        token.position.y = TOP + 0.03
        token.castShadow = true
        const face = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshStandardMaterial({ map: numberTexture(h.number), roughness: 0.7 }))
        face.rotation.x = -Math.PI / 2
        face.position.y = TOP + 0.056
        face.receiveShadow = true
        g.add(token, face)
      }
      g.position.set(h.center[0], 0, h.center[1])
      g.userData = { hex: i }
      tilesGroup.add(g)
      tiles.push({ group: g, top, terrain: h.terrain, number: h.number })
    })

    // ports: a little pier from the coast and a floating sign
    b.ports.forEach((p) => {
      const [a, c] = p.vertices.map((v) => b.vertices[v])
      const mx = (a[0] + c[0]) / 2
      const my = (a[1] + c[1]) / 2
      const len = Math.hypot(mx, my)
      const out = [mx / len, my / len]
      const signPos = [mx + out[0] * 0.78, my + out[1] * 0.78]
      for (const end of [a, c]) {
        const dx = signPos[0] - end[0]
        const dz = signPos[1] - end[1]
        const plank = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz), 0.05, 0.1), mat('#9A6B3F'))
        plank.position.set((signPos[0] + end[0]) / 2, 0.06, (signPos[1] + end[1]) / 2)
        plank.rotation.y = -Math.atan2(dz, dx)
        plank.castShadow = true
        tilesGroup.add(plank)
      }
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 8), mat('#7A5134'))
      post.position.set(signPos[0], 0.1, signPos[1])
      post.castShadow = true
      tilesGroup.add(post)
      const isAny = p.kind === '3:1'
      const sign = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: labelTexture(isAny ? '3:1' : '2:1', { emoji: isAny ? null : RES_EMOJI[p.kind] }), transparent: true }),
      )
      sign.scale.setScalar(0.62)
      sign.position.set(signPos[0], 0.62, signPos[1])
      tilesGroup.add(sign)
    })

    // intro: the island rises out of the sea, tile by tile
    if (!reduce) {
      tiles.forEach(({ group }, i) => {
        group.position.y = -1.6
        animate(group.position, { y: 0, duration: 900, delay: 120 + i * 45, ease: 'outBack(1.6)' })
      })
    }
  }

  /* -- pieces --------------------------------------------------------------- */
  function dropIn(obj, from = 1.4) {
    if (reduce) return
    const y = obj.position.y
    obj.position.y = y + from
    obj.scale.setScalar(0.4)
    animate(obj.position, { y, duration: 650, ease: 'outBounce' })
    animate(obj.scale, { x: 1, y: 1, z: 1, duration: 450, ease: 'outBack(2)' })
  }

  function syncPieces(state, first) {
    // buildings
    for (const [v, b] of Object.entries(state.buildings)) {
      const prev = buildings.get(v)
      if (prev && prev.kind === b.kind && prev.owner === b.owner) continue
      if (prev) piecesGroup.remove(prev.obj)
      const color = colors[b.owner] ?? '#888'
      const obj = shadowed(b.kind === 'city' ? makeCity(color) : makeSettlement(color))
      const [x, z] = V(Number(v))
      obj.position.set(x, TOP, z)
      // face the camera side a little, so the doors show
      obj.rotation.y = Math.atan2(x, z) * 0.15
      piecesGroup.add(obj)
      buildings.set(v, { obj, kind: b.kind, owner: b.owner })
      if (!first) dropIn(obj)
    }
    for (const [v, prev] of buildings) {
      if (!state.buildings[v]) {
        piecesGroup.remove(prev.obj)
        buildings.delete(v)
      }
    }
    // roads
    for (const [e, owner] of Object.entries(state.roads)) {
      if (roads.has(e)) continue
      const [a, c] = board.edges[Number(e)].map(V)
      const dx = c[0] - a[0]
      const dz = c[1] - a[1]
      const obj = shadowed(makeRoad(colors[owner] ?? '#888', Math.hypot(dx, dz) * 0.62))
      obj.position.set((a[0] + c[0]) / 2, TOP, (a[1] + c[1]) / 2)
      obj.rotation.y = -Math.atan2(dz, dx)
      piecesGroup.add(obj)
      roads.set(e, obj)
      if (!first) dropIn(obj, 0.8)
    }
    for (const [e, obj] of roads) {
      if (!(e in state.roads)) {
        piecesGroup.remove(obj)
        roads.delete(e)
      }
    }
    // robber: hops to its new hex
    const h = state.board.robber
    if (h != null && h !== robberHex) {
      const hex = board.hexes[h]
      const pos = robberSpot(hex)
      if (!robber) {
        robber = makeRobber()
        robber.position.set(pos[0], TOP, pos[1])
        piecesGroup.add(robber)
      } else if (reduce) {
        robber.position.set(pos[0], TOP, pos[1])
      } else {
        const from = robber.position.clone()
        const jump = { t: 0 }
        animate(jump, {
          t: 1,
          duration: 700,
          ease: 'inOutQuad',
          onUpdate: () => {
            robber.position.x = from.x + (pos[0] - from.x) * jump.t
            robber.position.z = from.z + (pos[1] - from.z) * jump.t
            robber.position.y = TOP + Math.sin(jump.t * Math.PI) * 1.2
          },
        })
      }
      robberHex = h
    }
  }

  function robberSpot(hex) {
    // beside the number token (the desert has none: then the center)
    return hex.number ? [hex.center[0] - 0.02, hex.center[1] + 0.42] : [hex.center[0], hex.center[1]]
  }

  /* -- glowing targets ------------------------------------------------------ */
  const glowMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.6, transparent: true, opacity: 0.9, roughness: 0.4 })
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })

  function syncTargets(t) {
    const key = t ? `${t.kind}:${(t.ids ?? []).join(',')}` : ''
    if (key === targetKey) return
    targetKey = key
    targetsGroup.clear()
    pickables = []
    setHovered(null)
    if (!t || !t.ids?.length) return

    t.ids.forEach((id, i) => {
      let marker
      let hit
      if (t.kind === 'settlement' || t.kind === 'city') {
        const [x, z] = V(id)
        marker = new THREE.Group()
        const ring = new THREE.Mesh(new THREE.TorusGeometry(t.kind === 'city' ? 0.26 : 0.15, 0.03, 10, 32), glowMat)
        ring.rotation.x = Math.PI / 2
        marker.add(ring)
        if (t.kind === 'settlement') {
          const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 24), glowMat)
          marker.add(dot)
        }
        marker.position.set(x, TOP + 0.04, z)
        hit = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12), hitMat)
        hit.position.copy(marker.position)
      } else if (t.kind === 'road') {
        const [a, c] = board.edges[id].map(V)
        const dx = c[0] - a[0]
        const dz = c[1] - a[1]
        marker = new THREE.Mesh(new RoundedBoxGeometry(Math.hypot(dx, dz) * 0.5, 0.04, 0.08, 2, 0.02), glowMat)
        marker.position.set((a[0] + c[0]) / 2, TOP + 0.03, (a[1] + c[1]) / 2)
        marker.rotation.y = -Math.atan2(dz, dx)
        hit = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz) * 0.7, 0.4, 0.34), hitMat)
        hit.position.copy(marker.position)
        hit.rotation.y = marker.rotation.y
      } else if (t.kind === 'robber') {
        const hex = board.hexes[id]
        marker = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.035, 6, 6), glowMat)
        marker.rotation.x = Math.PI / 2
        marker.rotation.z = Math.PI / 6 + Math.PI / 2
        marker.position.set(hex.center[0], TOP + 0.04, hex.center[1])
        hit = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.6, 6), hitMat)
        hit.position.set(hex.center[0], TOP, hex.center[1])
      }
      marker.userData = { phase: i * 0.37 }
      hit.userData = { kind: t.kind, id, marker }
      targetsGroup.add(marker, hit)
      pickables.push(hit)
      if (!reduce) {
        marker.scale.setScalar(0.01)
        animate(marker.scale, { x: 1, y: 1, z: 1, duration: 420, delay: i * 18, ease: 'outBack(2)' })
      }
    })
  }

  function makeGhost(target) {
    const color = colors[me] ?? '#ffffff'
    const opts = { transparent: true, opacity: 0.55 }
    if (target.kind === 'settlement') return makeSettlement(color, opts)
    if (target.kind === 'city') return makeCity(color, opts)
    if (target.kind === 'road') {
      const [a, c] = board.edges[target.id].map(V)
      return makeRoad(color, Math.hypot(c[0] - a[0], c[1] - a[1]) * 0.62, opts)
    }
    return null
  }

  function setHovered(target) {
    if (hovered === target) return
    if (ghost) {
      fxGroup.remove(ghost)
      ghost = null
    }
    hovered = target
    renderer.domElement.style.cursor = target ? 'pointer' : ''
    onHover?.(target ? { kind: target.kind, id: target.id } : null)
    if (!target) return
    ghost = makeGhost(target)
    if (ghost) {
      ghost.position.copy(target.marker.position)
      ghost.position.y = TOP + 0.02
      if (target.kind === 'road') ghost.rotation.y = target.marker.rotation.y
      fxGroup.add(ghost)
    }
  }

  /* -- picking -------------------------------------------------------------- */
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  function pick(e) {
    if (!pickables.length) return null
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    const hit = raycaster.intersectObjects(pickables, false)[0]
    return hit ? hit.object.userData : null
  }

  let down = null
  const onDown = (e) => {
    down = { x: e.clientX, y: e.clientY }
  }
  const onUp = (e) => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 7) return // it was a drag to turn the camera
    const target = pick(e)
    if (target) onPick?.(target.kind, target.id)
  }
  const onMove = (e) => {
    if (e.pointerType === 'touch') return
    setHovered(pick(e))
  }
  const el = renderer.domElement
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerleave', () => setHovered(null))
  el.addEventListener('dblclick', () => resetView())

  /* -- effects -------------------------------------------------------------- */
  function rolled(sum, robberHexNow) {
    if (!board) return
    tiles.forEach((t, i) => {
      if (t.number !== sum) return
      const blocked = i === robberHexNow
      // the producing tiles glow and their resource floats up
      if (!reduce) {
        const glow = { v: 0 }
        animate(glow, {
          v: [0, blocked ? 0.15 : 0.75, 0],
          duration: 1400,
          ease: 'inOutSine',
          onUpdate: () => (t.top.emissiveIntensity = glow.v),
        })
        animate(t.group.position, { y: [0, 0.18, 0], duration: 600, ease: 'outQuad' })
      }
      if (blocked || !TERRAIN_RES[t.terrain]) return
      const s = emojiSprite(RES_EMOJI[TERRAIN_RES[t.terrain]])
      s.position.set(t.group.position.x, TOP + 0.5, t.group.position.z)
      fxGroup.add(s)
      if (reduce) {
        setTimeout(() => fxGroup.remove(s), 1200)
        return
      }
      s.material.opacity = 0
      animate(s.material, { opacity: [0, 1, 1, 0], duration: 1700, ease: 'linear' })
      animate(s.position, { y: TOP + 1.6, duration: 1700, ease: 'outQuad', onComplete: () => fxGroup.remove(s) })
    })
    if (sum === 7 && robber && !reduce) {
      // a seven wakes the robber up
      animate(robber.rotation, { y: [0, Math.PI * 2], duration: 900, ease: 'inOutBack' })
      animate(robber.position, { y: [TOP, TOP + 0.5, TOP], duration: 700, ease: 'outQuad' })
    }
  }

  /* -- camera and size ------------------------------------------------------ */
  function fitCamera() {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // narrow screens need the camera farther back to fit the whole island
    camera.fov = w / h < 0.9 ? 40 : 34
    camera.updateProjectionMatrix()
    // leave room for the HUD at the top and bottom of the stage
    // Far enough for the whole island (about 10 units wide) to fit the width,
    // leaving room for the HUD; portrait screens look more from above.
    const portrait = w / h < 0.9
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const fitWidth = (portrait ? 4.75 : 5.3) / Math.tan(Math.atan(Math.tan(halfFov) * camera.aspect))
    const dist = Math.max(portrait ? 13 : 15.2, fitWidth * (portrait ? 1.02 : 0.95))
    controls.maxDistance = Math.max(20, dist + 5)
    // the fog only touches the far sea, wherever the camera ends up
    scene.fog.near = dist + 4
    scene.fog.far = dist + 26
    controls.target.set(0, 0, portrait ? 0.9 : 0.35)
    HOME.set(0, dist * (portrait ? 0.9 : 0.78), dist * (portrait ? 0.42 : 0.62) + controls.target.z)
  }
  function resetView() {
    if (reduce) {
      camera.position.copy(HOME)
      return
    }
    const from = camera.position.clone()
    const k = { t: 0 }
    animate(k, {
      t: 1,
      duration: 700,
      ease: 'inOutCubic',
      onUpdate: () => camera.position.lerpVectors(from, HOME, k.t),
    })
  }
  fitCamera()
  camera.position.copy(HOME)
  const ro = new ResizeObserver(() => fitCamera())
  ro.observe(container)

  /* -- loop ----------------------------------------------------------------- */
  let raf = 0
  let t0 = performance.now()
  let frame = 0
  const pos = seaGeo.attributes.position
  function loop(now) {
    const t = (now - t0) / 1000
    frame++
    if (!reduce && frame % 2 === 0) {
      for (let i = 0; i < pos.count; i++) {
        const x = seaBase[i * 3]
        const z = seaBase[i * 3 + 2]
        pos.array[i * 3 + 1] = Math.sin(x * 0.55 + t * 1.1) * 0.07 + Math.cos(z * 0.48 + t * 0.9) * 0.07
      }
      pos.needsUpdate = true
      seaGeo.computeVertexNormals()
    }
    // glowing targets breathe
    for (const m of targetsGroup.children) {
      if (m.userData.phase == null || m.material === hitMat) continue
      const isHover = hovered?.marker === m
      const s = isHover ? 1.35 : 1 + Math.sin(t * 4 + m.userData.phase) * 0.12
      if (!reduce && m.scale.x > 0.5) m.scale.setScalar(s)
    }
    glowMat.emissiveIntensity = 0.45 + Math.sin(t * 4) * 0.2
    if (ghost && !reduce) ghost.position.y = TOP + 0.04 + Math.sin(t * 5) * 0.03
    controls.update()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  const onVisibility = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden) raf = requestAnimationFrame(loop)
  }
  document.addEventListener('visibilitychange', onVisibility)

  return {
    update(state) {
      // state: { board, buildings, roads, colors, me, targets }
      colors = state.colors
      me = state.me
      const signature = state.board.hexes.map((h) => `${h.terrain}${h.number}`).join('|')
      const first = !board || board.signature !== signature
      if (first) {
        board = { ...state.board, signature }
        buildings.forEach(({ obj }) => piecesGroup.remove(obj))
        buildings.clear()
        roads.forEach((obj) => piecesGroup.remove(obj))
        roads.clear()
        if (robber) piecesGroup.remove(robber)
        robber = null
        robberHex = null
        buildBoard(state.board)
      }
      board.robber = state.board.robber
      syncPieces(state, first)
      syncTargets(state.targets)
      current = state
    },
    rolled,
    resetView,
    zoom(dir) {
      const v = camera.position.clone().sub(controls.target)
      const len = THREE.MathUtils.clamp(v.length() * (dir > 0 ? 0.82 : 1.2), controls.minDistance, controls.maxDistance)
      camera.position.copy(controls.target).add(v.setLength(len))
    },
    get state() {
      return current
    },
    /** Screen position of a glowing target (used by the browser tests). */
    project(kind, id) {
      const hit = pickables.find((h) => h.userData.kind === kind && h.userData.id === id)
      if (!hit) return null
      const v = hit.userData.marker.getWorldPosition(new THREE.Vector3()).project(camera)
      const r = renderer.domElement.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    },
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      controls.dispose()
      scene.traverse((o) => {
        o.geometry?.dispose()
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
        ms.forEach((m) => {
          m.map?.dispose()
          if (![...matCache.values()].includes(m)) m.dispose()
        })
      })
      renderer.dispose()
      renderer.domElement.remove()
    },
  }
}
