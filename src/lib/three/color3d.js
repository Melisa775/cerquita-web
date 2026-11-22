/**
 * Color de memoria in 3D: paint cans on a workbench. While guessing, your
 * can is open and its paint (and a glossy drop floating over it) follows the
 * sliders live. On the reveal the real color's can stands in the middle and
 * each player's can opens after it, its lid flying off.
 *
 * state: { phase: 'guess' | 'reveal', mine, sent, target, guesses: [{ name, color, ring }] }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, mat, shadowed } from './kit'
import { animate } from 'animejs'

function makeCan(ringColor = '#22252E') {
  const g = new THREE.Group()
  const metal = mat('#C9CED6', { roughness: 0.25, metalness: 0.75 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.5, 48, 1, true), metal)
  body.position.y = 0.75
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.9, 48), metal)
  bottom.rotation.x = Math.PI / 2
  bottom.position.y = 0.01
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.915, 0.915, 0.7, 48, 1, true), mat(ringColor, { roughness: 0.5 }))
  label.position.y = 0.72
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.05, 10, 48), metal)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 1.5
  const paintMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.15, metalness: 0.05 })
  const paint = new THREE.Mesh(new THREE.CircleGeometry(0.86, 48), paintMat)
  paint.rotation.x = -Math.PI / 2
  paint.position.y = 1.38
  const lid = new THREE.Group()
  const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 48), metal)
  const lidRing = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.03, 8, 40), mat('#9AA2AD', { roughness: 0.3, metalness: 0.7 }))
  lidRing.rotation.x = Math.PI / 2
  lidRing.position.y = 0.05
  lid.add(lidTop, lidRing)
  lid.position.y = 1.54
  g.add(body, bottom, label, rim, paint, lid)
  g.userData = { paintMat, lid, label }
  return shadowed(g)
}

export function create(container, handlers) {
  const stage = createStage(
    container,
    { background: '#ECE6DE', tilt: 0.55, portraitTilt: 0.62, maxPolar: 1.35, target: [0, -0.9, 2.2], fitHalfWidth: 4.6, fitHalfDepth: 4.8, shadowSize: 6 },
    handlers,
  )
  const { world } = stage
  const bench = new THREE.Mesh(new RoundedBoxGeometry(11, 0.4, 5.5, 3, 0.12), mat('#A07850', { roughness: 0.7 }))
  bench.position.y = -0.2
  bench.receiveShadow = true
  world.add(bench)
  // a few splashes on the bench
  ;[['#E15A4A', -3.8, 1.6, 0.4], ['#3B7DC4', 3.6, -1.4, 0.3], ['#F2B632', 2.8, 1.9, 0.22]].forEach(([c, x, z, r]) => {
    const s = new THREE.Mesh(new THREE.CircleGeometry(r, 24), mat(c, { roughness: 0.3 }))
    s.rotation.x = -Math.PI / 2
    s.position.set(x, 0.005, z)
    world.add(s)
  })

  const cans = new THREE.Group()
  world.add(cans)
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.45, 40, 30), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 0.08, metalness: 0.1 }))
  drop.castShadow = true
  world.add(drop)
  let mode = ''
  let current = null
  let mine = null

  function layoutGuess(state) {
    cans.clear()
    mine = makeCan(state.ring)
    mine.userData.lid.position.set(1.3, 0.04, 0.4)
    mine.userData.lid.rotation.z = 0.1
    cans.add(mine)
    drop.visible = true
  }

  function layoutReveal(state) {
    cans.clear()
    drop.visible = false
    const all = [{ name: '__target', color: state.target, ring: '#22252E' }, ...state.guesses]
    all.forEach((g, i) => {
      const can = makeCan(g.ring)
      // the real color in the middle, a bit bigger; guesses on both sides
      const x = i === 0 ? 0 : (i % 2 ? -1 : 1) * 2.4 * Math.ceil(i / 2)
      can.position.set(x, 0, i === 0 ? -0.3 : 0.4)
      if (i === 0) can.scale.setScalar(1.2)
      can.userData.paintMat.color.set(g.color ?? '#D7D7D7')
      cans.add(can)
      if (!stage.reduce && current) {
        const lid = can.userData.lid
        const side = x >= 0 ? 1 : -1
        animate(lid.position, { x: [0, side * 1.1], y: [1.54, 2.6, 0.04], z: [0, 0.6], duration: 800, delay: 300 + i * 450, ease: 'outQuad' })
        animate(lid.rotation, { z: [0, side * -2.6], duration: 800, delay: 300 + i * 450, ease: 'outQuad' })
      } else {
        can.userData.lid.position.set(x >= 0 ? 1.1 : -1.1, 0.04, 0.6)
      }
    })
  }

  stage.onFrame((t) => {
    if (drop.visible) {
      drop.position.set(0, 2.5 + Math.sin(t * 1.6) * 0.12, 0)
      drop.rotation.y = t * 0.5
      const sq = 1 + Math.sin(t * 3.2) * 0.04
      drop.scale.set(1 / sq, sq, 1 / sq)
    }
  })

  return {
    update(state) {
      const m = state.phase === 'reveal' ? `reveal-${state.round}` : `guess-${state.round}`
      if (m !== mode) {
        mode = m
        if (state.phase === 'reveal') layoutReveal(state)
        else layoutGuess(state)
      }
      if (state.phase !== 'reveal' && mine) {
        mine.userData.paintMat.color.set(state.mine)
        drop.material.color.set(state.mine)
        if (state.sent && !mine.userData.closed) {
          // sent: the lid goes back on
          mine.userData.closed = true
          drop.visible = false
          if (stage.reduce) mine.userData.lid.position.set(0, 1.54, 0)
          else {
            animate(mine.userData.lid.position, { x: 0, y: [0.04, 2.4, 1.54], z: 0, duration: 650, ease: 'outBounce' })
            animate(mine.userData.lid.rotation, { z: 0, duration: 650 })
          }
        }
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
