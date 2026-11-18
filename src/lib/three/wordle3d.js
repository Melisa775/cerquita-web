/**
 * Wordle with wooden letter tiles on a felt board. Typed letters drop into
 * the current row; a sent row flips tile by tile to show its colors on the
 * underside, and a solved row jumps in a wave. A rejected word shakes.
 *
 * state: { length, maxTries, rows: [{ word, marks, player }], draft, typerColor,
 *          shakeKey, colors: { correct, present, absent } }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { RoundedBoxGeometry, makeLetterTile, mat } from './kit'
import { animate } from 'animejs'

const GAP = 1.06
const S = 0.92

export function create(container, handlers) {
  let dims = { length: 5, rows: 6 }
  const stage = createStage(
    container,
    {
      background: '#DCE7DF',
      tilt: 0.93,
      portraitTilt: 0.97,
      shadowSize: 6,
      // the keyboard covers the bottom of the stage: keep the board in the upper part
      layout: (aspect) => ({ fitHalfWidth: (dims.length * GAP) / 2 + 0.5, fitHalfDepth: (dims.rows * GAP) / 2 + (aspect < 0.9 ? 3.9 : 3.1) }),
      target: [0, 0, 1.9],
    },
    handlers,
  )
  const { world } = stage
  const boardGroup = new THREE.Group()
  const tilesGroup = new THREE.Group()
  world.add(boardGroup, tilesGroup)

  let key = ''
  let grid = [] // grid[row][col] = tile
  const shown = [] // per row: 'empty' | 'draft:<word>' | 'done'
  let lastShake = 0
  let current = null

  const pos = (r, c) => [(c - (dims.length - 1) / 2) * GAP, (r - (dims.rows - 1) / 2) * GAP]

  function build(length, rows) {
    dims = { length, rows }
    boardGroup.clear()
    tilesGroup.clear()
    const w = length * GAP + 0.6
    const d = rows * GAP + 0.6
    const board = new THREE.Mesh(new RoundedBoxGeometry(w + 0.4, 0.24, d + 0.4, 4, 0.12), mat('#7B5234', { roughness: 0.6 }))
    board.position.y = -0.14
    const felt = new THREE.Mesh(new RoundedBoxGeometry(w, 0.04, d, 3, 0.08), mat('#2F5D4A', { roughness: 0.95 }))
    felt.position.y = -0.005
    board.receiveShadow = felt.receiveShadow = true
    boardGroup.add(board, felt)
    grid = []
    for (let r = 0; r < rows; r++) {
      const row = []
      for (let c = 0; c < length; c++) {
        // empty slots: shallow wells in the felt
        const [x, z] = pos(r, c)
        const well = new THREE.Mesh(new RoundedBoxGeometry(S, 0.012, S, 2, 0.06), mat('#264D3D', { roughness: 1 }))
        well.position.set(x, 0.02, z)
        boardGroup.add(well)
        row.push(null)
      }
      grid.push(row)
      shown[r] = 'empty'
    }
    shown.length = rows
    stage.refit()
  }

  function tileAt(r, c) {
    if (!grid[r][c]) {
      const t = makeLetterTile(S)
      const [x, z] = pos(r, c)
      t.position.set(x, 0.1, z)
      tilesGroup.add(t)
      grid[r][c] = t
    }
    return grid[r][c]
  }
  function clearRow(r) {
    grid[r].forEach((t, c) => {
      if (t) tilesGroup.remove(t)
      grid[r][c] = null
    })
  }

  function showDone(r, row, animateIt, colors) {
    const won = row.marks.every((m) => m === 'correct')
    row.marks.forEach((m, c) => {
      const t = tileAt(r, c)
      const ch = row.word?.[c] ?? ''
      t.userData.setTop(ch)
      t.userData.setBottom(ch, { bg: colors[m], fg: '#FFFFFF' })
      if (!animateIt || stage.reduce) {
        t.rotation.x = Math.PI
        return
      }
      // flip one by one: lift, turn over, settle
      const d = c * 220
      animate(t.position, { y: [0.1, 0.55, 0.1], duration: 520, delay: d, ease: 'inOutQuad' })
      animate(t.rotation, { x: [0, Math.PI], duration: 520, delay: d, ease: 'inOutCubic' })
      if (won) animate(t.position, { y: [0.1, 0.8, 0.1], duration: 480, delay: row.marks.length * 220 + 300 + c * 90, ease: 'outQuad' })
    })
  }

  function showDraft(r, draft, color) {
    grid[r].forEach((t, c) => {
      const ch = draft[c]
      if (ch && !t) {
        const tile = tileAt(r, c)
        tile.userData.setTop(ch)
        if (!stage.reduce) {
          tile.position.y = 0.9
          tile.scale.setScalar(0.6)
          animate(tile.position, { y: 0.1, duration: 380, ease: 'outBounce' })
          animate(tile.scale, { x: 1, y: 1, z: 1, duration: 260, ease: 'outBack(2)' })
        }
      } else if (ch && t) t.userData.setTop(ch)
      else if (!ch && t) {
        tilesGroup.remove(t)
        grid[r][c] = null
      }
    })
    // the writer's color as a thin outline around the current row
    void color
  }

  return {
    update(state) {
      const k = `${state.length}|${state.maxTries}|${state.round}`
      const fresh = k !== key
      if (fresh) {
        key = k
        build(state.length, state.maxTries)
      }
      for (let r = 0; r < dims.rows; r++) {
        const row = state.rows[r]
        if (row) {
          if (shown[r] !== 'done') {
            showDone(r, row, !fresh && current, state.colors)
            shown[r] = 'done'
          }
        } else if (r === state.rows.length && state.draft != null) {
          showDraft(r, state.draft, state.typerColor)
          shown[r] = `draft`
        } else if (shown[r] !== 'empty') {
          clearRow(r)
          shown[r] = 'empty'
        }
      }
      if (state.shakeKey !== lastShake) {
        lastShake = state.shakeKey
        const r = state.rows.length
        if (r < dims.rows && !stage.reduce) {
          grid[r].forEach((t) => t && animate(t.position, { x: [t.position.x, t.position.x - 0.18, t.position.x + 0.18, t.position.x - 0.1, t.position.x], duration: 380, ease: 'inOutQuad' }))
        }
      }
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
