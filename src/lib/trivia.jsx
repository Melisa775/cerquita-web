/** Categorías de la trivia: nombre, color e ícono (mismo orden que la ruleta del servidor). */
export const CATEGORY_META = {
  geografia: { label: 'Geografía', color: 'hsl(207 68% 46%)' },
  historia: { label: 'Historia', color: 'hsl(42 88% 47%)' },
  ciencia: { label: 'Ciencia', color: 'hsl(148 48% 37%)' },
  arte: { label: 'Arte', color: 'hsl(2 66% 52%)' },
  entretenimiento: { label: 'Entretenimiento', color: 'hsl(318 52% 50%)' },
  deportes: { label: 'Deportes', color: 'hsl(24 88% 52%)' },
  corona: { label: 'Corona', color: 'hsl(258 32% 40%)' },
}
export const CATEGORIES = ['geografia', 'historia', 'ciencia', 'arte', 'entretenimiento', 'deportes']
export const WHEEL = [...CATEGORIES, 'corona']

/** Ícono blanco de cada categoría, dibujado en una caja de 24×24. */
export function CategoryIcon({ category, className = 'h-6 w-6', color = 'white', ...rest }) {
  const s = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  const paths = {
    geografia: (
      <>
        <circle cx="12" cy="12" r="9" {...s} />
        <path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" {...s} />
      </>
    ),
    historia: (
      <>
        <path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" {...s} />
      </>
    ),
    ciencia: (
      <>
        <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3" {...s} />
        <path d="M7.5 15h9" {...s} />
      </>
    ),
    arte: (
      <>
        <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 1.4-2.2-.7-1.3.2-2.8 1.7-2.8H18a3 3 0 0 0 3-3c0-5.5-4-10-9-10z" {...s} />
        <circle cx="7.5" cy="11" r="1.2" fill={color} />
        <circle cx="10.5" cy="7" r="1.2" fill={color} />
        <circle cx="15" cy="7.5" r="1.2" fill={color} />
      </>
    ),
    entretenimiento: (
      <>
        <rect x="3" y="9" width="18" height="12" rx="1.5" {...s} />
        <path d="M3 9l2.5-5 15 2.8L21 9M8 4.5l1 4.5M13 5.5l1 3.5" {...s} />
      </>
    ),
    deportes: (
      <>
        <circle cx="12" cy="12" r="9" {...s} />
        <path d="M12 7.5l4 3-1.5 4.5h-5L8 10.5zM12 3v4.5M16 10.5l4.5-1.5M14.5 15l2.5 4M9.5 15L7 19M8 10.5L3.5 9" {...s} />
      </>
    ),
    corona: <path d="M4 18h16M4 18L3 7l5 4 4-6 4 6 5-4-1 11" {...s} />,
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...rest}>
      {paths[category]}
    </svg>
  )
}

/** Insignia redonda de una categoría (llena si ya se ganó su corona). */
export function CrownBadge({ category, won = true, size = 'h-9 w-9', title }) {
  const meta = CATEGORY_META[category]
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${size}`}
      style={won ? { background: meta.color } : { background: 'var(--color-stone)', border: '2px dashed var(--color-line)' }}
      title={title ?? `${meta.label}${won ? '' : ' (pendiente)'}`}
    >
      <CategoryIcon category={category} className="h-[58%] w-[58%]" color={won ? 'white' : 'var(--color-line)'} />
    </span>
  )
}
