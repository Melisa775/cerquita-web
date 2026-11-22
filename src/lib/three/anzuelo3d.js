/**
 * Anzuelo on the 3D stage: a pond seen from above. The fisher sits in a
 * little boat at the front with a rod; every other player is a fish in their
 * color swimming around, with a numbered float that matches their answer
 * card. When a fish is caught it leaps out on an arc: red with an ✗ if it
 * was a liar, golden if it was the honest one. At the end of the round every
 * fish shows what it was.
 */
import * as THREE from 'three'
import { animate } from 'animejs'
import { createStage } from './stage'
import { glowRing, hitBox, makeGlow, mat, shadowed, textTexture } from './kit'

const POND_R = 3.3
const WATER_Y = 0.14
const BOAT = [0, POND_R - 0.55]

/* -- the scenery ------------------------------------------------------------------ */

function makePond() {
  const g = new THREE.Group()
  // grass ring and a sandy bank
  // everything stays below the water surface inside the pond (the water covers it)
  const grass = new THREE.Mesh(new THREE.CylinderGeometry(POND_R + 2.6, POND_R + 2.8, 0.3, 64), mat('#7CB36A', { roughness: 0.95 }))
  grass.position.y = -0.13 // top at 0.02
  const bank = new THREE.Mesh(new THREE.CylinderGeometry(POND_R + 0.35, POND_R + 0.45, 0.3, 64), mat('#D8C08A', { roughness: 1 }))
  bank.position.y = -0.11 // top at 0.04
  const bed = new THREE.Mesh(new THREE.CylinderGeometry(POND_R, POND_R, 0.3, 64), mat('#2E6F7E'))
  bed.position.y = -0.2
  g.add(grass, bank, bed)
  // reeds and stones around the edge
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + Math.sin(i * 7) * 0.1
    if (Math.abs(Math.sin(a) - 1) < 0.35 && Math.cos(a) > -0.5 && Math.cos(a) < 0.5) continue // keep the boat side clear
    const r = POND_R + 0.55 + (i % 3) * 0.18
    if (i % 3 === 0) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (i % 4) * 0.04), mat('#9A9C98'))
      stone.position.set(Math.cos(a) * r, 0.12, Math.sin(a) * r)
      stone.rotation.set(i, i * 2, i * 3)
      g.add(stone)
    } else {
      for (let k = 0; k < 3; k++) {
        const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.7 + k * 0.15, 5), mat('#5E8C3A'))
        reed.position.set(Math.cos(a) * r + k * 0.06, 0.4, Math.sin(a) * r + k * 0.04)
        reed.rotation.z = (k - 1) * 0.12
        reed.userData.reed = i + k
        g.add(reed)
      }
    }
  }
  // lily pads
  for (let i = 0; i < 7; i++) {
    const a = i * 2.1
    const r = 1.2 + (i % 3) * 0.7
    const pad = new THREE.Mesh(new THREE.CircleGeometry(0.22, 18, 0.3, Math.PI * 1.85), mat('#4E9B4A', { side: THREE.DoubleSide }))
    pad.rotation.x = -Math.PI / 2
    pad.rotation.z = a
    pad.position.set(Math.cos(a) * r, WATER_Y + 0.02, Math.sin(a) * r - 0.4)
    g.add(pad)
    if (i % 3 === 0) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat('#F4A6C8'))
      flower.position.copy(pad.position).add(new THREE.Vector3(0.05, 0.04, 0))
      g.add(flower)
    }
  }
  return shadowed(g, false, true)
}

function makeWater() {
  const geo = new THREE.CircleGeometry(POND_R, 64, 0, Math.PI * 2)
  geo.rotateX(-Math.PI / 2)
  // more vertices for gentle waves
  const ring = new THREE.RingGeometry(0.01, POND_R, 64, 10)
  ring.rotateX(-Math.PI / 2)
  const water = new THREE.Mesh(ring, new THREE.MeshStandardMaterial({ color: '#4FB3C8', transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.1 }))
  water.position.y = WATER_Y
  water.receiveShadow = true
  geo.dispose()
  return water
}

