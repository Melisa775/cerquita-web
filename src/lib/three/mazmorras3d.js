/**
 * Mazmorras on the 3D stage: a dark dungeon seen from above. Rooms are
 * stone platforms joined by corridors; only the rooms the party has seen are
 * lit, and the ones next door show up as dark "?" floors to walk into.
 * Heroes and monsters are little painted miniatures with health bars; a d20
 * tumbles onto the floor for every roll, attackers lunge at their target and
 * damage floats up as numbers. The camera glides to each new room.
 */
import * as THREE from 'three'
import { animate } from 'animejs'
import { createStage } from './stage'
import { canvasTexture, floorLabel, glowRing, hitBox, makeGlow, mat, shadowed, textTexture, vanish } from './kit'

const THEMES = {
  cripta: { floor: '#77707A', joint: '#4E4852', corridor: '#5C5660', bg: '#141119', rim: '#3B3540' },
  cueva: { floor: '#7A6A52', joint: '#54473A', corridor: '#63553F', bg: '#12140F', rim: '#3D3528' },
}
const ROOM_H = 0.24
const SKIN = '#E8C39E'

/* -- the map ------------------------------------------------------------------ */

function bounds(r) {
  const [x, z] = r.pos
  const [w, d] = r.size
  return { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, cx: x, cz: z, w, d }
}

/** Corridor segments between two rooms: straight if they face each other, else an L. */
function corridor(a, b) {
  const A = bounds(a)
  const B = bounds(b)
  const ox0 = Math.max(A.x0, B.x0)
  const ox1 = Math.min(A.x1, B.x1)
  if (ox1 - ox0 > 0.9) {
    const x = (ox0 + ox1) / 2
    return [[x, A.cz, x, B.cz]]
  }
  const oz0 = Math.max(A.z0, B.z0)
  const oz1 = Math.min(A.z1, B.z1)
  if (oz1 - oz0 > 0.9) {
    const z = (oz0 + oz1) / 2
    return [[A.cx, z, B.cx, z]]
  }
  return [[A.cx, A.cz, B.cx, A.cz], [B.cx, A.cz, B.cx, B.cz]]
}

function floorTexture(theme, w, d, seed) {
  return canvasTexture(64 * w, 64 * d, (ctx, W, H) => {
    ctx.fillStyle = theme.joint
    ctx.fillRect(0, 0, W, H)
    let s = seed * 97 + 13
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280)
    for (let y = 0; y < H; y += 32) {
      const off = (y / 32) % 2 ? 16 : 0
      for (let x = -off; x < W; x += 32) {
        const c = new THREE.Color(theme.floor).multiplyScalar(0.82 + rnd() * 0.3)
        ctx.fillStyle = `#${c.getHexString()}`
        ctx.fillRect(x + 1.5, y + 1.5, 29, 29)
        if (rnd() < 0.12) {
          ctx.strokeStyle = 'rgba(0,0,0,.25)'
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.moveTo(x + 4 + rnd() * 10, y + 4 + rnd() * 10)
          ctx.lineTo(x + 14 + rnd() * 14, y + 14 + rnd() * 14)
          ctx.stroke()
        }
      }
    }
  })
}

/* -- miniatures ---------------------------------------------------------------- */

function base(color, r = 0.36) {
  const g = new THREE.Group()
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.06, 0.08, 32), mat('#2A2630', { roughness: 0.5 }))
  disc.position.y = 0.04
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.028, 8, 40), mat(color, { roughness: 0.4, emissive: color, emissiveIntensity: 0.25 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.07
  g.add(disc, rim)
  return g
}

function eyes(color, y, z, spread = 0.06, size = 0.025) {
  const g = new THREE.Group()
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 8), mat(color, { emissive: color, emissiveIntensity: 1.6 }))
    e.position.set(s * spread, y, z)
    g.add(e)
  }
  return g
}

/** A hero: robe/armor in the class color, a head, and the class's weapon. */
function makeHero(cls, color) {
  const g = new THREE.Group()
  g.add(base(color))
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.55, 16), mat(color, { roughness: 0.6 }))
  body.position.y = 0.37
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 6, 20), mat('#4A3426'))
  belt.rotation.x = Math.PI / 2
  belt.position.y = 0.4
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), mat(SKIN, { roughness: 0.7 }))
  head.position.y = 0.76
  g.add(body, belt, head)
  const metal = mat('#C9CED6', { metalness: 0.7, roughness: 0.3 })
  const wood = mat('#7A5233')
  if (cls === 'guerrero') {
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal)
    helm.position.y = 0.78
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.015), metal)
    blade.position.set(0.27, 0.6, 0.05)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mat('#C9A227', { metalness: 0.6 }))
    guard.position.set(0.27, 0.33, 0.05)
    const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 20), mat(color, { roughness: 0.4, metalness: 0.3 }))
    shield.rotation.z = Math.PI / 2
    shield.position.set(-0.24, 0.42, 0.05)
    g.add(helm, blade, guard, shield)
  } else if (cls === 'mago') {
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 16), mat(color))
    hat.position.y = 1.0
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 20), mat(color))
    brim.position.y = 0.83
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.95, 8), wood)
    staff.position.set(0.26, 0.5, 0.05)
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12), mat('#9FE3FF', { emissive: '#62C7FF', emissiveIntensity: 1.4 }))
    orb.position.set(0.26, 1.0, 0.05)
    orb.userData.orb = true
    g.add(hat, brim, staff, orb)
  } else if (cls === 'picaro') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(color))
    hood.position.y = 0.78
    hood.rotation.x = -0.25
    for (const s of [-1, 1]) {
      const dagger = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.24, 0.012), metal)
      dagger.position.set(s * 0.25, 0.42, 0.08)
      dagger.rotation.z = s * 0.3
      g.add(dagger)
    }
    const cape = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.27, 0.5, 16, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat(new THREE.Color(color).multiplyScalar(0.6).getStyle(), { side: THREE.DoubleSide }))
    cape.position.y = 0.38
    g.add(hood, cape)
  } else {
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.015, 8, 30), mat('#FFE38A', { emissive: '#FFD34D', emissiveIntensity: 1.2 }))
    halo.rotation.x = Math.PI / 2
    halo.position.y = 0.95
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), wood)
    handle.position.set(0.27, 0.45, 0.05)
    const head2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08), metal)
    head2.position.set(0.27, 0.67, 0.05)
    const symbol = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.01), mat('#FFE38A', { emissive: '#FFD34D', emissiveIntensity: 0.6 }))
    symbol.position.set(0, 0.45, 0.22)
    const symbol2 = symbol.clone()
    symbol2.scale.set(2.2, 0.35, 1)
    symbol2.position.y = 0.48
    g.add(halo, handle, head2, symbol, symbol2)
  }
  return shadowed(g)
}

