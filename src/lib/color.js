// HSB (hue 0–360, saturation 0–100, brightness 0–100) -> CSS
export function hsbToRgb({ h, s, b }) {
  const sv = s / 100
  const v = b / 100
  const k = (n) => (n + h / 60) % 6
  const f = (n) => v - v * sv * Math.max(0, Math.min(k(n), 4 - k(n), 1))
  return [f(5), f(3), f(1)].map((x) => Math.round(x * 255))
}

export function hsbToCss(color) {
  const [r, g, b] = hsbToRgb(color)
  return `rgb(${r} ${g} ${b})`
}

// Readable text on top of any color
export function inkFor(color) {
  const [r, g, b] = hsbToRgb(color)
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 150 ? '#22252E' : '#FFFFFF'
}

export const PLAYER_COLORS = ['var(--color-p1)', 'var(--color-p2)', 'var(--color-p3)', 'var(--color-p4)', 'var(--color-p5)', 'var(--color-p6)']
