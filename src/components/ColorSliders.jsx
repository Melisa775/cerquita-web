import { hsbToCss } from '../lib/color'

/**
 * Tres deslizadores (tono, saturación, brillo) cuya pista muestra el color real.
 * Sin pistas (nivel Experto) las barras son grises y hay que guiarse solo por el resultado.
 */
const PLAIN = 'linear-gradient(to right, #C9CBD1, #C9CBD1)'

export default function ColorSliders({ value, onChange, disabled = false, hints = true }) {
  const { h, s, b } = value
  const hues = [0, 60, 120, 180, 240, 300, 360].map((x) => hsbToCss({ h: x, s, b })).join(', ')

  const channels = [
    { key: 'h', label: 'Tono', max: 360, track: `linear-gradient(to right, ${hues})` },
    { key: 's', label: 'Saturación', max: 100, track: `linear-gradient(to right, ${hsbToCss({ h, s: 0, b })}, ${hsbToCss({ h, s: 100, b })})` },
    { key: 'b', label: 'Brillo', max: 100, track: `linear-gradient(to right, #000, ${hsbToCss({ h, s, b: 100 })})` },
  ]

  return (
    <div className="space-y-5">
      {channels.map((c) => (
        <label key={c.key} className="block">
          <span className="text-sm font-semibold">{c.label}</span>
          <input
            type="range"
            min={0}
            max={c.max}
            step={1}
            value={value[c.key]}
            disabled={disabled}
            onChange={(e) => onChange({ ...value, [c.key]: Number(e.target.value) })}
            className="hsb-range mt-2 disabled:cursor-not-allowed disabled:opacity-60"
            style={{ '--track': hints ? c.track : PLAIN, '--thumb': hints ? hsbToCss(value) : '#6B6F7B' }}
          />
        </label>
      ))}
    </div>
  )
}
