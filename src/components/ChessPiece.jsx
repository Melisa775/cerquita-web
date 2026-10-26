/**
 * Piezas de ajedrez propias, dibujadas en una caja de 45×45.
 * `piece` usa letras FEN: mayúsculas blancas (PNBRQK), minúsculas negras.
 */
const LIGHT = { fill: '#F7F5EF', stroke: '#22252E', detail: '#22252E' }
const DARK = { fill: '#2A2D36', stroke: '#2A2D36', detail: '#F7F5EF' }

const BASE = <rect x="10.5" y="34" width="24" height="5.5" rx="2.2" />

const SHAPES = {
  p: () => (
    <>
      <circle cx="22.5" cy="13" r="5.6" />
      <path d="M17.5 34 C17.5 27 19 22.5 22.5 20 C26 22.5 27.5 27 27.5 34 Z" />
      <rect x="16.5" y="19" width="12" height="3.2" rx="1.6" />
      <rect x="12.5" y="33" width="20" height="5" rx="2" />
    </>
  ),
  r: () => (
    <>
      <path d="M12 8.5 h4.6 v3.4 h3.3 v-3.4 h5.2 v3.4 h3.3 v-3.4 h4.6 v8.5 h-21 Z" />
      <path d="M15.5 17 h14 l1 16 h-16 Z" />
      {BASE}
    </>
  ),
  b: (c) => (
    <>
      <circle cx="22.5" cy="6.6" r="2.4" />
      <path d="M22.5 9 C28.5 13.5 30.5 19.5 28.3 25 L16.7 25 C14.5 19.5 16.5 13.5 22.5 9 Z" />
      <rect x="15.5" y="25" width="14" height="3.4" rx="1.4" />
      <path d="M18 28.4 h9 l2.2 5.6 h-13.4 Z" />
      {BASE}
      <path d="M25.2 13.5 L20.6 19.2" stroke={c.detail} strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </>
  ),
  n: (c) => (
    <>
      <path d="M13.5 34 C13.5 28.5 16 25.5 19.5 22.5 C20.5 21.6 20.6 20.6 19.8 20.2 C17.6 21.4 14.6 22.6 12.2 21.6 C10.4 20.8 10.2 18.6 11.6 16.8 C13.4 14.4 15.4 12.6 16.6 10.6 L17.2 6.8 L19.8 9.6 L21.4 6.6 L23 10 C29.6 11 33.4 16.6 33 24 L32.6 34 Z" />
      <circle cx="17.6" cy="14.6" r="1.35" fill={c.detail} stroke="none" />
      <path d="M12.6 19.8 L14.4 19.2" stroke={c.detail} strokeWidth="1.2" strokeLinecap="round" fill="none" />
      {BASE}
    </>
  ),
  q: () => (
    <>
      <path d="M11.5 31 L9.2 14.5 L13 24 L16.2 11.5 L19.2 22 L22.5 9.5 L25.8 22 L28.8 11.5 L32 24 L35.8 14.5 L33.5 31 Z" />
      <circle cx="9.2" cy="13.4" r="2.1" />
      <circle cx="16.2" cy="10.4" r="2.1" />
      <circle cx="22.5" cy="8.3" r="2.1" />
      <circle cx="28.8" cy="10.4" r="2.1" />
      <circle cx="35.8" cy="13.4" r="2.1" />
      <rect x="11.5" y="30.2" width="22" height="3.8" rx="1.4" />
      {BASE}
    </>
  ),
  k: () => (
    <>
      <rect x="21" y="4.5" width="3" height="11" rx="1" />
      <rect x="18" y="7.4" width="9" height="3" rx="1" />
      <path d="M11.5 31 C9 24.5 11.5 17.5 17 17.5 C19.2 17.5 21.2 18.8 22.5 21 C23.8 18.8 25.8 17.5 28 17.5 C33.5 17.5 36 24.5 33.5 31 Z" />
      <rect x="11.5" y="30.2" width="22" height="3.8" rx="1.4" />
      {BASE}
    </>
  ),
}

export default function ChessPiece({ piece, className = 'h-full w-full', style }) {
  if (!piece) return null
  const white = piece === piece.toUpperCase()
  const c = white ? LIGHT : DARK
  const shape = SHAPES[piece.toLowerCase()]
  return (
    <svg viewBox="0 0 45 45" className={className} style={style} aria-hidden="true">
      <g fill={c.fill} stroke={c.stroke} strokeWidth="1.5" strokeLinejoin="round">
        {shape(c)}
      </g>
    </svg>
  )
}

export const PIECE_NAMES = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' }
export const PIECE_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
