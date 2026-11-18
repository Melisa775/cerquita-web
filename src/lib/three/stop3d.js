/**
 * Stop in 3D: a letter drum like a slot machine that spins and lands on the
 * round's letter, a row of light bulbs per player that turn on as they fill
 * in categories, and a big red buzzer to call ¡Stop! (it lights up once all
 * your boxes are full).
 *
 * state: { letter, round, filled: { player: n }, total, colors, canStop, stopped }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, hitBox, letterTexture, mat, shadowed } from './kit'
import { animate } from 'animejs'

const ALPHABET = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('')

export function create(container, handlers) {
  const stage = createStage(
    container,
    {
      background: '#EFE3D6',
      tilt: 0.45,
      portraitTilt: 0.5,
      maxPolar: 1.4,
      shadowSize: 6,
      // on phones the answers card covers the lower half: the machine goes up top
      layout: (aspect) => (aspect < 0.9 ? { fitHalfWidth: 4.4, fitHalfDepth: 7.0, target: [0, -2.9, 2.6] } : { fitHalfWidth: 4.2, fitHalfDepth: 4.4, target: [0, 1.0, 1.8] }),
    },
    handlers,
  )
  const { world } = stage
  const floor = new THREE.Mesh(new THREE.CircleGeometry(14, 60), mat('#E2D2C0', { roughness: 1 }))
  floor.rotation.x = -Math.PI / 2
  world.add(shadowed(floor, false, true))

  /* -- the machine with the drum --------------------------------------------------- */
  const machine = new THREE.Group()
  machine.position.set(0, 0, -0.6)
  const body = new THREE.Mesh(new RoundedBoxGeometry(4.4, 3.2, 2.4, 4, 0.3), mat('#C4473A', { roughness: 0.45 }))
  body.position.y = 1.6
  const windowFrame = new THREE.Mesh(new RoundedBoxGeometry(2.0, 1.9, 0.3, 3, 0.12), mat('#F2C14E', { roughness: 0.3, metalness: 0.4 }))
  windowFrame.position.set(0, 1.75, 1.15)
  const opening = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.5, 0.32, 3, 0.1), mat('#1D1F26', { roughness: 0.9 }))
  opening.position.set(0, 1.75, 1.18)
  machine.add(body, windowFrame, opening)
  // marquee lights around the top
  const marquee = []
  for (let i = 0; i < 11; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), new THREE.MeshStandardMaterial({ color: '#FFF4D6', emissive: '#FFC94D', emissiveIntensity: 0.4 }))
    b.position.set(-2.0 + i * 0.4, 3.1, 1.22)
    machine.add(b)
    marquee.push(b)
  }
  // the letter: a big block in the window that tumbles through letters like a slot machine
  const drum = new THREE.Group()
  drum.position.set(0, 1.75, 1.25)
  const block = new THREE.Mesh(new RoundedBoxGeometry(1.3, 1.3, 0.5, 3, 0.1), mat('#FBF6EA', { roughness: 0.5 }))
  const faceMat = new THREE.MeshStandardMaterial({ map: letterTexture('?', { bg: '#FBF6EA' }), roughness: 0.5 })
  const front = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), faceMat)
  front.position.z = 0.252
  const backMat = new THREE.MeshStandardMaterial({ map: letterTexture('?', { bg: '#FBF6EA' }), roughness: 0.5 })
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), backMat)
  back.position.z = -0.252
  back.rotation.x = Math.PI // reads upright once the block has turned half a turn around x
  drum.add(block, front, back)
  machine.add(drum)
  const print = (m, L) => {
    m.map = letterTexture(L, { bg: '#FBF6EA' })
    m.needsUpdate = true
  }
  // a lever on the side
  const lever = new THREE.Group()
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 12), mat('#C9CED6', { metalness: 0.7, roughness: 0.3 }))
  rod.position.y = 0.7
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), mat('#22252E', { roughness: 0.3 }))
  knob.position.y = 1.45
  lever.add(rod, knob)
  lever.position.set(2.35, 1.7, 0)
  machine.add(lever)
  world.add(shadowed(machine))

  /* -- buzzer --------------------------------------------------------------------------- */
  const buzzer = new THREE.Group()
  buzzer.position.set(0, 0, 2.6)
  const buzzerBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.4, 40), mat('#22252E', { roughness: 0.4 }))
  buzzerBase.position.y = 0.2
  const domeMat = new THREE.MeshStandardMaterial({ color: '#E0352B', emissive: '#FF3B2F', emissiveIntensity: 0, roughness: 0.25 })
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.8, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), domeMat)
  dome.position.y = 0.38
  dome.scale.y = 0.55
  const buzzerHit = hitBox(2.2, 1.4, 2.2)
  buzzerHit.position.y = 0.6
  buzzer.add(buzzerBase, dome, buzzerHit)
  world.add(shadowed(buzzer))

  /* -- light bulbs per player ------------------------------------------------------------- */
  const bulbs = new THREE.Group()
  world.add(bulbs)
  let bulbKey = ''
  const rows = {}

  function buildBulbs(players, total, colors) {
    bulbs.clear()
    players.forEach((p, r) => {
      const row = []
      const x0 = r === 0 ? -3.2 : 3.2
      const plate = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.16, total * 0.42 + 0.3, 2, 0.05), mat('#3A3F4B'))
      plate.position.set(x0, 0.08, 1.5)
      bulbs.add(plate)
      for (let i = 0; i < total; i++) {
        const m = new THREE.MeshStandardMaterial({ color: '#8A8E99', emissive: colors[p], emissiveIntensity: 0, roughness: 0.3, transparent: true, opacity: 0.9 })
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), m)
        b.position.set(x0, 0.3, 1.5 - ((total - 1) / 2) * 0.42 + i * 0.42)
        bulbs.add(b)
        row.push(b)
      }
      rows[p] = row
    })
    shadowed(bulbs)
  }

  let shownLetter = null
  let spinning = false
  let current = null
  let pressed = false

  stage.onFrame((t) => {
    marquee.forEach((b, i) => (b.material.emissiveIntensity = spinning ? (Math.floor(t * 12 + i) % 2 ? 1.2 : 0.1) : 0.5 + Math.sin(t * 2 + i) * 0.3))
    if (current?.canStop && !pressed) domeMat.emissiveIntensity = 0.35 + Math.sin(t * 5) * 0.25
  })

  return {
    update(state) {
      const players = Object.keys(state.filled)
      const bk = `${players.join(',')}|${state.total}`
      if (bk !== bulbKey) {
        bulbKey = bk
        buildBulbs(players, state.total, state.colors)
      }
      for (const p of players) {
        rows[p]?.forEach((b, i) => {
          const on = i < state.filled[p]
          if (b.userData.on === on) return
          b.userData.on = on
          b.material.color.set(on ? state.colors[p] : '#8A8E99')
          b.material.emissiveIntensity = on ? 0.9 : 0
          if (on && !stage.reduce) animate(b.scale, { x: [1.6, 1], y: [1.6, 1], z: [1.6, 1], duration: 300, ease: 'outBack(2)' })
        })
      }
      // a new letter: pull the lever and spin the drum onto it
      const key = `${state.round}|${state.letter}`
      if (key !== shownLetter) {
        const first = shownLetter === null
        shownLetter = key
        if (first || stage.reduce) {
          print(faceMat, state.letter)
          drum.rotation.x = 0
        } else {
          spinning = true
          animate(lever.rotation, { x: [0, 0.9, 0], duration: 700, ease: 'inOutQuad' })
          // each half turn shows another random letter; the last one is the real one
          const turns = 7
          const k = { a: 0 }
          let half = -1
          animate(k, {
            a: turns * Math.PI * 2,
            duration: 1700,
            ease: 'outCubic',
            onUpdate: () => {
              drum.rotation.x = -k.a
              const h = Math.floor((k.a + Math.PI / 2) / Math.PI)
              if (h !== half) {
                half = h
                const last = k.a > (turns - 0.5) * Math.PI * 2 - Math.PI / 2
                const L = last ? state.letter : ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
                print(h % 2 ? backMat : faceMat, L)
              }
            },
            onComplete: () => {
              spinning = false
              drum.rotation.x = 0
              print(faceMat, state.letter)
            },
          })
        }
        pressed = false
        dome.position.y = 0.38
      }
      // the buzzer
      if (state.stopped && !pressed) {
        pressed = true
        domeMat.emissiveIntensity = 1.2
        if (!stage.reduce) animate(dome.position, { y: [0.38, 0.2, 0.3], duration: 380, ease: 'outQuad' })
      } else if (!state.canStop && !state.stopped) domeMat.emissiveIntensity = 0
      stage.clearPickables()
      if (state.canStop) stage.pickable(buzzerHit, { kind: 'stop', id: 'stop', marker: dome })
      current = state
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
