/** Cartas del juego Una, dibujadas en SVG (diseño propio). */
export const CARD_COLORS = {
  r: { fill: 'hsl(2 72% 52%)', name: 'Rojo' },
  y: { fill: 'hsl(44 96% 52%)', name: 'Amarillo' },
  g: { fill: 'hsl(146 52% 38%)', name: 'Verde' },
  b: { fill: 'hsl(212 72% 48%)', name: 'Azul' },
}
const WILD_BG = '#22252E'

function Symbol({ value, size, fill }) {
  if (value === 'skip') {
    return (
      <g fill="none" stroke={fill} strokeWidth={size * 0.12} strokeLinecap="round">
        <circle cx="0" cy="0" r={size * 0.42} />
        <path d={`M${-size * 0.3} ${size * 0.3} L${size * 0.3} ${-size * 0.3}`} />
      </g>
    )
  }
  if (value === 'reverse') {
    const s = size * 0.42
    return (
      <g fill="none" stroke={fill} strokeWidth={size * 0.11} strokeLinecap="round" strokeLinejoin="round">
        <path d={`M${-s} ${-s * 0.25} H${s * 0.7} M${s * 0.35} ${-s * 0.6} L${s * 0.75} ${-s * 0.25} L${s * 0.35} ${s * 0.1}`} />
        <path d={`M${s} ${s * 0.45} H${-s * 0.7} M${-s * 0.35} ${s * 0.1} L${-s * 0.75} ${s * 0.45} L${-s * 0.35} ${s * 0.8}`} />
      </g>
    )
  }
  const text = value === 'draw2' ? '+2' : value === 'wild4' ? '+4' : value === 'wild' ? '' : value
  return (
    <text x="0" y={size * 0.36} textAnchor="middle" fontSize={size * (text.length > 1 ? 0.82 : 1.05)} fontWeight="800" fill={fill} fontFamily="Bricolage Grotesque, Instrument Sans, sans-serif">
      {text}
    </text>
  )
}

function Quadrants({ rx, ry }) {
  // óvalo partido en los cuatro colores
  const order = ['r', 'b', 'y', 'g']
  return (
    <g>
      <clipPath id={`q${rx}`}>
        <ellipse cx="0" cy="0" rx={rx} ry={ry} />
      </clipPath>
      <g clipPath={`url(#q${rx})`}>
        {order.map((c, i) => (
          <rect key={c} x={i % 2 ? 0 : -rx} y={i < 2 ? -ry : 0} width={rx} height={ry} fill={CARD_COLORS[c].fill} />
        ))}
      </g>
    </g>
  )
}

export default function PlayingCard({ card, faceDown = false, width = 72, className = '', style, chosen }) {
  const height = width * 1.5
  if (faceDown || !card) {
    return (
      <svg width={width} height={height} viewBox="0 0 100 150" className={`block shrink-0 drop-shadow-sm ${className}`} style={style} aria-hidden="true">
        <rect x="2" y="2" width="96" height="146" rx="12" fill="white" />
        <rect x="8" y="8" width="84" height="134" rx="8" fill={WILD_BG} />
        <g transform="translate(50 75) rotate(-28)">
          <ellipse rx="32" ry="52" fill="hsl(2 72% 52%)" />
          <text y="9" textAnchor="middle" fontSize="27" fontWeight="800" fill="white" fontFamily="Bricolage Grotesque, sans-serif">Una</text>
        </g>
      </svg>
    )
  }
  const wild = card.color === null
  const bg = wild ? WILD_BG : CARD_COLORS[card.color].fill
  const label = `${wild ? (card.value === 'wild4' ? 'Comodín +4' : 'Comodín') : `${CARD_COLORS[card.color].name} ${{ skip: 'Salta', reverse: 'Reversa', draw2: '+2' }[card.value] ?? card.value}`}`
  return (
    <svg width={width} height={height} viewBox="0 0 100 150" className={`block shrink-0 drop-shadow-sm ${className}`} style={style} role="img" aria-label={label}>
      <rect x="2" y="2" width="96" height="146" rx="12" fill="white" stroke={chosen ? CARD_COLORS[chosen].fill : 'transparent'} strokeWidth={chosen ? 6 : 0} />
      <rect x="8" y="8" width="84" height="134" rx="8" fill={bg} />
      <g transform="translate(50 75) rotate(-28)">
        {wild ? <Quadrants rx={30} ry={50} /> : <ellipse rx="30" ry="50" fill="white" />}
      </g>
      <g transform="translate(50 75)">
        <Symbol value={card.value} size={44} fill={wild ? 'white' : bg} />
      </g>
      <g transform="translate(22 26)">
        <Symbol value={card.value} size={18} fill="white" />
      </g>
      <g transform="translate(78 124) rotate(180)">
        <Symbol value={card.value} size={18} fill="white" />
      </g>
    </svg>
  )
}
