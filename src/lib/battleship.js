/** Ayudas de la batalla naval: casillas de un barco, choques y flota al azar. */

export const COLS = 'ABCDEFGHIJ'

export function cellsOf(ship, length) {
  const out = []
  for (let i = 0; i < length; i++) out.push(ship.dir === 'h' ? [ship.row, ship.col + i] : [ship.row + i, ship.col])
  return out
}

const key = (r, c) => `${r},${c}`

/** Ids de los barcos mal ubicados (fuera, encima de otro o tocándose si la regla lo prohíbe). */
export function problems(placed, lengths, size, noTouch) {
  const owner = new Map()
  const bad = new Set()
  for (const s of placed) {
    for (const [r, c] of cellsOf(s, lengths[s.id])) {
      if (r < 0 || c < 0 || r >= size || c >= size) bad.add(s.id)
      const k = key(r, c)
      if (owner.has(k)) {
        bad.add(s.id)
        bad.add(owner.get(k))
      } else owner.set(k, s.id)
    }
  }
  if (noTouch) {
    for (const s of placed) {
      for (const [r, c] of cellsOf(s, lengths[s.id])) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const other = owner.get(key(r + dr, c + dc))
            if (other && other !== s.id) {
              bad.add(s.id)
              bad.add(other)
            }
          }
        }
      }
    }
  }
  return bad
}

/** Flota válida al azar (reintenta si se encierra). */
export function randomFleet(fleet, size, noTouch) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const placed = []
    const blocked = new Set()
    let ok = true
    for (const ship of fleet) {
      const options = []
      for (const dir of ['h', 'v']) {
        for (let r = 0; r < size; r++) {
          for (let c = 0; c < size; c++) {
            const cells = cellsOf({ row: r, col: c, dir }, ship.length)
            if (cells.every(([rr, cc]) => rr < size && cc < size && !blocked.has(key(rr, cc)))) options.push({ row: r, col: c, dir, cells })
          }
        }
      }
      if (!options.length) {
        ok = false
        break
      }
      const pick = options[Math.floor(Math.random() * options.length)]
      placed.push({ id: ship.id, row: pick.row, col: pick.col, dir: pick.dir })
      for (const [r, c] of pick.cells) {
        blocked.add(key(r, c))
        if (noTouch) for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) blocked.add(key(r + dr, c + dc))
      }
    }
    if (ok) return placed
  }
  return []
}

/** Mueve el inicio de un barco para que quepa en el tablero. */
export function clampShip(row, col, dir, length, size) {
  if (dir === 'h') return { row, col: Math.min(col, size - length), dir }
  return { row: Math.min(row, size - length), col, dir }
}
