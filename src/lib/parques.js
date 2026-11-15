/**
 * Parqués board geometry: a cross on a 19×19 grid. Each arm has 3 columns by
 * 8 rows; the 8×8 corners are the jails and the 3×3 center is the cielo (home).
 * The top arm is 0 and the others are obtained by rotating it 90° clockwise.
 */
export const N = 19
export const ARM = 17

const rot = ([r, c]) => [c, N - 1 - r]
function rotate(cell, times) {
  let out = cell
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) out = rot(out)
  return out
}

/** Track square (0..67) → [row, column]. */
export function pathCell(index) {
  const k = Math.floor(index / ARM)
  const o = index % ARM
  let local
  if (o < 8) local = [7 - o, 8] // column heading away from the center
  else if (o === 8) local = [0, 9] // tip of the arm
  else local = [o - 9, 10] // column heading back toward the center
  return rotate(local, k)
}

/** Square j (0..6) of arm k's home stretch. */
export function laneCell(k, j) {
  return rotate([1 + j, 9], k)
}

/** Corner (8×8) of arm k's jail: [startRow, startColumn]. */
export function jailOrigin(k) {
  // arm 0's is the top-right corner
  const corners = [[0, 11], [11, 11], [11, 0], [0, 0]]
  return corners[k]
}

/** Rotates the whole view so the player sees their jail at the bottom left. */
export function viewRotation(myArm) {
  return (2 - myArm + 4) % 4
}

export function toView([r, c], times) {
  return rotate([r, c], times)
}
