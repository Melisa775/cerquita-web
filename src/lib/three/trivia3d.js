/**
 * Trivia's category wheel in 3D: thick colored wedges with their icons, a
 * golden hub and a pointer on top. Each spin turns the wheel the same way
 * the server decided (several full turns, landing on the chosen slot), with a
 * clicking pointer. While a question is on, the wheel leans back and rests.
 *
 * state: { wheel: [category], colors: { category: css }, icons: { category: svg },
 *          spinId, slot, spinSeconds, phase }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { canvasTexture, mat, shadowed } from './kit'
import { animate } from 'animejs'

const R = 2.6

export function create(container, handlers) {
  const stage = createStage(
    container,
    { background: '#E8E3F2', tilt: 0.42, portraitTilt: 0.5, maxPolar: 1.4, target: [0, 2.2, 0], fitHalfWidth: 4.2, fitHalfDepth: 5.6, shadowSize: 5 },
    handlers,
  )
  const { world } = stage
  // the wheel stands upright on a base, facing the camera
  const stand = new THREE.Group()
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.3, 40), mat('#3A3550', { roughness: 0.5 }))
  base.position.y = 0.15
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.4, 0.35), mat('#3A3550', { roughness: 0.5 }))
  post.position.set(0, 0.9, -0.25)
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 60), mat('#D9D2E8', { roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  stand.add(floor, base, post)
  world.add(shadowed(stand, true, true))

  const holder = new THREE.Group() // leans back during questions
  holder.position.set(0, R + 0.6, 0)
  world.add(holder)
  const wheel = new THREE.Group()
  holder.add(wheel)
  const pointer = new THREE.Group()
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.6, 3), mat('#22252E', { roughness: 0.4 }))
  tip.rotation.z = Math.PI
  pointer.add(tip)
  pointer.position.set(0, R + 0.25, 0.35)
  holder.add(shadowed(pointer))

  let built = ''
  let n = 7
  let current = null
  let shownSpin = null
  let angle = 0 // radians, current wheel angle

  function build(state) {
    wheel.clear()
    n = state.wheel.length
    const step = (Math.PI * 2) / n
    state.wheel.forEach((cat, i) => {
      // wedge i is centered at the top when the wheel's angle is i * step
      const shape = new THREE.Shape()
      shape.moveTo(0, 0)
      shape.absarc(0, 0, R, Math.PI / 2 - step / 2, Math.PI / 2 + step / 2, false)
      shape.lineTo(0, 0)
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.03, bevelSegments: 2, curveSegments: 16 })
      const wedge = new THREE.Mesh(geo, mat(state.colors[cat], { roughness: 0.45 }))
      wedge.rotation.z = -i * step
      wedge.position.z = -0.15
      wheel.add(wedge)
      // the icon, printed on the wedge
      const svg = state.icons[cat]
      if (svg) {
        const tex = canvasTexture(128, 128, () => {})
        const img = new Image()
        img.onload = () => {
          tex.image.getContext('2d').drawImage(img, 8, 8, 112, 112)
          tex.needsUpdate = true
        }
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        const icon = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.75), new THREE.MeshBasicMaterial({ map: tex, transparent: true }))
        const a = Math.PI / 2 - i * step
        icon.position.set(Math.cos(a) * R * 0.66, Math.sin(a) * R * 0.66, 0.2)
        icon.rotation.z = -i * step
        wheel.add(icon)
      }
      // pegs between wedges, which the pointer clicks against
      const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), mat('#FFFFFF'))
      const pa = Math.PI / 2 - i * step + step / 2
      peg.rotation.x = Math.PI / 2
      peg.position.set(Math.cos(pa) * (R - 0.12), Math.sin(pa) * (R - 0.12), 0.25)
      wheel.add(peg)
    })
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.06, 0.1, 12, 80), mat('#F5F0E6', { roughness: 0.4 }))
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32), mat('#E2B44C', { roughness: 0.3, metalness: 0.5 }))
    hub.rotation.x = Math.PI / 2
    hub.position.z = 0.1
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.56, 24), mat('#22252E'))
    cap.rotation.x = Math.PI / 2
    cap.position.z = 0.12
    wheel.add(rim, hub, cap)
    shadowed(wheel)
  }

  /** Same rotation as the 2D wheel: several turns, landing on the slot (degrees, clockwise). */
  function rotationFor(spinId, slot, wheelList) {
    if (!spinId || !slot) return 0
    const i = wheelList.indexOf(slot)
    const jitter = ((spinId * 37) % 30) - 15
    return spinId * 5 * 360 - i * (360 / wheelList.length) + jitter
  }

  // the pointer flicks every time a peg passes under it
  let lastPeg = 0
  stage.onFrame(() => {
    wheel.rotation.z = -angle
    const step = (Math.PI * 2) / n
    const peg = Math.floor((angle + step / 2) / step)
    if (peg !== lastPeg) {
      lastPeg = peg
      if (!stage.reduce) animate(pointer.rotation, { z: [0.35, 0], duration: 160, ease: 'outQuad' })
    }
  })

  return {
    update(state) {
      const k = state.wheel.join(',') + '|' + Object.keys(state.icons).length
      if (k !== built) {
        built = k
        build(state)
      }
      // spin to where the server says, or jump there when arriving mid-game
      const deg = -rotationFor(state.spinId, state.slot, state.wheel)
      const target = (-deg * Math.PI) / 180
      if (state.spinId !== shownSpin) {
        const fresh = shownSpin === null || !current
        shownSpin = state.spinId
        if (fresh || stage.reduce) angle = target
        else {
          const k2 = { a: angle }
          animate(k2, { a: target, duration: state.spinSeconds * 950, ease: 'outCubic', onUpdate: () => (angle = k2.a) })
        }
      }
      // questions on: the wheel leans back and gets smaller
      const asking = state.phase === 'question' || state.phase === 'reveal' || state.phase === 'crown_pick'
      animate(holder.rotation, { x: asking ? -0.9 : 0, duration: 600, ease: 'outQuad' })
      animate(holder.scale, { x: asking ? 0.7 : 1, y: asking ? 0.7 : 1, z: asking ? 0.7 : 1, duration: 600, ease: 'outQuad' })
      animate(holder.position, { y: asking ? R * 0.7 + 0.3 : R + 0.6, z: asking ? -2.2 : 0, duration: 600, ease: 'outQuad' })
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