function makeBoat() {
  const g = new THREE.Group()
  const wood = mat('#9A6136', { roughness: 0.8 })
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.26, 20, 1, false), wood)
  hull.scale.set(1.6, 1, 0.9)
  hull.position.y = 0.13
  const inside = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.26, 0.05, 20), mat('#6E4123'))
  inside.scale.set(1.6, 1, 0.9)
  inside.position.y = 0.25
  // the fisher: a little figure with a hat
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 0.32, 14), mat('#3E7CB1'))
  body.position.set(0, 0.42, 0.05)
  body.userData.fisher = true
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), mat('#E8C39E'))
  head.position.set(0, 0.66, 0.05)
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.17, 0.08, 16), mat('#E2B84B'))
  hat.position.set(0, 0.76, 0.05)
  // the rod and its line
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 1.5, 6), mat('#4A3426'))
  rod.position.set(0.25, 0.85, -0.45)
  rod.rotation.x = -0.9
  g.add(hull, inside, body, head, hat, rod)
  g.userData.tip = new THREE.Vector3(0.25, 1.32, -1.07)
  g.userData.body = body
  return shadowed(g)
}

/* -- fish ---------------------------------------------------------------------------- */

function makeFish(color) {
  const g = new THREE.Group()
  const skin = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, emissive: '#000000' })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skin)
  body.scale.set(0.75, 0.8, 1.5)
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.26, 4), skin)
  tail.rotation.x = Math.PI / 2
  tail.scale.set(0.35, 1, 1)
  tail.position.z = -0.38
  tail.userData.tail = true
  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), skin)
  fin.position.set(0, 0.17, -0.05)
  fin.rotation.x = -0.5
  g.add(body, tail, fin)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat('#FFFFFF'))
    eye.position.set(s * 0.12, 0.06, 0.22)
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), mat('#1B1B1B'))
    pupil.position.set(s * 0.145, 0.06, 0.245)
    g.add(eye, pupil)
  }
  g.userData.skin = skin
  g.userData.tail = tail
  g.scale.setScalar(1.6) // big enough to tap on a phone
  return shadowed(g, true, false)
}

/** The float above each fish: its card number, in the player's color. */
function makeFloat(n, color) {
  const g = new THREE.Group()
  const bob = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), mat('#FFFFFF', { roughness: 0.4 }))
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat('#E5484D', { roughness: 0.4 }))
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(String(n), { size: 128, bg: color, fg: '#FFFFFF', radius: 64, font: '900 84px "Bricolage Grotesque", system-ui, sans-serif' }), depthTest: false, transparent: true }))
  label.scale.setScalar(0.36)
  label.position.y = 0.36
  label.renderOrder = 12
  g.add(bob, top, label)
  return g
}

function badge(text, bg) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(text, { size: 96, width: 320, bg, fg: '#FFFFFF', radius: 46, font: '900 50px "Bricolage Grotesque", system-ui, sans-serif' }), depthTest: false, transparent: true }))
  s.scale.set(1.0, 0.3, 1)
  s.renderOrder = 14
  return s
}

/* -- the stage ----------------------------------------------------------------------- */

