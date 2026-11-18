/**
 * Crosswords (a Scrabble-like game) on a 3D board: premium squares are
 * colored and labeled, played tiles are wooden letter tiles (the last play
 * drops in one by one) and the letters you're placing glow yellow and stand
 * a little higher. Tap an empty square to put the chosen rack letter there,
 * tap one of yours to take it back.
 *
 * state: { board, premiums, values, pending, last, moves, canPlace }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, canvasTexture, hitBox, makeLetterTile, mat } from './kit'
import { animate } from 'animejs'

const SIZE = 15
const PREMIUM = {
  TP: { bg: '#E0605A', fg: '#FFFFFF', label: '3P' },
  DP: { bg: '#F4C4D2', fg: '#7A2E45', label: '2P' },
  TL: { bg: '#4E8FD6', fg: '#FFFFFF', label: '3L' },
  DL: { bg: '#BFE1F2', fg: '#24506E', label: '2L' },
}

const pos = (r, c) => [c - (SIZE - 1) / 2, r - (SIZE - 1) / 2]

export function create(container, handlers) {
  const stage = createStage(
    container,
    {
      background: '#E5DDCF',
      tilt: 0.95,
      portraitTilt: 0.985,
      shadowSize: 9.5,
      target: [0, 0, 2.3],
      layout: (aspect) => ({ fitHalfWidth: SIZE / 2 + 0.5, fitHalfDepth: SIZE / 2 + (aspect < 0.9 ? 3.8 : 3.3) }),
    },
    handlers,
  )
  const { world, camera, renderer } = stage
  const tilesGroup = new THREE.Group()
  const pendingGroup = new THREE.Group()
  const cells = []
  world.add(tilesGroup, pendingGroup)
  let current = null
  let premKey = ''
  const placed = new Map() // "r,c" -> tile

  function buildBoard(premiums) {
    const prem = new Map(premiums.map(([r, c, k]) => [`${r},${c}`, k]))
    const base = new THREE.Mesh(new RoundedBoxGeometry(SIZE + 0.8, 0.3, SIZE + 0.8, 4, 0.12), mat('#6B4A30', { roughness: 0.6 }))
    base.position.y = -0.17
    base.receiveShadow = true
    // all squares on one texture: cheap, and crisp labels
    const px = 64
    const tex = canvasTexture(SIZE * px, SIZE * px, (ctx) => {
      ctx.fillStyle = '#C9BFA9'
      ctx.fillRect(0, 0, SIZE * px, SIZE * px)
      for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
          const k = prem.get(`${r},${c}`)
          const st = k ? PREMIUM[k] : null
          ctx.fillStyle = st?.bg ?? '#F1EBDD'
          ctx.beginPath()
          ctx.roundRect(c * px + 2, r * px + 2, px - 4, px - 4, 6)
          ctx.fill()
          const center = r === 7 && c === 7
          if (st || center) {
            ctx.fillStyle = st?.fg ?? '#C4473A'
            ctx.font = center ? `700 ${px * 0.6}px system-ui` : `800 ${px * 0.32}px "Instrument Sans", system-ui`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(center ? '★' : st.label, c * px + px / 2, r * px + px / 2 + 2)
          }
        }
      }
    })
    const top = new THREE.Mesh(new THREE.PlaneGeometry(SIZE, SIZE), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }))
    top.rotation.x = -Math.PI / 2
    top.position.y = 0.002
    top.receiveShadow = true
    world.add(base, top)
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const [x, z] = pos(r, c)
        const h = hitBox(0.98, 0.3, 0.98)
        h.position.set(x, 0.15, z)
        h.userData.rc = [r, c]
        world.add(h)
        cells.push(h)
      }
    }
  }

  function tile(letter, value, blank, { pending = false } = {}) {
    const t = makeLetterTile(0.9, { thickness: 0.14, body: pending ? '#F5D36B' : '#E9DCBF' })
    t.userData.setTop(letter, { bg: pending ? '#FBE38E' : '#F6EBD2', fg: blank ? '#3E6FA8' : '#22252E', small: blank ? '' : String(value ?? '') })
    return t
  }

  function syncPlaced(state) {
    const fresh = new Map((state.last?.cells ?? []).map(([r, c], i) => [`${r},${c}`, i]))
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const k = `${r},${c}`
        const cell = state.board[r][c]
        const have = placed.get(k)
        if (!cell) {
          if (have) {
            tilesGroup.remove(have)
            placed.delete(k)
          }
          continue
        }
        if (have && have.userData.letter === cell.letter) continue
        if (have) tilesGroup.remove(have)
        const t = tile(cell.letter, state.values[cell.letter], cell.blank)
        t.userData.letter = cell.letter
        const [x, z] = pos(r, c)
        t.position.set(x, 0.08, z)
        tilesGroup.add(t)
        placed.set(k, t)
        if (current && fresh.has(k) && !stage.reduce) {
          const i = fresh.get(k)
          t.position.y = 1.6
          t.rotation.z = 0.4
          animate(t.position, { y: 0.08, duration: 520, delay: i * 90, ease: 'outBounce' })
          animate(t.rotation, { z: 0, duration: 420, delay: i * 90, ease: 'outQuad' })
        }
      }
    }
  }

  const pendingShown = new Map()
  function syncPending(state) {
    const want = new Map(state.pending.map((p) => [`${p.r},${p.c}`, p]))
    for (const [k, t] of pendingShown) {
      const p = want.get(k)
      if (!p || t.userData.letter !== p.letter) {
        pendingGroup.remove(t)
        pendingShown.delete(k)
      }
    }
    for (const [k, p] of want) {
      if (pendingShown.has(k)) continue
      const t = tile(p.letter, state.values[p.letter], p.blank, { pending: true })
      t.userData.letter = p.letter
      const [x, z] = pos(p.r, p.c)
      t.position.set(x, 0.16, z)
      pendingGroup.add(t)
      pendingShown.set(k, t)
      if (!stage.reduce) {
        t.position.y = 0.9
        t.scale.setScalar(0.7)
        animate(t.position, { y: 0.16, duration: 320, ease: 'outBack(2)' })
        animate(t.scale, { x: 1, y: 1, z: 1, duration: 260, ease: 'outBack(2)' })
      }
    }
  }

  stage.onFrame((t) => pendingGroup.children.forEach((m, i) => (m.position.y = 0.16 + Math.sin(t * 3 + i) * 0.02)))

  const ray = new THREE.Raycaster()
  const v2 = new THREE.Vector2()

  return {
    update(state) {
      const k = JSON.stringify(state.premiums)
      if (k !== premKey) {
        premKey = k
        buildBoard(state.premiums)
      }
      syncPlaced(state)
      syncPending(state)
      stage.clearPickables()
      const pend = new Set(state.pending.map((p) => `${p.r},${p.c}`))
      for (const h of cells) {
        const id = h.userData.rc.join(',')
        if (pend.has(id)) stage.pickable(h, { kind: 'pending', id, marker: h })
        else if (state.canPlace && !state.board[h.userData.rc[0]][h.userData.rc[1]]) stage.pickable(h, { kind: 'cell', id, marker: h })
      }
      current = state
    },
    get state() {
      return current
    },
    /** The board square under a screen point (dragging letters from the rack), or null. */
    cellAtScreen(x, y) {
      const r = renderer.domElement.getBoundingClientRect()
      if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null
      v2.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(v2, camera)
      const hit = ray.intersectObjects(cells, false)[0]
      return hit ? hit.object.userData.rc : null
    },
    /** Screen position of a square (browser tests). */
    cellScreen(r, c) {
      return stage.project(cells[r * SIZE + c])
    },
    resetView: stage.resetView,
    zoom: stage.zoom,
    project: stage.project,
    pickableIds: stage.pickableIds,
    dispose: stage.dispose,
  }
}
