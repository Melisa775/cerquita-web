/**
 * Word search on a 3D desk: the letters are printed on a sheet of paper.
 * Drag from the first letter to the last one (or tap both ends): a glass
 * capsule follows your finger. Found words get a capsule in the finder's
 * color and their letters pop up as little tiles. Your partner's selection
 * in progress shows as a faint capsule in their color.
 *
 * Reports through onPick: { kind: 'select', start, end } while choosing
 * (start null to clear) and { kind: 'mark', start, end } to try a word.
 *
 * state: { grid, size, round, found: { word: { player, cells } }, missing,
 *          selecting: { player: { start, end } }, colors, me, interactive }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, canvasTexture, makeLetterTile, mat } from './kit'
import { animate } from 'animejs'

const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1]

export function create(container, handlers) {
  let size = 12
  const stage = createStage(
    container,
    {
      background: '#E4E0D6',
      tilt: 0.97,
      portraitTilt: 0.985,
      shadowSize: 8,
      target: [0, 0, 0.8],
      layout: (aspect) => ({ fitHalfWidth: size / 2 + 0.6, fitHalfDepth: size / 2 + (aspect < 0.9 ? 2.0 : 1.8) }),
    },
    handlers,
  )
  const { world, camera, renderer, controls } = stage
  const deskGroup = new THREE.Group()
  const foundGroup = new THREE.Group()
  const liveGroup = new THREE.Group()
  world.add(deskGroup, foundGroup, liveGroup)
  let key = ''
  let current = null
  const foundShown = new Map() // word -> group

  const cellPos = ([r, c]) => new THREE.Vector3(c - (size - 1) / 2, 0, r - (size - 1) / 2)

  function build(grid, n) {
    size = n
    deskGroup.clear()
    foundGroup.clear()
    foundShown.clear()
    const desk = new THREE.Mesh(new RoundedBoxGeometry(n + 3, 0.3, n + 3, 3, 0.1), mat('#9C7A55', { roughness: 0.7 }))
    desk.position.y = -0.2
    desk.receiveShadow = true
    const px = 72
    const tex = canvasTexture(n * px, n * px, (ctx, w, h) => {
      ctx.fillStyle = '#FBF8F1'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#22252E'
      ctx.font = `700 ${px * 0.56}px "Bricolage Grotesque", system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      grid.forEach((row, r) => row.split('').forEach((ch, c) => ctx.fillText(ch.toUpperCase(), c * px + px / 2, r * px + px / 2 + 2)))
    })
    const paper = new THREE.Mesh(new THREE.BoxGeometry(n + 0.5, 0.04, n + 0.5), [
      mat('#F4F0E6'), mat('#F4F0E6'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), mat('#F4F0E6'), mat('#F4F0E6'), mat('#F4F0E6'),
    ])
    paper.receiveShadow = true
    // the letters only cover n×n: the paper face is a bit larger, so shrink the texture into it
    tex.repeat.set((n + 0.5) / n, (n + 0.5) / n)
    tex.offset.set(-0.25 / n, -0.25 / n)
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping
    paper.position.y = 0.02
    const pencil = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.6, 6), mat('#F2B632'))
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), mat('#E9CFA4'))
    tip.position.y = -1.45
    pencil.add(body, tip)
    pencil.rotation.set(Math.PI / 2, 0, 0.7)
    pencil.position.set(n / 2 + 0.85, 0.09, 0.4)
    deskGroup.add(desk, paper, pencil)
    deskGroup.traverse((o) => o.isMesh && (o.castShadow = true))
    stage.refit()
    if (!stage.reduce) {
      paper.position.y = 1.2
      paper.rotation.z = 0.2
      animate(paper.position, { y: 0.02, duration: 700, ease: 'outBounce' })
      animate(paper.rotation, { z: 0, duration: 700, ease: 'outQuad' })
    }
  }

  function capsule(start, end, color, { opacity = 0.45, radius = 0.38, y = 0.06 } = {}) {
    const a = cellPos(start)
    const b = cellPos(end)
    const len = a.distanceTo(b)
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.0001, len), 6, 16), new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.2, depthWrite: false }))
    m.scale.y = 1
    m.rotation.z = Math.PI / 2
    const holder = new THREE.Group()
    holder.add(m)
    holder.position.copy(a.clone().add(b).multiplyScalar(0.5)).setY(y)
    holder.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x)
    holder.scale.y = 0.35 // flattened, like a highlighter stroke with some thickness
    return holder
  }

  function syncFound(state) {
    for (const [w, g] of foundShown) {
      if (!state.found[w] && !state.missing.some((m) => m.word === w)) {
        foundGroup.remove(g)
        foundShown.delete(w)
      }
    }
    const entries = [...Object.entries(state.found).map(([w, f]) => [w, f.cells, state.colors[f.player], true]), ...state.missing.map((m) => [m.word, m.cells, '#8A8E99', false])]
    for (const [w, cells, color, real] of entries) {
      if (foundShown.has(w)) continue
      const g = new THREE.Group()
      const cap = capsule(cells[0], cells.at(-1), color, { opacity: real ? 0.42 : 0.3 })
      g.add(cap)
      // the letters pop up as tiles in the finder's color
      if (real) {
        cells.forEach(([r, c], i) => {
          const t = makeLetterTile(0.7, { thickness: 0.1, body: '#FFFFFF' })
          t.userData.setTop(current.grid[r][c], { bg: color, fg: '#FFFFFF' })
          t.position.copy(cellPos([r, c])).setY(0.1)
          g.add(t)
          if (!stage.reduce && current) {
            t.scale.setScalar(0.01)
            animate(t.scale, { x: 1, y: 1, z: 1, duration: 360, delay: 120 + i * 60, ease: 'outBack(2.4)' })
            animate(t.position, { y: [0.1, 0.55, 0.1], duration: 420, delay: 120 + i * 60, ease: 'outQuad' })
          }
        })
      }
      if (!stage.reduce && current) {
        const inner = cap.children[0]
        inner.scale.y = 0.05
        animate(inner.scale, { y: 1, duration: 350, ease: 'outQuad' })
      }
      foundGroup.add(g)
      foundShown.set(w, g)
    }
  }

  let mine = null // my own selection in progress { start, end }
  let anchor = null
  function syncLive(state) {
    liveGroup.clear()
    for (const [p, s] of Object.entries(state.selecting)) {
      if (p === state.me || !s?.start) continue
      liveGroup.add(capsule(s.start, s.end, state.colors[p], { opacity: 0.22, radius: 0.34, y: 0.07 }))
    }
    const sel = mine ?? (anchor ? { start: anchor, end: anchor } : null)
    if (sel) liveGroup.add(capsule(sel.start, sel.end, state.colors[state.me], { opacity: 0.5, y: 0.09 }))
  }

  /* -- dragging ---------------------------------------------------------------- */
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.04)
  const ray = new THREE.Raycaster()
  const v2 = new THREE.Vector2()
  function cellAt(e) {
    const r = renderer.domElement.getBoundingClientRect()
    v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    ray.setFromCamera(v2, camera)
    const hit = new THREE.Vector3()
    if (!ray.ray.intersectPlane(plane, hit)) return null
    const c = Math.round(hit.x + (size - 1) / 2)
    const rr = Math.round(hit.z + (size - 1) / 2)
    if (c < -1 || c > size || rr < -1 || rr > size) return null
    return [Math.min(size - 1, Math.max(0, rr)), Math.min(size - 1, Math.max(0, c))]
  }
  function snap(start, cell) {
    let dr = cell[0] - start[0]
    let dc = cell[1] - start[1]
    if (Math.abs(dr) > 2 * Math.abs(dc)) dc = 0
    else if (Math.abs(dc) > 2 * Math.abs(dr)) dr = 0
    else {
      const d = Math.max(Math.abs(dr), Math.abs(dc))
      dr = Math.sign(dr) * d
      dc = Math.sign(dc) * d
    }
    let steps = Math.max(Math.abs(dr), Math.abs(dc))
    const sr = Math.sign(dr)
    const sc = Math.sign(dc)
    while (steps > 0) {
      const r = start[0] + sr * steps
      const c = start[1] + sc * steps
      if (r >= 0 && r < size && c >= 0 && c < size) return [r, c]
      steps -= 1
    }
    return start
  }
  let sent = null
  const share = (start, end) => {
    const k = start ? `${start}-${end}` : 'none'
    if (sent === k) return
    sent = k
    handlers.onPick?.({ kind: 'select', start, end })
  }
  const markWord = (start, end) => {
    mine = null
    anchor = null
    sent = 'none'
    syncLive(current)
    handlers.onPick?.({ kind: 'mark', start, end })
  }
  let drag = null
  const el = renderer.domElement
  const onDown = (e) => {
    if (!current?.interactive) return
    const cell = cellAt(e)
    if (!cell) return
    el.setPointerCapture?.(e.pointerId)
    if (anchor && !same(anchor, cell)) return markWord(anchor, snap(anchor, cell))
    drag = { start: cell, end: cell, moved: false }
    mine = { start: cell, end: cell }
    share(cell, cell)
    syncLive(current)
  }
  const onMove = (e) => {
    if (!drag) return
    const cell = cellAt(e)
    if (!cell) return
    const end = snap(drag.start, cell)
    if (same(end, drag.end)) return
    drag.end = end
    drag.moved = drag.moved || !same(end, drag.start)
    mine = { start: drag.start, end }
    share(drag.start, end)
    syncLive(current)
  }
  const onUp = () => {
    const d = drag
    drag = null
    if (!d) return
    if (d.moved && !same(d.start, d.end)) markWord(d.start, d.end)
    else if (anchor && same(anchor, d.start)) {
      anchor = null // tapping the same letter again cancels
      mine = null
      share(null, null)
    } else {
      anchor = d.start
      mine = null
    }
    syncLive(current)
  }
  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)

  return {
    update(state) {
      const k = `${state.round}|${state.grid.join('')}`
      if (k !== key) {
        key = k
        current = null
        mine = null
        anchor = null
        build(state.grid, state.size)
      }
      const first = !current
      current = state
      if (first) {
        // found words already there when you arrive: no animation
        const reduce = stage.reduce
        stage.reduce = true
        syncFound(state)
        stage.reduce = reduce
      } else syncFound(state)
      syncLive(state)
      controls.enabled = !state.interactive
    },
    get state() {
      return current
    },
    /** Screen position of a cell (browser tests). */
    cellAt(r, c) {
      const o = new THREE.Object3D()
      o.position.copy(cellPos([r, c]))
      return stage.project(o)
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