function quadruped({ color, len = 0.55, h = 0.28, headR = 0.12, eye = '#FFD23F', legs = 4, legColor = null, tail = true }) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 14), mat(color, { roughness: 0.85 }))
  body.scale.set(h * 1.25, h * 1.1, len)
  body.position.y = h + 0.08
  g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), mat(color, { roughness: 0.85 }))
  head.position.set(0, h + 0.14, len * 0.5)
  g.add(head)
  g.add(eyes(eye, h + 0.18, len * 0.5 + headR * 0.85, headR * 0.45, headR * 0.2))
  const lc = mat(legColor ?? color)
  const n = legs / 2
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, h + 0.05, 6), lc)
      const z = -len * 0.3 + (i * len * 0.6) / Math.max(1, n - 1)
      leg.position.set(s * h * 0.35, (h + 0.05) / 2 + 0.06, z)
      if (legs > 4) {
        leg.rotation.z = s * 0.9
        leg.position.x = s * h * 0.75
        leg.position.y = h * 0.55
      }
      g.add(leg)
    }
  }
  if (tail) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.03, len * 0.7, 6), mat(color))
    t.rotation.x = Math.PI / 2 + 0.4
    t.position.set(0, h + 0.02, -len * 0.75)
    g.add(t)
  }
  return g
}

function biped({ color, scale = 1, skin = color, eye = '#FF4D3A', hood = false, crown = false, bony = false }) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(bony ? 0.07 : 0.15, bony ? 0.1 : 0.22, 0.5, 12), mat(color, { roughness: 0.8 }))
  body.position.y = 0.34
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), mat(skin, { roughness: 0.7 }))
  head.position.y = 0.72
  g.add(body, head, eyes(eye, 0.74, 0.11, 0.05, 0.022))
  if (bony) {
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.11 - i * 0.012, 0.012, 6, 16), mat(skin))
      rib.rotation.x = Math.PI / 2
      rib.position.y = 0.5 - i * 0.07
      g.add(rib)
    }
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), mat(skin))
      leg.position.set(s * 0.06, 0.2, 0)
      g.add(leg)
    }
  }
  if (hood) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.32, 14), mat(color))
    h.position.y = 0.82
    g.add(h)
  }
  if (crown) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.09, 8, 1, true), mat('#9EE7FF', { emissive: '#5BC8FF', emissiveIntensity: 1.2, side: THREE.DoubleSide }))
    c.position.y = 0.85
    g.add(c)
  }
  g.scale.setScalar(scale)
  return g
}

function makeDragon() {
  const g = new THREE.Group()
  const red = mat('#B5302A', { roughness: 0.55 })
  const belly = mat('#E8A85A', { roughness: 0.7 })
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), red)
  body.scale.set(0.75, 0.6, 1.1)
  body.position.y = 0.6
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), belly)
  chest.scale.set(0.6, 0.5, 0.9)
  chest.position.set(0, 0.5, 0.12)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 0.7, 12), red)
  neck.position.set(0, 1.0, 0.5)
  neck.rotation.x = 0.6
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.45), red)
  head.position.set(0, 1.32, 0.78)
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.25), red)
  snout.position.set(0, 1.27, 1.05)
  g.add(body, chest, neck, head, snout, eyes('#FFE14D', 1.38, 0.98, 0.1, 0.035))
  for (const s of [-1, 1]) {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 8), mat('#F2E6C9'))
    horn.position.set(s * 0.1, 1.5, 0.66)
    horn.rotation.x = -0.6
    const wing = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 1.2, 0.5, -0.3), new THREE.Vector3(s * 0.9, -0.1, -0.7), new THREE.Vector3(0, 0, 0), new THREE.Vector3(s * 0.9, -0.1, -0.7), new THREE.Vector3(s * 0.2, 0, -0.5)]), mat('#7E1F1B', { side: THREE.DoubleSide }))
    wing.geometry.computeVertexNormals()
    wing.position.set(s * 0.2, 0.9, 0)
    wing.userData.wing = s
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.4, 8), red)
    leg.position.set(s * 0.3, 0.22, 0.25)
    const leg2 = leg.clone()
    leg2.position.z = -0.3
    g.add(horn, wing, leg, leg2)
  }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.15, 1.1, 10), red)
  tail.rotation.x = -Math.PI / 2 - 0.25
  tail.position.set(0, 0.45, -0.95)
  g.add(tail)
  return g
}