export function create(container, handlers) {
  const stage = createStage(
    container,
    { background: '#BFE6EE', fitHalfWidth: POND_R + 0.9, fitHalfDepth: POND_R + 0.9, tilt: 0.86, portraitTilt: 0.93, target: [0, 0, 0], shadowSize: 6, autoInsets: true },
    handlers,
  )
  const { world } = stage
  const glow = makeGlow(stage)
  world.add(makePond())
  const water = makeWater()
  world.add(water)
  const boat = makeBoat()
  boat.position.set(BOAT[0], WATER_Y - 0.1, BOAT[1])
  world.add(boat)
  // the fishing line: from the rod tip to the float being looked at (or the water)
  const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
  const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: '#F4F1EA', transparent: true, opacity: 0.8 }))
  world.add(line)

  const fishGroup = new THREE.Group()
  const marks = new THREE.Group()
  world.add(fishGroup, marks)
  const fish = new Map() // player -> { group, float, swim: {r, speed, phase}, state }
  let roundKey = null
  let eventSeen = null
  let lineTarget = new THREE.Vector3(0, WATER_Y, 0.4)
  let current = null
  let firstUpdate = true

  const wave = water.geometry.attributes.position
  const base = Float32Array.from(wave.array)

  function clearFish() {
    fish.forEach((f) => fishGroup.remove(f.group, f.float))
    fish.clear()
  }

  function syncFish(game, colors) {
    const list = game.cards.length ? game.cards.map((c) => c.player) : game.players.filter((p) => p !== game.guesser)
    // a new round (or new fish): everyone back in the water
    const key = `${game.round}|${[...list].sort().join(',')}`
    if (key !== roundKey) {
      clearFish()
      list.forEach((p, i) => {
        const group = makeFish(colors[p] ?? '#F29E4C')
        const r = 0.9 + (i % 3) * 0.75
        const swim = { r, speed: 0.25 + (i % 4) * 0.06, phase: (i / list.length) * Math.PI * 2, dir: i % 2 ? 1 : -1 }
        group.position.set(Math.cos(swim.phase) * r, WATER_Y - 0.05, Math.sin(swim.phase) * r - 0.3)
        fishGroup.add(group)
        fish.set(p, { group, float: null, swim, state: 'swim', index: i })
        if (!firstUpdate && !stage.reduce) {
          group.scale.setScalar(0.01)
          animate(group.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 600, delay: 120 * i, ease: 'outBack(2)' })
        }
      })
    }
    roundKey = key
    // floats with the card numbers once the answers are on the table
    const numbered = game.phase !== 'write'
    game.cards.forEach((c, i) => {
      const f = fish.get(c.player)
      if (!f) return
      if (numbered && !f.float) {
        f.float = makeFloat(i + 1, colors[c.player] ?? '#888')
        fishGroup.add(f.float)
        if (!stage.reduce) {
          f.float.scale.setScalar(0.01)
          animate(f.float.scale, { x: 1, y: 1, z: 1, duration: 450, delay: 80 * i, ease: 'outBack(2.4)' })
        }
      }
      const shown = c.role
      if (shown && f.state === 'swim') reveal(f, c, game.phase !== 'fish' && !c.caught)
    })
  }

  /** A fish shows what it was: caught ones leap out, the rest just surface. */
  function reveal(f, card, quiet) {
    f.state = 'shown'
    const honest = card.role === 'honest'
    const color = honest ? '#F2C14E' : '#D9534F'
    f.group.userData.skin.color.set(color)
    f.group.userData.skin.emissive.set(honest ? '#7A5A00' : '#3A0000')
    f.group.userData.skin.emissiveIntensity = honest ? 0.5 : 0.25
    const tag = badge(honest ? '★ Verdad' : '✗ Mentira', honest ? '#C99A1E' : '#C0392B')
    tag.position.set(0, 0.5, 0)
    tag.scale.set(0.66, 0.2, 1) // the fish is scaled up: keep the tag the usual size
    f.group.add(tag)
    if (quiet || stage.reduce || !card.caught) {
      f.group.position.y = WATER_Y + 0.05
      return
    }
    // the leap: out of the water, up toward the boat, and a splash back
    const from = f.group.position.clone()
    const to = new THREE.Vector3(from.x * 0.5 + BOAT[0] * 0.5, WATER_Y + 0.05, from.z * 0.5 + (BOAT[1] - 0.8) * 0.5)
    const k = { t: 0 }
    f.state = 'leap'
    animate(k, {
      t: 1,
      duration: 1100,
      ease: 'inOutSine',
      onUpdate: () => {
        f.group.position.lerpVectors(from, to, k.t)
        f.group.position.y = from.y + Math.sin(k.t * Math.PI) * 1.6
        f.group.rotation.x = -Math.cos(k.t * Math.PI) * 0.9
        f.group.rotation.y += 0.25
      },
      onComplete: () => {
        f.group.rotation.x = 0
        f.state = 'shown'
        splash(to)
      },
    })
  }

  function splash(at) {
    if (stage.reduce) return
    for (let i = 0; i < 10; i++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), mat('#D9F4FA'))
      drop.position.copy(at)
      world.add(drop)
      const a = (i / 10) * Math.PI * 2
      const k = { t: 0 }
      animate(k, {
        t: 1,
        duration: 600,
        ease: 'outQuad',
        onUpdate: () => {
          drop.position.set(at.x + Math.cos(a) * 0.5 * k.t, at.y + Math.sin(k.t * Math.PI) * 0.5, at.z + Math.sin(a) * 0.5 * k.t)
        },
        onComplete: () => world.remove(drop),
      })
    }
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 32), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.8 }))
    ring.rotation.x = -Math.PI / 2
    ring.position.set(at.x, WATER_Y + 0.02, at.z)
    world.add(ring)
    animate(ring.scale, { x: 6, y: 6, duration: 900, ease: 'outCubic' })
    animate(ring.material, { opacity: 0, duration: 900, ease: 'outCubic', onComplete: () => world.remove(ring) })
  }

  function syncMarks(state) {
    marks.clear()
    stage.clearPickables()
    if (!state.canCatch) return
    state.game.cards.forEach((c) => {
      if (c.caught) return
      const f = fish.get(c.player)
      if (!f) return
      const ring = glowRing(glow, 0.62, 0.04)
      ring.userData.follow = f.group
      marks.add(ring)
      const hit = hitBox(1.2, 1, 1.2)
      hit.userData.follow = f.group
      marks.add(hit)
      stage.pickable(hit, { kind: 'fish', id: c.player, marker: f.group, priority: 1 })
    })
  }

  stage.onFrame((t, dt) => {
    // gentle waves
    for (let i = 0; i < wave.count; i++) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      wave.setY(i, Math.sin(x * 2.2 + t * 1.4) * 0.012 + Math.cos(z * 2.6 + t * 1.1) * 0.01)
    }
    wave.needsUpdate = true
    // swimming
    for (const f of fish.values()) {
      const g = f.group
      if (f.state === 'swim') {
        f.swim.phase += f.swim.speed * f.swim.dir * dt
        const x = Math.cos(f.swim.phase) * f.swim.r
        const z = Math.sin(f.swim.phase) * f.swim.r * 0.8 - 0.3
        g.position.set(x, WATER_Y - 0.06 + Math.sin(t * 2 + f.index) * 0.03, z)
        // face where it swims
        g.rotation.y = Math.atan2(-Math.sin(f.swim.phase) * f.swim.dir, Math.cos(f.swim.phase) * f.swim.dir * 0.8) + Math.PI / 2
      } else if (f.state === 'shown') {
        g.position.y = WATER_Y + 0.05 + Math.sin(t * 2 + f.index) * 0.03
      }
      g.userData.tail.rotation.y = Math.sin(t * 9 + f.index) * 0.4
      if (f.float) {
        f.float.position.set(g.position.x, WATER_Y + 0.42 + Math.sin(t * 3 + f.index) * 0.04, g.position.z)
        f.float.visible = f.state === 'swim'
      }
    }
    marks.children.forEach((m) => {
      if (!m.userData.follow) return
      m.position.set(m.userData.follow.position.x, WATER_Y + (m.isMesh && m.geometry.type === 'TorusGeometry' ? 0.03 : 0.3), m.userData.follow.position.z)
    })
    // the line follows whoever is hovered (or rests in the water)
    const hovered = stage.hovered
    const target = hovered?.kind === 'fish' ? fish.get(hovered.id)?.group.position : null
    lineTarget.lerp(target ? new THREE.Vector3(target.x, WATER_Y + 0.1, target.z) : new THREE.Vector3(0, WATER_Y, 0.6), 0.08)
    const tip = boat.userData.tip.clone().add(boat.position)
    const pts = line.geometry.attributes.position
    pts.setXYZ(0, tip.x, tip.y, tip.z)
    pts.setXYZ(1, lineTarget.x, lineTarget.y, lineTarget.z)
    pts.needsUpdate = true
    world.traverse((o) => {
      if (o.userData.reed !== undefined) o.rotation.x = Math.sin(t * 1.3 + o.userData.reed) * 0.06
    })
    boat.rotation.z = Math.sin(t * 1.2) * 0.03
  })

  return {
    update(state) {
      const { game } = state
      boat.userData.body.material = mat(state.colors[game.guesser] ?? '#3E7CB1')
      syncFish(game, state.colors)
      // a catch: the line pulls toward that fish
      if (game.event && game.event.id !== eventSeen) {
        eventSeen = game.event.id
        const f = fish.get(game.event.player)
        if (f) lineTarget.copy(f.group.position)
      }
      syncMarks(state)
      firstUpdate = false
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
