import { cloneElement } from 'react'

/**
 * Dibujo del ahorcado. Las partes aparecen trazándose una por una según los
 * errores. Con más vidas, primero se va armando la horca; con 6 ya está lista.
 * Si adivinan, el muñeco se baja de la horca y celebra.
 */
const GALLOWS = [
  <line key="base" x1="20" y1="205" x2="120" y2="205" />,
  <line key="pole" x1="50" y1="205" x2="50" y2="20" />,
  <path key="beam" d="M50 20 H140 M50 52 L82 20" />,
  <line key="rope" x1="140" y1="20" x2="140" y2="45" />,
]

const BODY = {
  head: <circle key="head" cx="140" cy="62" r="17" />,
  body: <line key="body" x1="140" y1="79" x2="140" y2="135" />,
  armL: <line key="armL" x1="140" y1="95" x2="116" y2="118" />,
  armR: <line key="armR" x1="140" y1="95" x2="164" y2="118" />,
  legL: <line key="legL" x1="140" y1="135" x2="119" y2="172" />,
  legR: <line key="legR" x1="140" y1="135" x2="161" y2="172" />,
}
const BODY_ORDER = ['head', 'body', 'armL', 'armR', 'legL', 'legR']
const TOTAL_PARTS = GALLOWS.length + BODY_ORDER.length

export default function HangmanDrawing({ misses, lives, state = 'playing', color = 'var(--color-ink)' }) {
  const pre = TOTAL_PARTS - lives // partes que ya vienen dibujadas
  const shown = Math.min(TOTAL_PARTS, pre + misses)
  const won = state === 'won'
  const lost = state === 'lost'
  const left = lives - misses

  // Al ganar se dibuja el muñeco completo, sin cuerda, en el piso.
  const bodyParts = won ? BODY_ORDER : BODY_ORDER.slice(0, Math.max(0, shown - GALLOWS.length))
  const gallowsParts = GALLOWS.slice(0, won ? 3 : Math.min(shown, GALLOWS.length))

  const animate = (index) => (index >= pre && !won ? 'hm-draw' : '')

  return (
    <svg viewBox="0 0 200 220" className="h-full w-full" role="img" aria-label={label(won, lost, left)}>
      <g fill="none" stroke="var(--color-muted)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        {gallowsParts.map((part, i) => (
          <g key={part.key} className={animate(i)}>
            {withLength(part)}
          </g>
        ))}
      </g>

      <g
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        style={{ transform: won ? 'translateY(33px)' : 'none', transition: 'transform 500ms cubic-bezier(.3,1.4,.5,1)' }}
      >
        {bodyParts.map((key, i) => {
          let part = BODY[key]
          if (won && key === 'armL') part = <line key="armL" x1="140" y1="95" x2="118" y2="70" />
          if (won && key === 'armR') part = <line key="armR" x1="140" y1="95" x2="162" y2="70" />
          return (
            <g key={key} className={animate(GALLOWS.length + i)}>
              {withLength(part)}
            </g>
          )
        })}
        {bodyParts.includes('head') && <Face won={won} lost={lost} left={left} lives={lives} color={color} />}
      </g>

      {won && (
        <g fill="var(--color-p2)" aria-hidden="true">
          <Heart x={96} y={70} delay={0} />
          <Heart x={176} y={58} delay={180} />
          <Heart x={110} y={36} delay={360} />
        </g>
      )}
    </svg>
  )
}

function withLength(el) {
  // pathLength=1 permite animar el trazo sin conocer el largo real
  return cloneElement(el, { pathLength: 1 })
}

function Face({ won, lost, left, lives, color }) {
  const worried = !won && !lost && left <= Math.ceil(lives / 3)
  return (
    <g strokeWidth="2.6" className="hm-face">
      {lost ? (
        <path d="M130 56 l6 6 m0 -6 l-6 6 M144 56 l6 6 m0 -6 l-6 6" />
      ) : won ? (
        <path d="M130 61 q3 -4 6 0 M144 61 q3 -4 6 0" />
      ) : (
        <>
          <circle cx="134" cy="59" r="1.6" fill={color} />
          <circle cx="146" cy="59" r="1.6" fill={color} />
        </>
      )}
      {won ? (
        <path d="M131 67 q9 9 18 0" />
      ) : lost ? (
        <path d="M134 71 h12" />
      ) : worried ? (
        <path d="M133 71 q7 -5 14 0" />
      ) : (
        <path d="M133 68 q7 5 14 0" />
      )}
      <circle cx="128" cy="66" r="3" fill="var(--color-p2)" stroke="none" opacity=".35" />
      <circle cx="152" cy="66" r="3" fill="var(--color-p2)" stroke="none" opacity=".35" />
      {worried && left === 1 && <path d="M156 48 q3 5 0 7 q-3 -2 0 -7" fill="#7FB6E0" stroke="none" />}
    </g>
  )
}

function Heart({ x, y, delay }) {
  return (
    <path
      className="hm-heart"
      style={{ animationDelay: `${delay}ms` }}
      transform={`translate(${x} ${y}) scale(.9)`}
      d="M0 3 C0 -1 -6 -1 -6 3 C-6 6 0 9 0 11 C0 9 6 6 6 3 C6 -1 0 -1 0 3 Z"
    />
  )
}

function label(won, lost, left) {
  if (won) return 'El muñeco se salvó'
  if (lost) return 'El muñeco quedó ahorcado'
  return `Quedan ${left} ${left === 1 ? 'vida' : 'vidas'}`
}