function makeMonster(look, boss) {
  let figure
  switch (look) {
    case 'rat':
      figure = quadruped({ color: '#A08C7A', len: 0.5, h: 0.2, headR: 0.1, eye: '#FF3B30' })
      figure.scale.setScalar(1.35)
      break
    case 'wolf':
      figure = quadruped({ color: '#6B6F78', len: 0.7, h: 0.32, headR: 0.13, eye: '#FFD23F' })
      break
    case 'spider':
      figure = quadruped({ color: '#2B2430', len: 0.6, h: 0.3, headR: 0.14, eye: '#FF2E63', legs: 8, tail: false })
      break
    case 'goblin':
      figure = biped({ color: '#6B4E2E', skin: '#7DAA4A', scale: 0.8, eye: '#FFE14D' })
      break
    case 'skeleton':
      figure = biped({ color: '#E9E3D3', skin: '#EFEADB', bony: true, eye: '#55C8FF' })
      break
    case 'cultist':
      figure = biped({ color: '#3D1F3F', skin: '#D9B8A0', hood: true, eye: '#FF4D3A' })
      break
    case 'ogre':
      figure = biped({ color: '#7A5C3A', skin: '#9DAA6A', scale: 1.6, eye: '#FF7A1A' })
      break
    case 'lich':
      figure = biped({ color: '#22324A', skin: '#E7EEF2', crown: true, scale: 1.45, eye: '#7FE3FF', bony: true })
      break
    case 'dragon':
      figure = makeDragon()
      break
    case 'slime':
    default: {
      figure = new THREE.Group()
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), new THREE.MeshStandardMaterial({ color: '#6BD45A', transparent: true, opacity: 0.8, roughness: 0.15 }))
      blob.scale.y = 0.7
      blob.position.y = 0.26
      figure.add(blob, eyes('#123', 0.38, 0.27, 0.08, 0.03))
    }
  }
  const g = new THREE.Group()
  const r = look === 'dragon' ? 0.9 : look === 'ogre' || look === 'lich' ? 0.5 : 0.36
  g.add(base(boss ? '#FF5A3C' : '#B23A48', r))
  figure.position.y = 0.08 // built facing +z: toward the heroes
  g.add(figure)
  g.userData.figure = figure
  g.userData.radius = r
  return shadowed(g)
}

/* -- props for the room features ---------------------------------------------- */

function makeProp(kind) {
  const g = new THREE.Group()
  const wood = mat('#7A5233')
  const stone = mat('#8C8790')
  if (kind === 'chest' || kind === 'sneak') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.32, 0.4), wood)
    box.position.y = 0.16
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.6, 12, 1, false, 0, Math.PI), wood)
    lid.rotation.z = Math.PI / 2
    lid.position.y = 0.32
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), mat('#C9A227', { metalness: 0.6 }))
    band.position.y = 0.3
    g.add(box, lid, band)
  } else if (kind === 'trap') {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.8), stone)
    plate.position.y = 0.03
    g.add(plate)
    for (let i = 0; i < 9; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 6), mat('#B9BEC6', { metalness: 0.6 }))
      spike.position.set(((i % 3) - 1) * 0.22, 0.13, (Math.floor(i / 3) - 1) * 0.22)
      g.add(spike)
    }
  } else if (kind === 'altar') {
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.45, 0.45), stone)
    block.position.y = 0.22
    g.add(block)
    for (const s of [-1, 1]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.16, 8), mat('#2A2630'))
      candle.position.set(s * 0.28, 0.53, 0)
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), mat('#B98CFF', { emissive: '#8F5BFF', emissiveIntensity: 2 }))
      flame.position.set(s * 0.28, 0.65, 0)
      flame.userData.flame = true
      g.add(candle, flame)
    }
  } else if (kind === 'sign') {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.12), stone)
    slab.position.y = 0.4
    const runes = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.56), new THREE.MeshStandardMaterial({ map: textTexture('ᚱᚢᚾ', { size: 128, fg: '#9FE3FF', font: '700 60px serif' }), transparent: true, emissive: '#62C7FF', emissiveIntensity: 0.4 }))
    runes.position.set(0, 0.42, 0.065)
    g.add(slab, runes)
  } else if (kind === 'camp') {
    for (let i = 0; i < 3; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), wood)
      log.rotation.set(Math.PI / 2, (i * Math.PI) / 3, 0)
      log.rotation.order = 'YXZ'
      log.position.y = 0.06
      g.add(log)
    }
    const fire = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.32, 10), mat('#FFB347', { emissive: '#FF7A1A', emissiveIntensity: 2.2 }))
    fire.position.y = 0.22
    fire.userData.flame = true
    g.add(fire)
  } else if (kind === 'bridge') {
    for (let i = 0; i < 6; i++) {
      if (i === 3) continue // the missing plank
      const plank = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.16), wood)
      plank.position.set(0, 0.03, -0.5 + i * 0.2)
      g.add(plank)
    }
    for (const s of [-1, 1]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.2, 6), mat('#C8B07A'))
      rope.rotation.x = Math.PI / 2
      rope.position.set(s * 0.36, 0.25, 0)
      g.add(rope)
    }
  }
  return shadowed(g)
}

