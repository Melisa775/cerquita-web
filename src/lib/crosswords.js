/**
 * Vista previa de una jugada de palabras cruzadas: qué palabras forma y
 * cuántos puntos daría. Es la misma cuenta que hace el servidor, pero sin
 * diccionario (eso lo revisa el servidor al jugar).
 */
export const SIZE = 15
const CENTER = [7, 7]

export function preview(board, pending, premiums, values) {
  if (!pending.length) return null
  const placed = new Map(pending.map((t) => [`${t.r},${t.c}`, t]))
  const at = (r, c) => placed.get(`${r},${c}`) ?? board[r]?.[c] ?? null
  const rows = new Set(pending.map((t) => t.r))
  const cols = new Set(pending.map((t) => t.c))
  if (rows.size > 1 && cols.size > 1) return { error: 'Las letras van en una sola fila o columna' }
  const first = pending[0]
  const hasH = [first.c - 1, first.c + 1].some((c) => c >= 0 && c < SIZE && board[first.r][c])
  const horizontal = rows.size === 1 && (pending.length > 1 || hasH)
  if (horizontal) {
    const lo = Math.min(...cols)
    const hi = Math.max(...cols)
    for (let c = lo; c <= hi; c++) if (!at(first.r, c)) return { error: 'Las letras tienen que quedar seguidas' }
  } else {
    const lo = Math.min(...rows)
    const hi = Math.max(...rows)
    for (let r = lo; r <= hi; r++) if (!at(r, first.c)) return { error: 'Las letras tienen que quedar seguidas' }
  }
  const empty = board.every((row) => row.every((x) => !x))
  if (empty) {
    if (!placed.has(`${CENTER[0]},${CENTER[1]}`)) return { error: 'La primera palabra pasa por el centro ★' }
    if (pending.length < 2) return { error: 'Al menos dos letras' }
  } else {
    const touches = pending.some(({ r, c }) => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([a, b]) => board[a]?.[b]))
    if (!touches) return { error: 'Tiene que tocar las palabras que ya están' }
  }

  const prem = new Map(premiums.map(([r, c, k]) => [`${r},${c}`, k]))
  const wordThrough = (r, c, dr, dc) => {
    while (at(r - dr, c - dc)) {
      r -= dr
      c -= dc
    }
    const cells = []
    while (r >= 0 && c >= 0 && r < SIZE && c < SIZE && at(r, c)) {
      cells.push([r, c])
      r += dr
      c += dc
    }
    return cells
  }
  const score = (cells) => {
    let total = 0
    let mult = 1
    for (const [r, c] of cells) {
      const t = at(r, c)
      let v = t.blank ? 0 : values[t.letter] ?? 0
      if (placed.has(`${r},${c}`)) {
        const k = prem.get(`${r},${c}`)
        if (k === 'DL') v *= 2
        else if (k === 'TL') v *= 3
        else if (k === 'DP') mult *= 2
        else if (k === 'TP') mult *= 3
      }
      total += v
    }
    return total * mult
  }
  const main = horizontal ? [0, 1] : [1, 0]
  const cross = horizontal ? [1, 0] : [0, 1]
  const words = []
  const m = wordThrough(first.r, first.c, ...main)
  if (m.length > 1) words.push(m)
  for (const t of pending) {
    const w = wordThrough(t.r, t.c, ...cross)
    if (w.length > 1) words.push(w)
  }
  if (!words.length) return { error: 'Forma una palabra de al menos dos letras' }
  const out = words.map((cells) => ({ word: cells.map(([r, c]) => at(r, c).letter).join(''), points: score(cells) }))
  const bingo = pending.length === 7
  return { words: out, score: out.reduce((s, w) => s + w.points, 0) + (bingo ? 50 : 0), bingo }
}
