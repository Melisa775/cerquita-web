/**
 * A table for games played with one big card at a time (Caras y gestos,
 * Más cerca). Each new card is dealt from the deck and turns over in the
 * middle; the previous one flies to the "guessed" pile on the right or the
 * "passed" pile on the left. A card can stay face down (the one only the
 * actor may read). Piles grow with the cards played.
 *
 * state: { key, text, label, sub, bg, ink, faceDown, back, result ('hit' | 'pass'),
 *          hits, passes, table }
 */
import * as THREE from 'three'
import { createStage } from './stage'
import { canvasTexture, makeCard, makeTable } from './kit'
import { animate } from 'animejs'

const W = 3.0
const H = 4.2
const DECK = [-3.6, -0.6]
const HIT_PILE = [3.7, -0.2]
const PASS_PILE = [-3.7, 1.6]

function wrap(ctx, text, maxWidth) {
  const words = String(text ?? '').split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

function frontTexture({ text, label, sub, bg, ink }) {
  return canvasTexture(1000, 1400, (ctx, w, h) => {
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 70)
    ctx.fill()
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(28, 28, w - 56, h - 56, 52)
    ctx.fill()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    if (label) {
      ctx.globalAlpha = 0.85
      ctx.font = '700 46px "Instrument Sans", system-ui, sans-serif'
      ctx.textBaseline = 'top'
      ctx.fillText(label.toUpperCase(), w / 2, 90)
      ctx.globalAlpha = 1
    }
    // the biggest size that fits
    let size = 210
    let lines
    do {
      ctx.font = `800 ${size}px "Bricolage Grotesque", system-ui, sans-serif`
      lines = wrap(ctx, text, w - 180)
      size -= 6
    } while (size > 40 && lines.length * size * 1.18 > h - 420)
    size += 6
    ctx.textBaseline = 'middle'
    const lh = size * 1.18
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * lh))
    if (sub) {
      ctx.globalAlpha = 0.85
      ctx.font = '600 44px "Instrument Sans", system-ui, sans-serif'
      ctx.textBaseline = 'bottom'
      ctx.fillText(sub, w / 2, h - 90)
    }
  })
}

