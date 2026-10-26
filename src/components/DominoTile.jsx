/**
 * Ficha de dominó. Horizontal mide 2×1 unidades y vertical 1×2.
 * `a` va a la izquierda (o arriba) y `b` a la derecha (o abajo).
 */
const PIPS = {
  0: [],
  1: [[0.5, 0.5]],
  2: [[0.27, 0.27], [0.73, 0.73]],
  3: [[0.27, 0.27], [0.5, 0.5], [0.73, 0.73]],
  4: [[0.27, 0.27], [0.73, 0.27], [0.27, 0.73], [0.73, 0.73]],
  5: [[0.27, 0.27], [0.73, 0.27], [0.5, 0.5], [0.27, 0.73], [0.73, 0.73]],
  6: [[0.27, 0.25], [0.73, 0.25], [0.27, 0.5], [0.73, 0.5], [0.27, 0.75], [0.73, 0.75]],
}

export default function DominoTile({ a, b, vertical = false, unit = 28, faceDown = false, ring, dim = false, className = '', style }) {
  const w = vertical ? unit : unit * 2
  const h = vertical ? unit * 2 : unit
  const vw = vertical ? 100 : 200
  const vh = vertical ? 200 : 100
  const half = (value, offX, offY) =>
    PIPS[value].map(([x, y], i) => {
      // en vertical el 6 se dibuja en dos columnas de tres, igual que en horizontal girado
      const [px, py] = vertical ? [x, y] : [y, x]
      return <circle key={i} cx={offX + px * 100} cy={offY + py * 100} r="9.5" fill="#22252E" />
    })
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${vw} ${vh}`}
      className={`block shrink-0 ${className}`}
      style={{ opacity: dim ? 0.45 : 1, ...style }}
      aria-label={faceDown ? 'Ficha' : `${a} y ${b}`}
      role="img"
    >
      <rect x="3" y="3" width={vw - 6} height={vh - 6} rx="16" fill={faceDown ? '#2A2D36' : '#FBFAF6'} stroke={ring ?? (faceDown ? '#2A2D36' : '#B9BCC4')} strokeWidth={ring ? 8 : 4} />
      {faceDown ? (
        <rect x={vw / 2 - 14} y={vh / 2 - 14} width="28" height="28" rx="6" fill="rgba(255,255,255,.12)" />
      ) : (
        <>
          {vertical ? (
            <line x1="16" y1="100" x2="84" y2="100" stroke="#B9BCC4" strokeWidth="4" strokeLinecap="round" />
          ) : (
            <line x1="100" y1="16" x2="100" y2="84" stroke="#B9BCC4" strokeWidth="4" strokeLinecap="round" />
          )}
          {half(a, 0, 0)}
          {vertical ? half(b, 0, 100) : half(b, 100, 0)}
        </>
      )}
    </svg>
  )
}
