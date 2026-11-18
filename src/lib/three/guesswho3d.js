/**
 * Guess Who in 3D: your board is a stepped tray of hinged frames, one per
 * character. Tap a frame to flip it down (it falls back on its hinge and
 * shows your color) or to stand it up again. While guessing, tapping picks a
 * character instead and it lights up. Your own secret character stands in a
 * slot at the front of the tray.
 *
 * state: { characters, portraits: { id: svg }, flipped: Set, picked, guessing,
 *          interactive, secret, color }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, canvasTexture, hitBox, makeGlow, mat, roundedPlane, shadowed } from './kit'
import { animate } from 'animejs'

const CW = 0.86 // frame width
const CH = 1.12 // frame height
const GAP_X = 1.0
const ROW_Z = 1.15
const ROW_UP = 0.32
const STAND = -0.12 // standing frames lean back a little
const DOWN = -1.5

/** Portrait + name, drawn on a canvas once the SVG has loaded. */
const portraitCache = new Map()
function portraitTexture(c, svg) {
  const key = `${c.id}|${svg.length}`
  if (portraitCache.has(key)) return portraitCache.get(key)
  const tex = canvasTexture(256, 334, (ctx) => {
    ctx.fillStyle = '#F7F4EE'
    ctx.fillRect(0, 0, 256, 334)
  })
  const img = new Image()
  img.onload = () => {
    const ctx = tex.image.getContext('2d')
    ctx.drawImage(img, 0, 0, 256, 256)
    ctx.fillStyle = '#F7F4EE'
    ctx.fillRect(0, 256, 256, 78)
    ctx.fillStyle = '#22252E'
    ctx.font = '700 34px "Instrument Sans", system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let name = c.name
    while (ctx.measureText(name).width > 236 && name.length > 3) name = name.slice(0, -2) + '…'
    ctx.fillText(name, 128, 296)
    tex.needsUpdate = true
  }
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  portraitCache.set(key, tex)
  return tex
}

