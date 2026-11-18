/**
 * Shared three.js stage for the 3D boards (born from the Colonos board).
 *
 * It owns everything every board needs: renderer, sky and lights with soft
 * shadows, an orbit camera that frames the content on any screen, tapping
 * and hovering things with the pointer, the render loop and cleanup. Each
 * game only builds its own objects inside `stage.world` and registers what
 * can be tapped with `stage.pickable(mesh, data)`.
 *
 *   const stage = createStage(container, { fitHalfWidth: 5 }, { onPick, onHover })
 *   stage.world.add(myBoard)
 *   stage.pickable(hitMesh, { kind: 'piece', id: 3, marker })
 *   stage.onFrame((t, dt) => …)
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { animate } from 'animejs'

export const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function createStage(
  container,
  {
    background = '#BFE3F2',
    fov = 34,
    portraitFov = 40,
    fitHalfWidth = 5, // half the width of what must always be visible
    fitHalfDepth = null, // half the depth (front to back), for boards taller than wide
    tilt = 0.78, // camera height relative to its distance (higher = more from above)
    portraitTilt = 0.9,
    minDistance = 5,
    maxPolar = 1.12,
    target = [0, 0, 0.3],
    shadows = true,
    exposure = 1.05,
    shadowSize = 7,
    layout = null, // (aspect, world) => ({ fitHalfWidth, fitHalfDepth, target? }) to adapt the framing to the screen shape
  } = {},
  { onPick, onHover } = {},
) {
  const reduce = reducedMotion()
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)) // sharp on phones without rendering 3x
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = exposure
  renderer.shadowMap.enabled = shadows
  renderer.shadowMap.type = THREE.PCFShadowMap
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' })
  container.appendChild(renderer.domElement)

  const scene = new THREE.Scene()
  const world = new THREE.Group()
  scene.add(world)
  scene.background = new THREE.Color(background)
  scene.fog = new THREE.Fog(background, 16, 40)

  const camera = new THREE.PerspectiveCamera(fov, 1, 0.5, 120) // a near plane far from 0 keeps phones from z-fighting (flicker)
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(...target)
  Object.assign(controls, {
    enableDamping: true,
    dampingFactor: 0.08,
    enablePan: false,
    minDistance,
    maxDistance: 22,
    minPolarAngle: 0.08,
    maxPolarAngle: maxPolar,
    rotateSpeed: 0.55,
    zoomSpeed: 0.8,
  })

  // light: soft sky + warm sun with shadows
  scene.add(new THREE.HemisphereLight('#E4F3FF', '#B49B6E', 1.05))
  const sun = new THREE.DirectionalLight('#FFF1D6', 2.3)
  sun.position.set(5, 11, 6)
  if (shadows) {
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -shadowSize, right: shadowSize, top: shadowSize, bottom: -shadowSize, near: 1, far: 34 })
    sun.shadow.bias = -0.0006
    sun.shadow.normalBias = 0.02
  }
  scene.add(sun)

  /* -- framing --------------------------------------------------------- */
  const HOME = new THREE.Vector3()
  const halfW = fitHalfWidth
  const halfD = fitHalfDepth
  const baseTarget = new THREE.Vector3(...target)
  let lastSize = ''
  function fit() {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    const size = `${w}x${h}`
    const resized = size !== lastSize
    lastSize = size
    // resizing clears the canvas: only do it when the size really changed
    if (resized) renderer.setSize(w, h, false)
    camera.aspect = w / h
    const portrait = w / h < 0.9
    camera.fov = portrait ? portraitFov : fov
    camera.updateProjectionMatrix()
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
    const fitted = layout?.(camera.aspect, world) ?? {}
    const fitHalfWidth = fitted.fitHalfWidth ?? halfW
    const fitHalfDepth = fitted.fitHalfDepth ?? halfD
    // far enough for the content to fit the width (and the depth, if given)
    const byWidth = fitHalfWidth / Math.tan(Math.atan(Math.tan(halfFov) * camera.aspect))
    const byDepth = fitHalfDepth ? fitHalfDepth / Math.tan(halfFov) : 0
    const dist = Math.max(byWidth * (portrait ? 1.02 : 0.95), byDepth * 0.95, minDistance + 1)
    controls.maxDistance = Math.max(22, dist + 6)
    scene.fog.near = dist + 4
    scene.fog.far = dist + 28
    const t = portrait ? portraitTilt : tilt
    if (fitted.target) controls.target.set(...fitted.target)
    else {
      controls.target.copy(baseTarget)
      if (portrait) controls.target.z += 0.6
    }
    HOME.set(controls.target.x, dist * t, controls.target.z + dist * Math.sqrt(Math.max(0.05, 1 - t * t)))
  }
  fit()
  camera.position.copy(HOME)
  // a resized canvas stays blank until the next frame: draw it at once so phones don't flicker
  const ro = new ResizeObserver(() => {
    fit()
    controls.update()
    renderer.render(scene, camera)
  })
  ro.observe(container)

  function resetView() {
    if (reduce) return void camera.position.copy(HOME)
    const from = camera.position.clone()
    const k = { t: 0 }
    animate(k, { t: 1, duration: 700, ease: 'inOutCubic', onUpdate: () => camera.position.lerpVectors(from, HOME, k.t) })
  }
  function zoom(dir) {
    const v = camera.position.clone().sub(controls.target)
    const len = THREE.MathUtils.clamp(v.length() * (dir > 0 ? 0.82 : 1.2), controls.minDistance, controls.maxDistance)
    camera.position.copy(controls.target).add(v.setLength(len))
  }

  /* -- picking ------------------------------------------------------------ */
  let pickables = []
  let hovered = null
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  function hitTest(e) {
    if (!pickables.length) return null
    const r = renderer.domElement.getBoundingClientRect()
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    raycaster.setFromCamera(ndc, camera)
    // the nearest hit wins, unless something behind it has a higher priority
    // (a glowing destination beats a piece standing in front of it)
    let best = null
    for (const hit of raycaster.intersectObjects(pickables, true)) {
      let o = hit.object
      while (o && !o.userData.pick) o = o.parent
      const data = o?.userData.pick
      if (data && (!best || (data.priority ?? 0) > (best.priority ?? 0))) best = data
    }
    return best
  }
  function setHovered(data) {
    if (hovered === data) return
    hovered = data
    renderer.domElement.style.cursor = data ? 'pointer' : ''
    onHover?.(data)
  }
  let down = null
  const el = renderer.domElement
  const onDown = (e) => (down = { x: e.clientX, y: e.clientY })
  const onUp = (e) => {
    if (!down) return
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
    down = null
    if (moved > 7) return // a drag turns the camera, it's not a tap
    const data = hitTest(e)
    if (data) onPick?.(data)
  }
  const onMove = (e) => e.pointerType !== 'touch' && setHovered(hitTest(e))
  const onLeave = () => setHovered(null)
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('dblclick', resetView)

  /* -- loop ------------------------------------------------------------------ */
  const frameFns = new Set()
  let raf = 0
  let last = performance.now()
  const t0 = last
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    const t = (now - t0) / 1000
    frameFns.forEach((fn) => fn(t, dt))
    controls.update()
    renderer.render(scene, camera)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  const onVisibility = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden) {
      last = performance.now()
      raf = requestAnimationFrame(loop)
    }
  }
  document.addEventListener('visibilitychange', onVisibility)

  const stage = {
    THREE,
    scene,
    camera,
    renderer,
    controls,
    world,
    reduce,
    get hovered() {
      return hovered
    },
    /** Makes an object tappable; `data` comes back in onPick/onHover. */
    pickable(obj, data) {
      obj.userData.pick = data
      pickables.push(obj)
      return obj
    },
    unpickable(obj) {
      pickables = pickables.filter((p) => p !== obj)
      delete obj.userData.pick
    },
    clearPickables(filter) {
      pickables = filter ? pickables.filter((p) => !filter(p)) : []
      if (hovered && !pickables.some((p) => p.userData.pick === hovered)) setHovered(null)
    },
    onFrame(fn) {
      frameFns.add(fn)
      return () => frameFns.delete(fn)
    },
    resetView,
    zoom,
    /** Recomputes the framing (after the content changed size) and moves the camera there. */
    refit() {
      fit()
      camera.position.copy(HOME)
    },
    /** Screen position of an object or of a pickable found by kind and id (browser tests). */
    project(objOrKind, id) {
      let obj = objOrKind
      if (typeof objOrKind === 'string') {
        const p = pickables.find((o) => o.userData.pick.kind === objOrKind && o.userData.pick.id === id)
        if (!p) return null
        obj = p.userData.pick.marker ?? p
      }
      const v = obj.getWorldPosition(new THREE.Vector3()).project(camera)
      const r = el.getBoundingClientRect()
      return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }
    },
    pickableIds(kind) {
      return pickables.filter((o) => o.userData.pick.kind === kind).map((o) => o.userData.pick.id)
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
          if (m.userData?.shared) return
          m.map?.dispose()
          m.dispose()
        })
      })
      renderer.dispose()
      el.remove()
    },
  }
  return stage
}
