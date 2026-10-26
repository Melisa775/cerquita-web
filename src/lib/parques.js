/**
 * Geometría del tablero de parqués: una cruz en una cuadrícula de 19×19.
 * Cada brazo tiene 3 columnas por 8 filas; las esquinas de 8×8 son las
 * cárceles y el centro de 3×3 es el cielo. El brazo de arriba es el 0 y los
 * demás se obtienen girándolo 90° en el sentido del reloj.
 */
export const N = 19
export const ARM = 17

const rot = ([r, c]) => [c, N - 1 - r]
function rotate(cell, times) {
  let out = cell
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) out = rot(out)
  return out
}

/** Casilla del circuito (0..67) → [fila, columna]. */
export function pathCell(index) {
  const k = Math.floor(index / ARM)
  const o = index % ARM
  let local
  if (o < 8) local = [7 - o, 8] // columna que se aleja del centro
  else if (o === 8) local = [0, 9] // punta del brazo
  else local = [o - 9, 10] // columna que vuelve hacia el centro
  return rotate(local, k)
}

/** Casilla j (0..6) de la llegada del brazo k. */
export function laneCell(k, j) {
  return rotate([1 + j, 9], k)
}

/** Esquina (8×8) de la cárcel del brazo k: [filaInicial, columnaInicial]. */
export function jailOrigin(k) {
  // la del brazo 0 es la esquina de arriba a la derecha
  const corners = [[0, 11], [11, 11], [11, 0], [0, 0]]
  return corners[k]
}

/** Gira toda la vista para que el jugador vea su cárcel abajo a la izquierda. */
export function viewRotation(myArm) {
  return (2 - myArm + 4) % 4
}

export function toView([r, c], times) {
  return rotate([r, c], times)
}
