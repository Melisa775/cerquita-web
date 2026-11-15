/** Colores, nombres e íconos propios de Colonos. */
export const RESOURCES = ['madera', 'ladrillo', 'lana', 'trigo', 'piedra']

export const TERRAIN = {
  bosque: { fill: 'hsl(135 38% 34%)', res: 'madera', label: 'Bosque' },
  cerro: { fill: 'hsl(14 58% 50%)', res: 'ladrillo', label: 'Cerro' },
  pasto: { fill: 'hsl(92 48% 58%)', res: 'lana', label: 'Pasto' },
  campo: { fill: 'hsl(44 82% 58%)', res: 'trigo', label: 'Campo' },
  montana: { fill: 'hsl(215 12% 56%)', res: 'piedra', label: 'Montaña' },
  desierto: { fill: 'hsl(38 48% 78%)', res: null, label: 'Desierto' },
}

export const RES_META = {
  madera: { label: 'Madera', terrain: 'bosque' },
  ladrillo: { label: 'Ladrillo', terrain: 'cerro' },
  lana: { label: 'Lana', terrain: 'pasto' },
  trigo: { label: 'Trigo', terrain: 'campo' },
  piedra: { label: 'Piedra', terrain: 'montana' },
}

export const DEV_META = {
  soldado: { label: 'Soldado', text: 'Mueve el ladrón y róbale una carta. Tres o más dan el ejército más grande.' },
  caminos: { label: 'Constructor', text: 'Pon dos caminos gratis.' },
  cosecha: { label: 'Cosecha', text: 'Toma dos recursos del banco.' },
  monopolio: { label: 'Monopolio', text: 'Te llevas todas las cartas de un recurso que tenga tu pareja.' },
  punto: { label: 'Punto', text: 'Vale un punto de victoria. Cuenta solo, sin jugarla.' },
}

/** Dibujo del terreno dentro de una caja de -1..1 (se escala desde afuera). */
export function TerrainArt({ terrain }) {
  switch (terrain) {
    case 'bosque':
      return (
        <g fill="hsl(135 45% 22%)">
          <path d="M-0.42 0.28 L-0.22 -0.2 L-0.02 0.28 Z" />
          <path d="M0.06 0.18 L0.3 -0.38 L0.54 0.18 Z" />
          <path d="M-0.18 0.5 L0.02 0.06 L0.22 0.5 Z" fill="hsl(135 45% 26%)" />
        </g>
      )
    case 'cerro':
      return (
        <g fill="hsl(14 55% 38%)" stroke="hsl(14 60% 62%)" strokeWidth="0.03">
          <rect x="-0.42" y="-0.12" width="0.4" height="0.18" />
          <rect x="0.02" y="-0.12" width="0.4" height="0.18" />
          <rect x="-0.2" y="0.08" width="0.4" height="0.18" />
          <rect x="-0.2" y="-0.32" width="0.4" height="0.18" />
        </g>
      )
    case 'pasto':
      return (
        <g>
          <ellipse cx="0" cy="0.02" rx="0.32" ry="0.2" fill="white" />
          <circle cx="-0.2" cy="-0.12" r="0.13" fill="white" />
          <circle cx="0.12" cy="-0.14" r="0.14" fill="white" />
          <circle cx="0.36" cy="-0.02" r="0.11" fill="hsl(30 15% 25%)" />
          <path d="M-0.16 0.2 v0.16 M0.14 0.2 v0.16" stroke="hsl(30 15% 25%)" strokeWidth="0.06" strokeLinecap="round" />
        </g>
      )
    case 'campo':
      return (
        <g stroke="hsl(36 70% 36%)" strokeWidth="0.05" strokeLinecap="round" fill="hsl(36 70% 40%)">
          {[-0.28, 0, 0.28].map((x) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d="M0 0.42 V-0.3" fill="none" />
              <ellipse cx="-0.07" cy="-0.16" rx="0.05" ry="0.09" transform="rotate(-25 -0.07 -0.16)" />
              <ellipse cx="0.07" cy="-0.06" rx="0.05" ry="0.09" transform="rotate(25 0.07 -0.06)" />
              <ellipse cx="-0.07" cy="0.04" rx="0.05" ry="0.09" transform="rotate(-25 -0.07 0.04)" />
              <ellipse cx="0" cy="-0.32" rx="0.045" ry="0.08" />
            </g>
          ))}
        </g>
      )
    case 'montana':
      return (
        <g>
          <path d="M-0.5 0.32 L-0.12 -0.36 L0.26 0.32 Z" fill="hsl(215 14% 38%)" />
          <path d="M-0.05 0.32 L0.22 -0.12 L0.5 0.32 Z" fill="hsl(215 14% 44%)" />
          <path d="M-0.22 -0.18 L-0.12 -0.36 L-0.02 -0.18 L-0.08 -0.22 L-0.13 -0.16 Z" fill="white" />
        </g>
      )
    default:
      return (
        <g fill="hsl(130 30% 40%)">
          <rect x="-0.06" y="-0.32" width="0.12" height="0.6" rx="0.06" />
          <path d="M-0.06 0 h-0.16 v-0.18" fill="none" stroke="hsl(130 30% 40%)" strokeWidth="0.1" strokeLinecap="round" />
          <path d="M0.06 0.06 h0.14 v-0.14" fill="none" stroke="hsl(130 30% 40%)" strokeWidth="0.1" strokeLinecap="round" />
        </g>
      )
  }
}

/** Ícono cuadrado de un recurso, para las cartas de la mano. */
export function ResourceIcon({ res, className = 'h-8 w-8' }) {
  const t = RES_META[res].terrain
  return (
    <svg viewBox="-1 -1 2 2" className={className} aria-hidden="true">
      <rect x="-1" y="-1" width="2" height="2" rx="0.4" fill={TERRAIN[t].fill} />
      <g transform="scale(1.35)">
        <TerrainArt terrain={t} />
      </g>
    </svg>
  )
}

export const pips = (n) => 6 - Math.abs(7 - n)
