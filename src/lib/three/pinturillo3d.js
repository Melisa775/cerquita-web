/**
 * Pinturillo in an artist's corner: a wooden easel holds the drawing (the
 * real drawing canvas, used as a live texture), with paint jars and a mug of
 * brushes next to it. Whoever draws paints straight onto the easel: taps and
 * drags over the board are passed on to the hidden drawing canvas.
 *
 * state: { surface: HTMLCanvasElement, canDraw, frame (css color), turn }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, mat, shadowed } from './kit'
import { animate } from 'animejs'

const BW = 5.2 // drawing board width (4:3)
const BH = BW * 0.75

export function create(container, handlers) {
  const stage = createStage(
    container,
    {
      background: '#EDE5DA',
      tilt: 0.22,
      portraitTilt: 0.28,
      maxPolar: 1.5,
      shadowSize: 6,
      layout: (aspect) => (aspect < 0.9 ? { fitHalfWidth: BW / 2 + 0.25, fitHalfDepth: 4.6, target: [0, 2.0, 0] } : { fitHalfWidth: 3.9, fitHalfDepth: 3.5, target: [0, 2.45, 0] }),
    },
    handlers,
  )
  const { world, camera, renderer, controls } = stage
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), mat('#CDB79A', { roughness: 0.9 }))
  floor.rotation.x = -Math.PI / 2
  world.add(shadowed(floor, false, true))
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 14), mat('#F3ECE2', { roughness: 1 }))
  wall.position.set(0, 7, -3)
  wall.receiveShadow = true
  world.add(wall)

  /* -- easel --------------------------------------------------------------------- */
  const wood = mat('#A0703F', { roughness: 0.65 })
  const easel = new THREE.Group()
  const leg = (x, z, tilt) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 6.2, 0.16), wood)
    l.position.set(x, 3.0, z)
    l.rotation.z = tilt
    return l
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.6, 0.16), wood)
  back.position.set(0, 2.7, -1.2)
  back.rotation.x = -0.3
  easel.add(leg(-1.7, 0, -0.12), leg(1.7, 0, 0.12), back)
  const ledge = new THREE.Mesh(new RoundedBoxGeometry(BW + 0.6, 0.18, 0.5, 2, 0.05), wood)
  ledge.position.set(0, 0.86, 0.2)
  easel.add(ledge)
  const frameMat = new THREE.MeshStandardMaterial({ color: '#22252E', roughness: 0.5 })
  const frame = new THREE.Mesh(new RoundedBoxGeometry(BW + 0.34, BH + 0.34, 0.14, 3, 0.07), frameMat)
  frame.position.set(0, 0.95 + BH / 2 + 0.1, 0.12)
  easel.add(frame)
  const boardMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' }) // unlit: the paper stays white
  const board = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), boardMat)
  board.position.set(0, frame.position.y, 0.2)
  easel.add(board)
  const clamp = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.25, 0.3, 2, 0.06), wood)
  clamp.position.set(0, frame.position.y + BH / 2 + 0.2, 0.18)
  easel.add(clamp)
  world.add(shadowed(easel))
  board.castShadow = false

  /* -- props ------------------------------------------------------------------------ */
  const props = new THREE.Group()
  const jarColors = ['#E04848', '#F2C230', '#3B7DC4', '#3E9460']
  jarColors.forEach((c, i) => {
    const jar = new THREE.Group()
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 20), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.35, roughness: 0.1 }))
    glass.position.y = 0.25
    const paint = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.32, 20), mat(c, { roughness: 0.3 }))
    paint.position.y = 0.17
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.08, 20), mat('#22252E'))
    lid.position.y = 0.54
    jar.add(glass, paint, lid)
    jar.position.set(-3.4 + (i % 2) * 0.55, 0, 0.8 + Math.floor(i / 2) * 0.55)
    props.add(jar)
  })
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.3, 0.7, 24), mat('#3B7DC4', { roughness: 0.4 }))
  mug.position.set(3.4, 0.35, 0.9)
  props.add(mug)
  for (let i = 0; i < 4; i++) {
    const brush = new THREE.Group()
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 8), mat(['#C4473A', '#F2C230', '#22252E', '#3E9460'][i]))
    handle.position.y = 0.6
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), mat('#3A2A1E'))
    tip.position.y = 1.28
    brush.add(handle, tip)
    brush.position.set(3.4 + (i - 1.5) * 0.08, 0.3, 0.9)
    brush.rotation.set((i - 1.5) * 0.12, 0, (i - 1.5) * 0.15)
    props.add(brush)
  }
  // a drop cloth with paint splashes
  const cloth = new THREE.Mesh(new THREE.CircleGeometry(4.6, 40), mat('#E7DCCB', { roughness: 1 }))
  cloth.rotation.x = -Math.PI / 2
  cloth.position.set(0, 0.005, 0.8)
  props.add(cloth)
  world.add(shadowed(props))

  /* -- the live drawing ---------------------------------------------------------------- */
  let surface = null
  let tex = null
  function setSurface(el) {
    if (el === surface) return
    surface = el
    tex?.dispose()
    tex = el ? new THREE.CanvasTexture(el) : null
    if (tex) tex.colorSpace = THREE.SRGBColorSpace
    boardMat.map = tex
    boardMat.needsUpdate = true
  }
  stage.onFrame(() => {
    if (tex) tex.needsUpdate = true
  })

  /* -- painting on the easel: forward the pointer to the hidden canvas ------------------- */
  const ray = new THREE.Raycaster()
  const v2 = new THREE.Vector2()
  let painting = false
  let lastUv = null
  function uvAt(e) {
    const r = renderer.domElement.getBoundingClientRect()
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(v2, camera)
    const hit = ray.intersectObject(board, false)[0]
    return hit?.uv ?? null
  }
  function forward(type, uv) {
    if (!surface || !uv) return
    const r = surface.getBoundingClientRect()
    surface.dispatchEvent(
      new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'mouse', isPrimary: true, clientX: r.left + uv.x * r.width, clientY: r.top + (1 - uv.y) * r.height }),
    )
  }
  const el = renderer.domElement
  const onDown = (e) => {
    if (!current?.canDraw) return
    const uv = uvAt(e)
    if (!uv) return
    painting = true
    lastUv = uv
    el.setPointerCapture?.(e.pointerId)
    forward('pointerdown', uv)
  }
  const onMove = (e) => {
    if (!painting) return
    // outside the board: keep the stroke on the edge
    const uv = uvAt(e) ?? lastUv
    lastUv = uv
    forward('pointermove', uv)
  }
  const onUp = () => {
    if (!painting) return
    painting = false
    forward('pointerup', lastUv)
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)

  let current = null
  let turn = null
  return {
    update(state) {
      setSurface(state.surface)
      frameMat.color.set(state.frame)
      controls.enabled = !state.canDraw
      if (state.canDraw && current && !current.canDraw) stage.resetView()
      el.style.cursor = state.canDraw ? 'crosshair' : ''
      if (state.turn !== turn) {
        // a new turn: the board swings a little on the easel
        if (turn !== null && !stage.reduce) animate(frame.rotation, { z: [0.06, -0.04, 0.02, 0], duration: 900, ease: 'outQuad' })
        turn = state.turn
      }
      current = state
    },
    get state() {
      return current
    },
    /** Screen point over the drawing at (u, v) in 0..1 (browser tests). */
    boardPoint(u, v) {
      const p = board.localToWorld(new THREE.Vector3((u - 0.5) * BW, (0.5 - v) * BH, 0)).project(camera)
      const r = el.getBoundingClientRect()
      return { x: r.left + ((p.x + 1) / 2) * r.width, y: r.top + ((1 - p.y) / 2) * r.height }
    },
    resetView: stage.resetView,
    setInsets: stage.setInsets,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose() {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
      tex?.dispose()
      stage.dispose()
    },
  }
}
