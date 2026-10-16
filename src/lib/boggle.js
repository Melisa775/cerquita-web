// Debe coincidir con app/games/boggle.py en el backend

/** Minúsculas, sin tildes (la ñ se conserva) y solo letras. */
export function cleanWord(text) {
  return text
    .toLowerCase()
    .replace(/ñ/g, '\0')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\0/g, 'ñ')
    .replace(/[^a-zñ]/g, '')
}

export function areNeighbors(a, b, size) {
  const [ra, ca] = [Math.floor(a / size), a % size]
  const [rb, cb] = [Math.floor(b / size), b % size]
  return a !== b && Math.abs(ra - rb) <= 1 && Math.abs(ca - cb) <= 1
}

/** Casillas que forman la palabra, o null si no se puede armar en el tablero. */
export function findPath(board, size, word) {
  const tokens = board.map((t) => t.toLowerCase())
  const dfs = (i, rest, used) => {
    const tok = tokens[i]
    if (!rest.startsWith(tok)) return null
    const next = rest.slice(tok.length)
    if (!next) return [i]
    for (let j = 0; j < tokens.length; j++) {
      if (!used.has(j) && areNeighbors(i, j, size)) {
        const path = dfs(j, next, new Set([...used, j]))
        if (path) return [i, ...path]
      }
    }
    return null
  }
  if (!word) return null
  for (let s = 0; s < tokens.length; s++) {
    const path = dfs(s, word, new Set([s]))
    if (path) return path
  }
  return null
}

export function wordFromPath(board, path) {
  return path.map((i) => board[i].toLowerCase()).join('')
}

export function pointsFor(word) {
  const n = word.length
  if (n <= 4) return 1
  return { 5: 2, 6: 3, 7: 5 }[n] ?? 11
}
