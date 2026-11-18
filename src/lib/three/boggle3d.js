/**
 * "Enredo de letras" in 3D: letter dice in a wooden box. Each round the dice
 * tumble in as if the box had been shaken. Drag across neighboring dice (or
 * tap them one by one, and tap the last one again to send): the chosen dice
 * rise in your color, joined by a glowing line.
 *
 * The module reports through onPick: { kind: 'path', path } as the path
 * changes and { kind: 'submit', path } to send it.
 *
 * state: { board, size, round, path, color, interactive }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, makeLetterTile, mat, seeded } from './kit'
import { animate } from 'animejs'

const GAP = 1.12
const S = 0.96

const areNeighbors = (a, b, n) => a !== b && Math.abs((a % n) - (b % n)) <= 1 && Math.abs(Math.floor(a / n) - Math.floor(b / n)) <= 1

export function create(container, handlers) {
  let n = 4
  const stage = createStage(
    container,
    {
      background: '#E9DFF0',
      tilt: 0.95,
      portraitTilt: 0.97,
      shadowSize: 5,
      target: [0, 0, 0.9],
      layout: (aspect) => ({ fitHalfWidth: (n * GAP) / 2 + 0.7, fitHalfDepth: (n * GAP) / 2 + (aspect < 0.9 ? 2.4 : 2.3) }),
    },
    handlers,
  )
  const { world, camera, renderer, controls } = stage
  const boxGroup = new THREE.Group()
  const diceGroup = new THREE.Group()
  world.add(boxGroup, diceGroup)
  let dice = []
  let hits = []
  let key = ''
  let current = null
  let shownPath = []
  const lineMat = new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#FFFFFF', emissiveIntensity: 0.5, transparent: true, opacity: 0.8 })
  let line = null

  const pos = (i) => [((i % n) - (n - 1) / 2) * GAP, (Math.floor(i / n) - (n - 1) / 2) * GAP]

  function build(board, size, round) {
    n = size
    boxGroup.clear()
    diceGroup.clear()
    dice = []
    hits = []
    const w = n * GAP + 0.5
    const wood = mat('#8E5E3A', { roughness: 0.6 })
    const floor = new THREE.Mesh(new RoundedBoxGeometry(w + 0.5, 0.2, w + 0.5, 3, 0.08), wood)
    floor.position.y = -0.12
    const inner = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, w), mat('#3E2D52', { roughness: 0.95 }))
    inner.position.y = -0.005
    boxGroup.add(floor, inner)
    for (const [x, z, sx, sz] of [[0, -w / 2 - 0.13, w + 0.5, 0.25], [0, w / 2 + 0.13, w + 0.5, 0.25], [-w / 2 - 0.13, 0, 0.25, w], [w / 2 + 0.13, 0, 0.25, w]]) {
      const side = new THREE.Mesh(new RoundedBoxGeometry(sx, 0.5, sz, 2, 0.06), wood)
      side.position.set(x, 0.15, z)
      boxGroup.add(side)
    }
    boxGroup.traverse((o) => o.isMesh && ((o.receiveShadow = true), (o.castShadow = true)))
    const rand = seeded(round * 31 + 7)
    board.forEach((letter, i) => {
      const d = makeLetterTile(S, { thickness: S * 0.86, body: '#F3EBDA' })
      d.userData.setTop(letter)
      const [x, z] = pos(i)
      d.position.set(x, S * 0.43, z)
      diceGroup.add(d)
      dice.push(d)
      // the hit area is a smaller disc so dragging diagonally doesn't catch a neighbor
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.34, S * 0.34, S, 16), new THREE.MeshBasicMaterial({ visible: false }))
      hit.position.set(x, S * 0.5, z)
      hit.userData.idx = i
      diceGroup.add(hit)
      hits.push(hit)
      if (!stage.reduce) {
        // shaken box: the dice fall in tumbling
        d.position.y = 2.5 + rand() * 1.5
        d.rotation.set(rand() * 6, rand() * 6, rand() * 6)
        animate(d.position, { y: S * 0.43, duration: 700, delay: i * 25, ease: 'outBounce' })
        animate(d.rotation, { x: 0, y: 0, z: 0, duration: 700, delay: i * 25, ease: 'outCubic' })
      }
    })
    stage.refit()
  }

  function showPath(path, color) {
    shownPath = path
    const on = new Set(path)
    dice.forEach((d, i) => {
      const sel = on.has(i)
      if (sel !== !!d.userData.sel) {
        d.userData.sel = sel
        animate(d.position, { y: S * 0.43 + (sel ? 0.22 : 0), duration: 180, ease: 'outQuad' })
        d.userData.setTop(current.board[i], sel ? { bg: color, fg: '#FFFFFF' } : undefined)
      } else if (sel) d.userData.setTop(current.board[i], { bg: color, fg: '#FFFFFF' })
    })
    if (line) {
      diceGroup.remove(line)
      line.geometry.dispose()
      line = null
    }
    if (path.length > 1) {
      const pts = path.map((i) => {
        const [x, z] = pos(i)
        return new THREE.Vector3(x, S + 0.36, z)
      })
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05)
      line = new THREE.Mesh(new THREE.TubeGeometry(curve, pts.length * 12, 0.055, 8, false), lineMat)
      diceGroup.add(line)
    }
  }

  /* -- dragging --------------------------------------------------------------------- */
  const ray = new THREE.Raycaster()
  const v2 = new THREE.Vector2()
  function hitIdx(e) {
    const r = renderer.domElement.getBoundingClientRect()
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(v2, camera)
    const h = ray.intersectObjects(hits, false)[0]
    return h ? h.object.userData.idx : null
  }
  let drag = { active: false, moved: false, submitOnUp: false }
  const setPath = (p) => {
    showPath(p, current.color)
    handlers.onPick?.({ kind: 'path', path: p })
  }
  const el = renderer.domElement
  const onDown = (e) => {
    if (!current?.interactive) return
    const idx = hitIdx(e)
    if (idx == null) return
    el.setPointerCapture?.(e.pointerId)
    const path = shownPath
    const last = path.at(-1)
    drag = { active: true, moved: false, submitOnUp: false }
    if (idx === last && path.length) drag.submitOnUp = true
    else if (path.includes(idx)) setPath(path.slice(0, path.indexOf(idx) + 1))
    else if (path.length && areNeighbors(last, idx, n)) setPath([...path, idx])
    else setPath([idx])
  }
  const onMove = (e) => {
    if (!drag.active) return
    const idx = hitIdx(e)
    const path = shownPath
    const last = path.at(-1)
    if (idx == null || idx === last) return
    if (path.length >= 2 && idx === path.at(-2)) {
      setPath(path.slice(0, -1))
      drag.moved = true
    } else if (!path.includes(idx) && areNeighbors(last, idx, n)) {
      setPath([...path, idx])
      drag.moved = true
      drag.submitOnUp = false
    }
  }
  const onUp = () => {
    const { active, moved, submitOnUp } = drag
    drag.active = false
    if (active && (moved || submitOnUp) && shownPath.length > 1) handlers.onPick?.({ kind: 'submit', path: shownPath })
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)

  stage.onFrame((t) => {
    if (line) lineMat.emissiveIntensity = 0.4 + Math.sin(t * 6) * 0.2
  })

  return {
    update(state) {
      current = state
      const k = `${state.round}|${state.board.join('')}`
      if (k !== key) {
        key = k
        build(state.board, state.size, state.round)
      }
      controls.enabled = !state.interactive
      lineMat.color.set(state.color)
      lineMat.emissive.set(state.color)
      showPath(state.path, state.color)
    },
    get state() {
      return current
    },
    /** Screen position of die i (browser tests). */
    dieAt(i) {
      return stage.project(dice[i])
    },
    resetView: stage.resetView,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose() {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      stage.dispose()
    },
  }
}