function makeTorch() {
  const g = new THREE.Group()
  const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.1, 0.28), mat('#4C4650', { roughness: 0.9 }))
  pillar.position.y = 0.55
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.1, 10), mat('#2A2630', { metalness: 0.5 }))
  bowl.position.y = 1.15
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 10), mat('#FFC46B', { emissive: '#FF8A1F', emissiveIntensity: 2.4 }))
  flame.position.y = 1.35
  flame.userData.flame = true
  g.add(pillar, bowl, flame)
  return shadowed(g, true, false)
}

/* -- labels: health bars and floating numbers ------------------------------------- */

function barTexture(name, hp, max, color, down) {
  return canvasTexture(320, 96, (ctx, W) => {
    ctx.font = '800 30px "Bricolage Grotesque", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(15,12,20,.85)'
    const label = name.length > 16 ? `${name.slice(0, 15)}…` : name
    ctx.strokeText(label, W / 2, 26)
    ctx.fillStyle = down ? '#9A94A0' : '#FFFFFF'
    ctx.fillText(label, W / 2, 26)
    ctx.fillStyle = 'rgba(15,12,20,.85)'
    ctx.beginPath()
    ctx.roundRect(30, 52, W - 60, 30, 15)
    ctx.fill()
    const pct = max ? Math.max(0, hp / max) : 0
    ctx.fillStyle = pct > 0.5 ? '#4CC46B' : pct > 0.25 ? '#F2B233' : '#E5484D'
    if (pct > 0) {
      ctx.beginPath()
      ctx.roundRect(34, 56, (W - 68) * pct, 22, 11)
      ctx.fill()
    }
    ctx.fillStyle = '#FFFFFF'
    ctx.font = '800 20px "Bricolage Grotesque", system-ui, sans-serif'
    ctx.fillText(`${hp}/${max}`, W / 2, 68)
    if (color) {
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(18, 26, 9, 0, Math.PI * 2)
      ctx.fill()
    }
  })
}

function makeBar() {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))
  s.scale.set(1.15, 0.345, 1)
  s.renderOrder = 20
  return s
}

function floatText(text, color) {
  const tex = textTexture(text, { size: 128, width: 256, fg: color, font: '900 84px "Bricolage Grotesque", system-ui, sans-serif' })
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  s.scale.set(0.9, 0.45, 1)
  s.renderOrder = 30
  return s
}

const signCache = new Map()
function doorSign(text) {
  if (!signCache.has(text)) {
    const tex = textTexture(`🚪 ${text}`, { size: 96, width: 520, bg: 'rgba(20,16,26,.85)', fg: '#FFE9C7', radius: 40, font: '800 44px "Bricolage Grotesque", system-ui, sans-serif' })
    tex.userData.shared = true
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    m.userData.shared = true
    signCache.set(text, m)
  }
  const s = new THREE.Sprite(signCache.get(text))
  s.scale.set(1.6, 0.3, 1)
  s.renderOrder = 25
  return s
}

/* -- the d20 ---------------------------------------------------------------------- */

function makeD20() {
  const g = new THREE.Group()
  const die = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32), new THREE.MeshStandardMaterial({ color: '#D9433A', roughness: 0.35, metalness: 0.1, flatShading: true }))
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(die.geometry), new THREE.LineBasicMaterial({ color: '#FFE3C2', transparent: true, opacity: 0.6 }))
  die.add(edges)
  die.castShadow = true
  g.add(die)
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }))
  label.scale.set(0.55, 0.55, 1)
  label.position.y = 0.62
  label.renderOrder = 40
  label.visible = false
  g.add(label)
  g.userData = { die, label }
  g.visible = false
  return g
}

/* -- the stage --------------------------------------------------------------------- */