function backTexture(color, word = '') {
  return canvasTexture(
    500,
    700,
    (ctx, w, h) => {
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.roundRect(0, 0, w, h, 36)
      ctx.fill()
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(16, 16, w - 32, h - 32, 26)
      ctx.fill()
      ctx.globalAlpha = 0.18
      ctx.fillStyle = '#FFFFFF'
      for (let y = 40; y < h; y += 60) for (let x = (y / 60) % 2 ? 30 : 60; x < w; x += 60) {
        ctx.beginPath()
        ctx.arc(x, y, 9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (word) {
        ctx.fillStyle = '#FFFFFF'
        ctx.font = '800 64px "Bricolage Grotesque", system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(word, w / 2, h / 2)
      }
    },
    `cards|back|${color}|${word}`,
  )
}

export function create(container, handlers) {
  const stage = createStage(
    container,
    {
      background: '#E6DCD2',
      tilt: 0.9,
      portraitTilt: 0.96,
      target: [0, 0, 1.0],
      shadowSize: 7,
      // on phones the card in the middle matters most: frame it, the piles can peek from the sides
      layout: (aspect) => (aspect < 0.9 ? { fitHalfWidth: 2.3, fitHalfDepth: 3.4 } : { fitHalfWidth: 5.2, fitHalfDepth: 4.8 }),
    },
    handlers,
  )
  const { world } = stage
  let table = null
  const deck = new THREE.Group()
  const piles = new THREE.Group()
  world.add(deck, piles)
  let current = null
  let card = null
  let shownKey = null
  let backKey = ''

  function setTable(cloth) {
    if (table) world.remove(table)
    table = makeTable(11, 8.4, { cloth, wood: '#6B4A33', border: 0.5 })
    world.add(table)
  }

  function buildDeck(back) {
    deck.clear()
    for (let i = 0; i < 12; i++) {
      const c = makeCard(W * 0.62, H * 0.62, backTexture(back.color, back.word), backTexture(back.color, back.word))
      c.position.set(DECK[0] + ((i * 7) % 3) * 0.01, 0.03 + i * 0.022, DECK[1])
      c.rotation.set(Math.PI, ((i * 13) % 7 - 3) * 0.01, 0)
      deck.add(c)
    }
  }

  function addToPile(where, n, back) {
    // keeps a short stack so the piles show how many went each way
    const [x, z] = where === 'hit' ? HIT_PILE : PASS_PILE
    const c = makeCard(W * 0.5, H * 0.5, backTexture(back.color, back.word), backTexture(back.color, back.word))
    c.position.set(x + ((n * 17) % 5 - 2) * 0.04, 0.03 + n * 0.02, z + ((n * 11) % 5 - 2) * 0.04)
    c.rotation.set(Math.PI, ((n * 29) % 11 - 5) * 0.06, 0)
    c.userData.pile = where
    piles.add(c)
  }

  function syncPiles(state) {
    const have = { hit: 0, pass: 0 }
    piles.children.forEach((c) => have[c.userData.pile]++)
    const want = { hit: Math.min(state.hits ?? 0, 20), pass: Math.min(state.passes ?? 0, 20) }
    if (have.hit > want.hit || have.pass > want.pass) {
      piles.clear()
      have.hit = have.pass = 0
    }
    for (const w of ['hit', 'pass']) for (let i = have[w]; i < want[w]; i++) addToPile(w, i, state.back)
  }

  function deal(state) {
    const old = card
    if (old) {
      // the previous card leaves toward its pile
      const [x, z] = state.result === 'pass' ? PASS_PILE : HIT_PILE
      if (stage.reduce) world.remove(old)
      else {
        animate(old.position, { x, y: [old.position.y, 1.6, 0.4], z, duration: 520, ease: 'inOutQuad' })
        animate(old.rotation, { z: state.result === 'pass' ? 0.6 : -0.6, y: state.result === 'pass' ? 0.3 : -0.3, duration: 520, ease: 'outQuad' })
        animate(old.scale, { x: 0.6, y: 0.6, z: 0.6, duration: 520, ease: 'inQuad', onComplete: () => world.remove(old) })
      }
    }
    const front = frontTexture(state)
    const back = backTexture(state.back.color, state.back.word)
    card = makeCard(W, H, front, back, { radius: 0.18, thickness: 0.03 })
    world.add(card)
    const restY = 0.12
    const faceUp = !state.faceDown
    if (stage.reduce || !current) {
      card.position.set(0, restY, 0.5)
      card.rotation.set(faceUp ? 0 : Math.PI, 0, 0)
      return
    }
    // from the deck: slides over face down, then turns over
    card.position.set(DECK[0], 0.4, DECK[1])
    card.rotation.set(Math.PI, 0, 0.2)
    card.scale.setScalar(0.62)
    animate(card.position, { x: 0, y: [0.4, 1.4, restY], z: 0.5, duration: 650, delay: old ? 250 : 0, ease: 'inOutCubic' })
    animate(card.scale, { x: 1, y: 1, z: 1, duration: 650, delay: old ? 250 : 0, ease: 'outQuad' })
    animate(card.rotation, { x: faceUp ? 0 : Math.PI, z: 0, duration: 650, delay: old ? 250 : 0, ease: 'inOutCubic' })
  }

  stage.onFrame((t) => {
    if (card && current && !current.faceDown) card.position.y = 0.12 + Math.sin(t * 1.4) * 0.03
  })

  return {
    update(state) {
      if (state.table !== current?.table) setTable(state.table)
      const bk = `${state.back.color}|${state.back.word}`
      if (bk !== backKey) {
        backKey = bk
        buildDeck(state.back)
        piles.clear()
      }
      if (state.key !== shownKey) {
        shownKey = state.key
        deal(state)
      } else if (card && current && (state.faceDown !== current.faceDown || state.text !== current.text)) {
        // same card, but you're now allowed to see it (or its print changed)
        card.userData.setFront(frontTexture(state))
        animate(card.rotation, { x: state.faceDown ? Math.PI : 0, duration: 500, ease: 'inOutCubic' })
      }
      syncPiles(state)
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