function backTexture(color) {
  return canvasTexture(
    128,
    166,
    (ctx) => {
      ctx.fillStyle = color
      ctx.fillRect(0, 0, 128, 166)
      ctx.globalAlpha = 0.35
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(50, 83, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.55
      ctx.beginPath()
      ctx.arc(78, 83, 22, 0, Math.PI * 2)
      ctx.fill()
    },
    `gw|back|${color}`,
  )
}

export function create(container, handlers) {
  let cols = 8
  let relayout = null
  let current = null
  const stage = createStage(
    container,
    {
      background: '#E9E1F1',
      tilt: 0.72,
      portraitTilt: 0.8,
      maxPolar: 1.25,
      target: [0, 0.4, 0.5],
      layout: (aspect) => {
        const wide = aspect > 1.15
        const next = wide ? 8 : 4
        if (next !== cols) {
          cols = next
          relayout?.()
        }
        const rows = Math.ceil((current?.characters.length ?? 24) / cols)
        return { fitHalfWidth: (cols * GAP_X) / 2 + (wide ? 1.1 : 0.6), fitHalfDepth: (rows * ROW_Z) / 2 + (wide ? 1.9 : 2.4) }
      },
    },
    handlers,
  )
  const { world } = stage
  const glow = makeGlow(stage)
  const tray = new THREE.Group()
  const framesGroup = new THREE.Group()
  world.add(tray, framesGroup)

  let boardKey = ''
  const frames = new Map() // id -> { pivot, card, down }
  let secretSlot = null

  function frameFor(c, state) {
    const pivot = new THREE.Group() // hinge at the bottom edge
    const holder = new THREE.Group()
    holder.position.y = CH / 2 + 0.04
    const frameMat = mat(state.color, { roughness: 0.45 })
    const body = new THREE.Mesh(new RoundedBoxGeometry(CW, CH, 0.06, 3, 0.04), frameMat)
    const face = new THREE.Mesh(roundedPlane(CW - 0.1, CH - 0.1, 0.05), new THREE.MeshStandardMaterial({ map: portraitTexture(c, state.portraits[c.id] ?? ''), roughness: 0.6 }))
    face.position.z = 0.031
    const back = new THREE.Mesh(roundedPlane(CW - 0.12, CH - 0.12, 0.05), new THREE.MeshStandardMaterial({ map: backTexture(state.color), roughness: 0.6 }))
    back.rotation.y = Math.PI
    back.position.z = -0.031
    const halo = new THREE.Mesh(roundedPlane(CW + 0.16, CH + 0.16, 0.1), glow)
    halo.position.z = -0.04
    halo.visible = false
    holder.add(halo, body, face, back)
    pivot.add(holder)
    const hit = hitBox(CW, CH, 0.3)
    hit.position.y = CH / 2
    pivot.add(hit)
    pivot.userData = { holder, halo, face, hit, portrait: face.material.map, cover: backTexture(state.color) }
    return shadowed(pivot)
  }

  function slotPos(i, n) {
    const rows = Math.ceil(n / cols)
    const r = Math.floor(i / cols)
    const inRow = Math.min(cols, n - r * cols)
    const c = i % cols
    const x = (c - (inRow - 1) / 2) * GAP_X
    // the front row is nearest; rows behind step up like bleachers
    const back = rows - 1 - r
    return { x, y: back * ROW_UP, z: (rows - 1) / 2 * ROW_Z - back * ROW_Z + 0.2, rows }
  }

  function buildTray(n) {
    tray.clear()
    const rows = Math.ceil(n / cols)
    const wood = mat('#B98B5E', { roughness: 0.7 })
    const dark = mat('#8C6440', { roughness: 0.7 })
    for (let r = 0; r < rows; r++) {
      const p = slotPos(r * cols, n)
      const step = new THREE.Mesh(new RoundedBoxGeometry(cols * GAP_X + 0.4, 0.14 + p.y, ROW_Z, 2, 0.04), r % 2 ? wood : dark)
      step.position.set(0, (0.14 + p.y) / 2 - 0.07, p.z)
      tray.add(step)
      // the groove the frames stand in
      const groove = new THREE.Mesh(new THREE.BoxGeometry(cols * GAP_X + 0.2, 0.02, 0.08), mat('#5A3F28'))
      groove.position.set(0, p.y + 0.071, p.z + 0.25)
      tray.add(groove)
    }
    // the secret slot in front
    const front = slotPos(n - 1, n)
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.14, 0.9, 2, 0.05), dark)
    plinth.position.set(0, 0, front.z + 1.9)
    tray.add(plinth)
    const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 48), mat('#D9CCE6', { roughness: 1 }))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.08
    tray.add(floor)
    shadowed(tray, true, true)
  }

  function placeAll(animateIn) {
    const list = current?.characters ?? []
    list.forEach((c, i) => {
      const f = frames.get(c.id)
      if (!f) return
      const p = slotPos(i, list.length)
      if (animateIn && !stage.reduce) {
        f.position.set(p.x, p.y + 2.2, p.z + 0.25)
        f.scale.setScalar(0.5)
        animate(f.position, { y: p.y + 0.07, duration: 650, delay: i * 30, ease: 'outBounce' })
        animate(f.scale, { x: 1, y: 1, z: 1, duration: 450, delay: i * 30, ease: 'outBack(2)' })
      } else f.position.set(p.x, p.y + 0.07, p.z + 0.25)
    })
    if (secretSlot) {
      const front = slotPos(list.length - 1, list.length)
      secretSlot.position.set(0, 0.07, front.z + 1.9)
    }
  }
  relayout = () => {
    if (!current) return
    buildTray(current.characters.length)
    placeAll(false)
  }

  function rebuild(state) {
    framesGroup.clear()
    frames.clear()
    state.characters.forEach((c) => {
      const f = frameFor(c, state)
      f.userData.id = c.id
      f.rotation.x = state.flipped.has(c.id) ? DOWN : STAND
      f.userData.down = state.flipped.has(c.id)
      if (f.userData.down) f.userData.face.material.map = f.userData.cover
      framesGroup.add(f)
      frames.set(c.id, f)
    })
    buildTray(state.characters.length)
    // your secret character, a bit bigger, on its own plinth
    secretSlot = null
    if (state.secret) {
      const c = state.characters.find((x) => x.id === state.secret)
      if (c) {
        secretSlot = frameFor(c, state)
        secretSlot.scale.setScalar(1.15)
        secretSlot.rotation.x = -0.25
        framesGroup.add(secretSlot)
      }
    }
  }

  stage.onFrame((t) => {
    if (secretSlot) secretSlot.rotation.y = Math.sin(t * 0.8) * 0.12
  })

  return {
    update(state) {
      const key = `${state.characters.map((c) => c.id).join(',')}|${state.secret}|${state.color}|${Object.keys(state.portraits).length}`
      const fresh = key !== boardKey
      current = state
      if (fresh) {
        boardKey = key
        rebuild(state)
        placeAll(true)
        stage.refit()
      }
      stage.clearPickables()
      for (const [id, f] of frames) {
        const down = state.flipped.has(id)
        if (down !== f.userData.down) {
          f.userData.down = down
          // a frame that's down shows your color on its face, so the character is hidden
          const swap = () => {
            f.userData.face.material.map = f.userData.down ? f.userData.cover : f.userData.portrait
            f.userData.face.material.needsUpdate = true
          }
          if (down && !stage.reduce) setTimeout(swap, 180)
          else swap()
          if (stage.reduce) f.rotation.x = down ? DOWN : STAND
          else animate(f.rotation, { x: down ? DOWN : STAND, duration: down ? 520 : 600, ease: down ? 'outBounce' : 'outBack(1.8)' })
        }
        const picked = state.picked === id
        f.userData.halo.visible = picked || (state.guessing && !down)
        f.userData.halo.scale.setScalar(picked ? 1.08 : 1)
        f.userData.holder.position.z = picked ? 0.12 : 0
        if (state.interactive && (!state.guessing || !down)) stage.pickable(f.userData.hit, { kind: 'char', id, marker: f.userData.holder })
      }
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