export function create(container, handlers) {
  let framing = { fitHalfWidth: 4.5, fitHalfDepth: 4, target: [0, 0, 0] }
  const stage = createStage(
    container,
    { background: '#141119', fov: 36, tilt: 0.84, portraitTilt: 0.92, minDistance: 4, maxPolar: 1.05, shadowSize: 12, exposure: 1.15, layout: () => framing },
    handlers,
  )
  const { scene, world, camera, controls } = stage
  const glow = makeGlow(stage)
  // night in the dungeon: the stage's daylight becomes a cold, dim glow
  scene.traverse((o) => {
    if (o.isHemisphereLight) {
      o.intensity = 0.55
      o.color.set('#8C9BC8')
      o.groundColor.set('#2A2230')
    }
    if (o.isDirectionalLight) {
      o.intensity = 0.55
      o.color.set('#AFC2FF')
    }
  })

  const mapGroup = new THREE.Group()
  const propGroup = new THREE.Group()
  const figures = new THREE.Group()
  const marks = new THREE.Group()
  const floats = new THREE.Group()
  world.add(mapGroup, propGroup, figures, marks, floats)

  const torches = [0, 1, 2, 3].map(() => {
    const t = makeTorch()
    const light = new THREE.PointLight('#FFB061', 7, 11, 1.6)
    light.position.y = 1.5
    t.add(light)
    t.userData.light = light
    t.visible = false
    world.add(t)
    return t
  })

  const d20 = makeD20()
  world.add(d20)

  let theme = THEMES.cripta
  let adventure = null
  const roomMeshes = new Map() // room id -> { group, known: 'visited' | 'near' }
  const corridorKeys = new Set()
  let currentRoom = null
  const heroes = new Map() // name -> { group, bar, key }
  const monsters = new Map() // id -> { group, bar, key, dead }
  const hpSeen = new Map()
  let rollSeen = null
  let current = null
  let firstUpdate = true

  /* map */
  function ensureRoom(r, known) {
    const had = roomMeshes.get(r.id)
    if (had && had.known === known) return
    if (had) mapGroup.remove(had.group)
    const B = bounds(r)
    const g = new THREE.Group()
    const visited = known === 'visited'
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(B.w, ROOM_H, B.d),
      visited
        ? [mat(theme.rim), mat(theme.rim), new THREE.MeshStandardMaterial({ map: floorTexture(theme, B.w, B.d, r.pos[0] * 7 + r.pos[1]), roughness: 0.9 }), mat(theme.rim), mat(theme.rim), mat(theme.rim)]
        : new THREE.MeshStandardMaterial({ color: '#2B2632', roughness: 1, transparent: true, opacity: 0.85 }),
    )
    slab.position.y = ROOM_H / 2
    slab.receiveShadow = true
    g.add(slab)
    if (visited) {
      const name = floorLabel(r.name, Math.min(B.w - 0.4, 3.4), 0.42, { fg: 'rgba(255,240,220,.55)', font: '800 92px "Bricolage Grotesque", system-ui, sans-serif' })
      name.position.set(B.cx, ROOM_H + 0.006, B.z1 - 0.32)
      g.add(name)
    } else {
      const q = floorLabel('?', 1.2, 1.2, { fg: 'rgba(255,255,255,.35)', font: '900 200px "Bricolage Grotesque", system-ui, sans-serif' })
      q.position.set(B.cx, ROOM_H + 0.006, B.cz)
      g.add(q)
    }
    slab.position.x = B.cx
    slab.position.z = B.cz
    if (!had && !firstUpdate && !stage.reduce) {
      g.scale.y = 0.01
      animate(g.scale, { y: 1, duration: 500, ease: 'outBack(1.6)' })
    }
    mapGroup.add(g)
    roomMeshes.set(r.id, { group: g, known })
  }

  function ensureCorridor(a, b, rooms) {
    const key = [a, b].sort().join('|')
    if (corridorKeys.has(key)) return
    corridorKeys.add(key)
    const ra = rooms.find((r) => r.id === a)
    const rb = rooms.find((r) => r.id === b)
    for (const [x0, z0, x1, z1] of corridor(ra, rb)) {
      const len = Math.hypot(x1 - x0, z1 - z0) + 1
      const horizontal = Math.abs(x1 - x0) > Math.abs(z1 - z0)
      const strip = new THREE.Mesh(new THREE.BoxGeometry(horizontal ? len : 1, 0.12, horizontal ? 1 : len), mat(theme.corridor, { roughness: 0.95 }))
      strip.position.set((x0 + x1) / 2, 0.06, (z0 + z1) / 2)
      strip.receiveShadow = true
      mapGroup.add(strip)
    }
  }

  function syncMap(game) {
    const rooms = game.rooms
    const near = new Set()
    for (const r of rooms) if (r.visited) r.exits.forEach((e) => near.add(e))
    for (const r of rooms) {
      if (r.visited) ensureRoom(r, 'visited')
      else if (near.has(r.id)) ensureRoom(r, 'near')
    }
    for (const r of rooms) if (r.visited) r.exits.forEach((e) => ensureCorridor(r.id, e, rooms))
  }

  /* camera */
  function frameRoom(r, instant) {
    const B = bounds(r)
    framing = { fitHalfWidth: Math.max(B.w / 2 + 1.4, 3.6), fitHalfDepth: Math.max(B.d / 2 + 1.8, 3.4), target: [B.cx, 0, B.cz + 0.2] }
    if (instant || stage.reduce) return stage.refit()
    const fromPos = camera.position.clone()
    const fromTarget = controls.target.clone()
    stage.refit()
    const toPos = camera.position.clone()
    const toTarget = controls.target.clone()
    camera.position.copy(fromPos)
    controls.target.copy(fromTarget)
    const k = { t: 0 }
    animate(k, {
      t: 1,
      duration: 1100,
      ease: 'inOutCubic',
      onUpdate: () => {
        camera.position.lerpVectors(fromPos, toPos, k.t)
        controls.target.lerpVectors(fromTarget, toTarget, k.t)
      },
    })
  }

  function placeTorches(r) {
    const B = bounds(r)
    const spots = [[B.x0 + 0.3, B.z0 + 0.3], [B.x1 - 0.3, B.z0 + 0.3], [B.x0 + 0.3, B.z1 - 0.3], [B.x1 - 0.3, B.z1 - 0.3]]
    torches.forEach((t, i) => {
      t.visible = true
      t.position.set(spots[i][0], ROOM_H, spots[i][1])
    })
  }

  /* props */
  let propKey = null
  function syncProps(game) {
    const r = game.rooms.find((x) => x.id === game.room)
    const key = r?.feature ? `${r.id}|${r.feature.done}` : null
    if (key === propKey) return
    propKey = key
    propGroup.clear()
    if (!r?.feature) return
    const B = bounds(r)
    const p = makeProp(r.feature.kind)
    p.position.set(B.x1 - 0.5, ROOM_H, B.cz - 0.1)
    p.rotation.y = -Math.PI / 2
    if (r.feature.done) {
      // already tried: the prop goes dark and sinks a little
      p.scale.setScalar(0.85)
      p.traverse((o) => {
        if (o.userData.flame) o.visible = false
      })
    }
    propGroup.add(p)
  }

  /* figures */
  function slots(n, B, z, gap = 1.05) {
    const span = Math.min(B.w - 1.2, Math.max(1, n - 1) * gap)
    return Array.from({ length: n }, (_, i) => [B.cx + (n === 1 ? 0 : -span / 2 + (span * i) / (n - 1)), z])
  }

  function syncHeroes(game, colors) {
    const r = game.rooms.find((x) => x.id === game.room)
    const B = bounds(r)
    const list = game.heroes.filter((h) => h.cls)
    const fighting = game.phase === 'combat'
    const pos = slots(list.length, B, fighting ? B.cz + B.d * 0.22 : B.cz + Math.min(0.5, B.d * 0.15), fighting ? 1.05 : 0.85)
    const keep = new Set()
    list.forEach((h, i) => {
      keep.add(h.name)
      let entry = heroes.get(h.name)
      if (!entry) {
        const group = makeHero(h.cls, colors[h.name] ?? '#888')
        const bar = makeBar()
        bar.position.y = 1.35
        group.add(bar)
        entry = { group, bar, key: '' }
        heroes.set(h.name, entry)
        figures.add(group)
        group.position.set(pos[i][0], ROOM_H, pos[i][1])
      }
      const key = `${h.hp}|${h.maxHp}|${h.down}`
      if (key !== entry.key) {
        entry.key = key
        entry.bar.material.map?.dispose()
        entry.bar.material.map = barTexture(h.name, h.hp, h.maxHp, colors[h.name], h.down)
        entry.bar.material.needsUpdate = true
      }
      const g = entry.group
      const target = new THREE.Vector3(pos[i][0], ROOM_H, pos[i][1])
      if (g.position.distanceTo(target) > 0.05) walk(g, target)
      const lying = h.down ? Math.PI / 2 : 0
      if (Math.abs(g.rotation.z - lying) > 0.01) {
        if (stage.reduce) g.rotation.z = lying
        else animate(g.rotation, { z: lying, duration: 500, ease: h.down ? 'outBounce' : 'outBack(2)' })
      }
      g.userData.data = h
    })
    for (const [name, e] of heroes) if (!keep.has(name)) (figures.remove(e.group), heroes.delete(name))
  }

  function syncMonsters(game) {
    const r = game.rooms.find((x) => x.id === game.room)
    const B = bounds(r)
    const list = game.monsters
    const living = list.filter((m) => m.hp > 0)
    const deepest = Math.max(0.36, ...living.map((m) => (m.look === 'dragon' ? 1.1 : m.look === 'ogre' || m.look === 'lich' ? 0.6 : 0.36)))
    const pos = slots(living.length, B, Math.min(B.cz - B.d * 0.2, B.z0 + deepest + 0.45), 1.35)
    const ids = new Set(list.map((m) => m.id))
    let i = 0
    for (const m of list) {
      let entry = monsters.get(m.id)
      if (!entry) {
        const group = makeMonster(m.look, m.boss)
        const bar = makeBar()
        bar.position.y = m.look === 'dragon' ? 2.0 : m.look === 'ogre' || m.look === 'lich' ? 1.75 : 1.2
        group.add(bar)
        entry = { group, bar, key: '', dead: false }
        monsters.set(m.id, entry)
        figures.add(group)
        const p = pos[Math.min(i, pos.length - 1)] ?? [B.cx, B.cz]
        group.position.set(p[0], ROOM_H, p[1])
        if (!stage.reduce) {
          group.position.y = ROOM_H - 1.2
          animate(group.position, { y: ROOM_H, duration: 800, delay: 200 + i * 160, ease: 'outBack(1.4)' })
        }
      }
      const key = `${m.hp}|${m.maxHp}`
      if (key !== entry.key) {
        entry.key = key
        entry.bar.material.map?.dispose()
        entry.bar.material.map = barTexture(m.name, m.hp, m.maxHp, null, m.hp <= 0)
        entry.bar.material.needsUpdate = true
      }
      if (m.hp <= 0 && !entry.dead) {
        entry.dead = true
        die(entry)
      } else if (m.hp > 0) {
        const p = pos[i]
        const target = new THREE.Vector3(p[0], ROOM_H, p[1])
        if (entry.group.position.distanceTo(target) > 0.05 && Math.abs(entry.group.position.y - ROOM_H) < 0.01) walk(entry.group, target)
        i++
      }
      entry.group.userData.data = m
    }
    for (const [id, e] of monsters) {
      if (!ids.has(id)) {
        if (!e.dead) vanish(e.group)
        else figures.remove(e.group)
        monsters.delete(id)
      }
    }
  }

  function walk(g, to) {
    if (stage.reduce) return void g.position.copy(to)
    const from = g.position.clone()
    const k = { t: 0 }
    animate(k, {
      t: 1,
      duration: 700,
      ease: 'inOutSine',
      onUpdate: () => {
        g.position.lerpVectors(from, to, k.t)
        g.position.y = to.y + Math.abs(Math.sin(k.t * Math.PI * 4)) * 0.08
      },
    })
  }

  function die(entry) {
    const g = entry.group
    entry.bar.visible = false
    if (stage.reduce) return void (g.visible = false)
    const fig = g.userData.figure
    animate(fig.rotation, { x: -Math.PI / 2, duration: 450, ease: 'inQuad' })
    animate(g.position, { y: ROOM_H - 0.9, duration: 900, delay: 700, ease: 'inQuad', onComplete: () => (g.visible = false) })
  }

  /** Who is who, by display name (rolls name the roller, not the id). */
  function figureByName(name) {
    if (heroes.has(name)) return heroes.get(name).group
    for (const e of monsters.values()) if (e.group.userData.data?.name === name) return e.group
    return null
  }

  function lunge(from, to) {
    if (!from || !to || stage.reduce) return
    const home = from.position.clone()
    const dir = to.position.clone().sub(home)
    dir.y = 0
    const reach = home.clone().add(dir.multiplyScalar(0.35))
    const k = { t: 0 }
    animate(k, {
      t: [0, 1, 0],
      duration: 520,
      ease: 'inOutQuad',
      onUpdate: () => {
        from.position.lerpVectors(home, reach, k.t)
        from.position.y = home.y + Math.sin(k.t * Math.PI) * 0.15
      },
    })
  }

  function shake(g) {
    if (!g || stage.reduce) return
    const x = g.position.x
    animate(g.position, { x: [x - 0.08, x + 0.08, x - 0.05, x], duration: 360, ease: 'inOutSine' })
  }

  function floatNumber(g, text, color) {
    if (!g) return
    const s = floatText(text, color)
    const p = g.position.clone()
    s.position.set(p.x, p.y + 1.1, p.z)
    floats.add(s)
    if (stage.reduce) return void setTimeout(() => floats.remove(s), 1200)
    animate(s.position, { y: p.y + 2.0, duration: 1300, ease: 'outCubic' })
    animate(s.material, { opacity: [1, 1, 0], duration: 1300, ease: 'inQuad', onComplete: () => (floats.remove(s), s.material.map.dispose()) })
  }

  function syncDamage(game) {
    const all = [...game.heroes.filter((h) => h.cls).map((h) => [h.name, h.hp, heroes.get(h.name)?.group]), ...game.monsters.map((m) => [m.id, m.hp, monsters.get(m.id)?.group])]
    for (const [id, hp, g] of all) {
      const before = hpSeen.get(id)
      hpSeen.set(id, hp)
      if (before == null || before === hp || firstUpdate) continue
      if (hp < before) {
        floatNumber(g, `-${before - hp}`, '#FF5A4D')
        shake(g)
      } else floatNumber(g, `+${hp - before}`, '#5BE07A')
    }
  }

  function syncRoll(game) {
    const roll = game.lastRoll
    if (!roll || roll.id === rollSeen) return
    const first = rollSeen === null && firstUpdate
    rollSeen = roll.id
    if (first) return
    const r = game.rooms.find((x) => x.id === game.room)
    const B = bounds(r)
    const { die, label } = d20.userData
    const color = roll.ok === false ? '#E5484D' : roll.ok ? '#3FB463' : '#FFFFFF'
    label.material.map?.dispose()
    label.material.map = textTexture(String(roll.natural), { size: 128, bg: 'rgba(20,16,26,.88)', fg: roll.natural === 20 ? '#FFD34D' : roll.natural === 1 ? '#FF6B5E' : '#FFFFFF', radius: 64, border: color, font: '900 76px "Bricolage Grotesque", system-ui, sans-serif' })
    label.material.needsUpdate = true
    label.visible = false
    d20.visible = true
    const land = [B.x1 - 0.9, ROOM_H + 0.3, B.z1 - 0.75]
    if (stage.reduce) {
      d20.position.set(...land)
      label.visible = true
    } else {
      d20.position.set(land[0] - 1.2, ROOM_H + 2.6, land[2] + 1.2)
      animate(d20.position, { x: land[0], z: land[2], duration: 800, ease: 'outQuad' })
      animate(d20.position, { y: [ROOM_H + 2.6, land[1], land[1] + 0.35, land[1], land[1] + 0.1, land[1]], duration: 900, ease: 'linear' })
      animate(die.rotation, { x: die.rotation.x + 9 + Math.random() * 3, y: die.rotation.y + 7, z: die.rotation.z + 5, duration: 900, ease: 'outQuad', onComplete: () => (label.visible = true) })
    }
    clearTimeout(d20.userData.hide)
    d20.userData.hide = setTimeout(() => (d20.visible = false), 3600)
    if (roll.kind === 'attack') {
      const target = roll.label.replace(/^Ataque a /, '')
      setTimeout(() => lunge(figureByName(roll.who), figureByName(target)), stage.reduce ? 0 : 500)
    }
  }

  /* what can be tapped */
  function syncMarks(state) {
    const { game } = state
    marks.clear()
    stage.clearPickables()
    // whose turn it is: a golden ring under them
    const turnFig = game.turn ? heroes.get(game.turn)?.group ?? monsters.get(game.turn)?.group : null
    if (turnFig) {
      const ring = glowRing(mat('#FFD34D', { emissive: '#FFB800', emissiveIntensity: 1.2, transparent: true, opacity: 0.9 }), (turnFig.userData.radius ?? 0.36) + 0.12, 0.04)
      ring.position.copy(turnFig.position)
      ring.position.y = ROOM_H + 0.03
      ring.userData.follow = turnFig
      marks.add(ring)
    }
    if (state.canMove) {
      const r = game.rooms.find((x) => x.id === game.room)
      const A = bounds(r)
      for (const id of r.exits) {
        const ex = game.rooms.find((x) => x.id === id)
        // the door: just outside this room, on the corridor
        const [x0, z0, x1, z1] = corridor(r, ex)[0]
        const len = Math.hypot(x1 - x0, z1 - z0) || 1
        const dx = (x1 - x0) / len
        const dz = (z1 - z0) / len
        const tx = dx > 0 ? (A.x1 - x0) / dx : dx < 0 ? (A.x0 - x0) / dx : Infinity
        const tz = dz > 0 ? (A.z1 - z0) / dz : dz < 0 ? (A.z0 - z0) / dz : Infinity
        const t = Math.min(tx, tz) + 0.5
        const door = [x0 + dx * t, z0 + dz * t]
        const ring = glowRing(glow, 0.36, 0.045)
        ring.position.set(door[0], 0.15, door[1])
        marks.add(ring)
        const sign = doorSign(ex.visited ? ex.name : 'Sala sin explorar')
        sign.position.set(door[0], 0.75, door[1])
        marks.add(sign)
        const hit = hitBox(0.9, 1.2, 0.9)
        hit.position.set(door[0], 0.4, door[1])
        marks.add(hit)
        stage.pickable(hit, { kind: 'exit', id, marker: ring, name: ex.name })
        // the room behind the door lights up too, for a bigger target
        const B = bounds(ex)
        const far = hitBox(B.w, 0.6, B.d)
        far.position.set(B.cx, ROOM_H, B.cz)
        marks.add(far)
        stage.pickable(far, { kind: 'exit', id, marker: ring, name: ex.name })
      }
    }
    if (state.canFeature && propGroup.children[0]) {
      const p = propGroup.children[0]
      const ring = glowRing(glow, 0.6, 0.04)
      ring.position.set(p.position.x, ROOM_H + 0.04, p.position.z)
      marks.add(ring)
      const hit = hitBox(1.2, 1.2, 1.2)
      hit.position.copy(p.position)
      marks.add(hit)
      stage.pickable(hit, { kind: 'feature', id: game.room, marker: ring, priority: 1 })
    }
    if (state.targeting === 'monster') {
      for (const [id, e] of monsters) {
        if (e.dead) continue
        addTarget(e.group, { kind: 'monster', id })
      }
    }
    if (state.targeting === 'hero') {
      for (const [name, e] of heroes) addTarget(e.group, { kind: 'hero', id: name }, '#FF8FB1')
    }
  }

  function addTarget(g, data, color = '#FF5A4D') {
    const r = (g.userData.radius ?? 0.36) + 0.12
    const ring = glowRing(mat(color, { emissive: color, emissiveIntensity: 1, transparent: true, opacity: 0.9 }), r, 0.045)
    ring.position.set(g.position.x, ROOM_H + 0.04, g.position.z)
    ring.userData.pulse = true
    marks.add(ring)
    const hit = hitBox(r * 2.2, 1.6, r * 2.2)
    hit.position.set(g.position.x, ROOM_H + 0.6, g.position.z)
    marks.add(hit)
    stage.pickable(hit, { ...data, marker: g, priority: 2 })
  }

  stage.onFrame((t) => {
    torches.forEach((tc, i) => {
      if (!tc.visible) return
      const f = 0.85 + Math.sin(t * 11 + i * 2) * 0.08 + Math.sin(t * 23 + i) * 0.05
      tc.userData.light.intensity = 7 * f
      tc.children[2].scale.set(1, f * 1.1, 1)
    })
    world.traverse((o) => {
      if (o.userData.flame) o.scale.y = 0.9 + Math.sin(t * 13 + o.id) * 0.15
      if (o.userData.orb) o.position.y = 1.0 + Math.sin(t * 2.5 + o.id) * 0.03
      if (o.userData.wing) o.rotation.z = o.userData.wing * Math.sin(t * 2.2) * 0.25
    })
    marks.children.forEach((m) => {
      if (m.userData.follow) {
        m.position.x = m.userData.follow.position.x
        m.position.z = m.userData.follow.position.z
      }
      if (m.userData.pulse) m.scale.setScalar(1 + Math.sin(t * 5) * 0.08)
    })
    // idle breathing for the living
    for (const e of monsters.values()) {
      if (e.dead) continue
      const fig = e.group.userData.figure
      fig.scale.y = 1 + Math.sin(t * 3 + e.group.id) * 0.03
    }
  })

  return {
    update(state) {
      const { game } = state
      if (adventure !== game.adventure.key) {
        adventure = game.adventure.key
        theme = THEMES[adventure] ?? THEMES.cripta
        stage.scene.background.set(theme.bg)
        stage.scene.fog.color.set(theme.bg)
      }
      syncMap(game)
      if (currentRoom !== game.room) {
        const r = game.rooms.find((x) => x.id === game.room)
        frameRoom(r, firstUpdate)
        placeTorches(r)
        // the figures of the previous room walk over (or appear) in the new one
        currentRoom = game.room
      }
      syncProps(game)
      syncHeroes(game, state.colors)
      syncMonsters(game)
      syncDamage(game)
      syncRoll(game)
      syncMarks(state)
      firstUpdate = false
      current = state
    },
    get state() {
      return current
    },
    resetView: stage.resetView,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose() {
      clearTimeout(d20.userData.hide)
      stage.dispose()
    },
  }
}
