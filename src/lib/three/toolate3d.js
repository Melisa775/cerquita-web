/**
 * Contrarreloj (Too late) in 3D: a ring of arcade buttons, one per letter,
 * around a big clock whose hand sweeps through the turn. Pressing a letter
 * pushes its button down and lights it in the player's color; the last one
 * pressed keeps glowing.
 *
 * state: { letters, used: [{ letter, player }], colors, canPick, turnId,
 *          turnSeconds, msLeft, playing, turnColor }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { canvasTexture, letterTexture, mat, shadowed } from './kit'
import { animate } from 'animejs'

export function create(container, handlers) {
  let radius = 3.6
  const stage = createStage(
    container,
    {
      background: '#F0E2D8',
      tilt: 0.9,
      portraitTilt: 0.96,
      shadowSize: 6,
      target: [0, 0, 1.0],
      layout: (aspect) => ({ fitHalfWidth: 5.5, fitHalfDepth: 5.4 + (aspect < 0.9 ? 1.6 : 1.2) }),
    },
    handlers,
  )
  const { world } = stage
  const buttonsGroup = new THREE.Group()
  world.add(buttonsGroup)
  const buttons = new Map() // letter -> { group, cap, ring }
  let key = ''
  let current = null
  let lastPressed = null
  const usedShown = new Map()

  // the base: a round panel
  const base = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.4, 0.35, 64), mat('#2A2F3A', { roughness: 0.5 }))
  base.position.y = -0.18
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.3, 0.08, 10, 80), mat('#C9A86A', { roughness: 0.35, metalness: 0.4 }))
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.0
  world.add(shadowed(base, false, true), rim)

  // the clock in the middle
  const clock = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.8, 0.4, 64), mat('#F5EFE4', { roughness: 0.4 }))
  body.position.y = 0.2
  const faceTex = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = '#FFFDF8'
    ctx.beginPath()
    ctx.arc(256, 256, 250, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#22252E'
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2
      const long = i % 5 === 0
      ctx.lineWidth = long ? 8 : 3
      ctx.beginPath()
      ctx.moveTo(256 + Math.sin(a) * (long ? 200 : 218), 256 - Math.cos(a) * (long ? 200 : 218))
      ctx.lineTo(256 + Math.sin(a) * 236, 256 - Math.cos(a) * 236)
      ctx.stroke()
    }
  }, 'tl|face')
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.6, 64), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 }))
  face.rotation.x = -Math.PI / 2
  face.position.y = 0.405
  // a colored wedge shows the time already spent
  const wedgeMat = new THREE.MeshStandardMaterial({ color: '#E15A4A', transparent: true, opacity: 0.55, roughness: 0.6, depthWrite: false })
  let wedge = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48, 0, 0.001), wedgeMat)
  wedge.rotation.x = -Math.PI / 2
  wedge.position.y = 0.41
  const hand = new THREE.Group()
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 1.4), mat('#22252E'))
  needle.position.z = -0.6
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 20), mat('#C4473A'))
  hand.add(needle, hub)
  hand.position.y = 0.45
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat('#C9A86A', { roughness: 0.3, metalness: 0.5 }))
  bell.position.set(0, 0.4, -1.95)
  clock.add(body, face, wedge, hand, bell)
  world.add(shadowed(clock))

  let timer = null // { endsAt, total }
  function setWedge(frac) {
    clock.remove(wedge)
    wedge.geometry.dispose()
    // starts at 12 o'clock (−z) and grows clockwise
    const len = Math.max(0.001, frac * Math.PI * 2)
    wedge = new THREE.Mesh(new THREE.CircleGeometry(1.45, 48, Math.PI / 2 - len, len), wedgeMat)
    wedge.rotation.x = -Math.PI / 2
    wedge.position.y = 0.41
    clock.add(wedge)
  }

  function build(letters) {
    buttonsGroup.clear()
    buttons.clear()
    usedShown.clear()
    radius = letters.length > 22 ? 4.1 : 3.6
    letters.forEach((l, i) => {
      const a = (i / letters.length) * Math.PI * 2
      const g = new THREE.Group()
      const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 0.18, 32), mat('#1B1F27', { roughness: 0.5 }))
      housing.position.y = 0.09
      const cap = new THREE.Group()
      const capBody = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.26, 32), mat('#F7F2E8', { roughness: 0.35 }))
      const top = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ map: letterTexture(l, { bg: '#F7F2E8' }), roughness: 0.4 }))
      top.rotation.x = -Math.PI / 2
      top.position.y = 0.131
      cap.add(capBody, top)
      cap.position.y = 0.32
      g.add(housing, cap)
      g.position.set(Math.sin(a) * radius, 0, -Math.cos(a) * radius)
      g.userData = { letter: l, cap, capBody, top }
      buttonsGroup.add(shadowed(g))
      buttons.set(l, g)
      if (!stage.reduce) {
        g.scale.setScalar(0.01)
        animate(g.scale, { x: 1, y: 1, z: 1, duration: 420, delay: i * 30, ease: 'outBack(2)' })
      }
    })
    stage.refit()
  }

  stage.onFrame((t) => {
    if (timer) {
      const left = Math.max(0, timer.endsAt - performance.now())
      const frac = 1 - left / (timer.total * 1000)
      hand.rotation.y = -frac * Math.PI * 2
      setWedge(frac)
      // the last seconds: the clock trembles
      clock.position.x = left < 3000 && left > 0 ? Math.sin(t * 60) * 0.03 : 0
    }
    if (lastPressed) {
      const g = buttons.get(lastPressed)
      if (g) g.userData.capBody.material.emissiveIntensity = 0.35 + Math.sin(t * 5) * 0.25
    }
  })

  return {
    update(state) {
      const k = state.letters.join('')
      if (k !== key) {
        key = k
        build(state.letters)
      }
      const usedBy = new Map(state.used.map((u) => [u.letter, u.player]))
      const last = state.used.at(-1)?.letter ?? null
      for (const [l, g] of buttons) {
        const by = usedBy.get(l)
        const shown = usedShown.get(l)
        if (by !== shown) {
          usedShown.set(l, by)
          const color = by ? state.colors[by] : '#F7F2E8'
          g.userData.capBody.material = new THREE.MeshStandardMaterial({ color, emissive: by ? color : '#000000', emissiveIntensity: 0, roughness: 0.35 })
          g.userData.top.material.map = letterTexture(l, by ? { bg: color, fg: '#FFFFFF' } : { bg: '#F7F2E8' })
          g.userData.top.material.needsUpdate = true
          // pushed down (and pops back up a bit lower)
          const y = by ? 0.2 : 0.32
          if (stage.reduce) g.userData.cap.position.y = y
          else animate(g.userData.cap.position, { y: by ? [0.32, 0.12, y] : y, duration: 360, ease: 'outQuad' })
        }
        if (g.userData.capBody.material.emissiveIntensity && l !== last) g.userData.capBody.material.emissiveIntensity = 0
      }
      lastPressed = last
      stage.clearPickables()
      if (state.canPick) for (const [l, g] of buttons) if (!usedBy.has(l)) stage.pickable(g, { kind: 'letter', id: l, marker: g.userData.cap })
      // the clock
      if (state.playing && state.msLeft != null) {
        if (!timer || timer.turnId !== state.turnId) timer = { endsAt: performance.now() + state.msLeft, total: state.turnSeconds, turnId: state.turnId }
        wedgeMat.color.set(state.turnColor)
      } else {
        timer = null
        hand.rotation.y = 0
        setWedge(0)
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

