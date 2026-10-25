/**
 * Retrato de un personaje de Adivina quién, dibujado a partir de sus rasgos.
 * Los personajes son originales de Cerquita.
 */
const SKIN = ['#F5D3B8', '#E8B48F', '#C68A5E', '#8D5A3B']
const HAIR = { negro: '#2B2522', castano: '#6B4128', rubio: '#E3B94C', pelirrojo: '#C8562C', canoso: '#CFCDC8' }
const EYES = { cafes: '#5A3A24', azules: '#3B7DC4', verdes: '#3E9460' }
const SHIRTS = ['#0F6E6A', '#B23A5A', '#3B5BA5', '#D08A2E', '#6B4FA0', '#2F8F6F']

function shirtFor(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997
  return SHIRTS[h % SHIRTS.length]
}

export default function Avatar({ c, className = '', zoom = false }) {
  const skin = SKIN[c.piel] ?? SKIN[0]
  const hair = HAIR[c.color] ?? HAIR.negro
  const brow = c.color === 'canoso' ? '#9B9893' : c.color === 'rubio' ? '#B8902F' : hair
  const shade = 'rgb(0 0 0 / 0.18)'

  return (
    <svg viewBox={zoom ? '12 8 76 76' : '0 0 100 100'} className={className} role="img" aria-label={c.name}>
      <rect width="100" height="100" fill={c.fondo} />

      {/* Pelo de atrás */}
      {c.pelo === 'largo' && <path d="M25 50 Q24 19 50 19 Q76 19 75 50 L78 84 Q50 92 22 84 Z" fill={hair} />}
      {c.pelo === 'rizado' && (
        <g fill={hair}>
          {[[28, 40, 10], [72, 40, 10], [29, 57, 9], [71, 57, 9], [50, 21, 13], [35, 25, 11], [65, 25, 11]].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      )}
      {c.pelo === 'recogido' && <circle cx="50" cy="17" r="10" fill={hair} />}

      {/* Cuerpo */}
      <path d="M17 100 Q19 77 50 75 Q81 77 83 100 Z" fill={shirtFor(c.id)} />
      <rect x="44" y="64" width="12" height="14" rx="4" fill={skin} />
      <rect x="44" y="64" width="12" height="6" fill={shade} />
      <circle cx="28.5" cy="50" r="5" fill={skin} />
      <circle cx="71.5" cy="50" r="5" fill={skin} />
      <ellipse cx="50" cy="48" rx="21" ry="24" fill={skin} />

      {/* Pelo de adelante */}
      {c.pelo === 'corto' && <path d="M29 45 Q27 21 50 21 Q73 21 71 45 Q67 31 51 30 Q37 31 29 45 Z" fill={hair} />}
      {c.pelo === 'largo' && <path d="M28 52 Q25 21 50 20 Q75 21 72 52 Q70 33 57 29 Q44 36 30 40 Z" fill={hair} />}
      {c.pelo === 'recogido' && <path d="M29 45 Q29 22 50 22 Q71 22 71 45 Q64 29 50 29 Q36 29 29 45 Z" fill={hair} />}
      {c.pelo === 'rizado' && (
        <g fill={hair}>
          {[[36, 30, 8], [46, 26, 8], [56, 26, 8], [65, 31, 8], [30, 39, 6], [70, 39, 6]].map(([x, y, r]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
          ))}
        </g>
      )}
      {c.pelo === 'calvo' && (
        <g fill={hair}>
          <ellipse cx="30" cy="45" rx="3.5" ry="7" />
          <ellipse cx="70" cy="45" rx="3.5" ry="7" />
        </g>
      )}

      {/* Cara */}
      <g fill="none" stroke={brow} strokeWidth="2.2" strokeLinecap="round">
        <path d="M37.5 39.5 q5 -3.2 9.5 0" />
        <path d="M53 39.5 q5 -3.2 9.5 0" />
      </g>
      {[42.5, 57.5].map((x) => (
        <g key={x}>
          <circle cx={x} cy="46.5" r="3.4" fill={EYES[c.ojos]} />
          <circle cx={x} cy="46.5" r="1.5" fill="#1D1B1A" />
          <circle cx={x + 1} cy="45.5" r="0.8" fill="white" />
        </g>
      ))}
      <path d="M50 49.5 q-2.2 5 1 6" fill="none" stroke={shade} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="35.5" cy="55.5" r="3.6" fill="#F08A8A" opacity=".35" />
      <circle cx="64.5" cy="55.5" r="3.6" fill="#F08A8A" opacity=".35" />
      {c.pecas && (
        <g fill="#9A5B35" opacity=".7">
          {[[34, 52], [37, 55], [33, 56], [66, 52], [63, 55], [67, 56]].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" />
          ))}
        </g>
      )}
      {c.barba && <path d="M29.5 51 Q30 75 50 77 Q70 75 70.5 51 Q67 66 50 67.5 Q33 66 29.5 51 Z" fill={hair} />}
      <path d="M43.5 59 q6.5 6 13 0" fill="none" stroke="#8A3B3B" strokeWidth="2" strokeLinecap="round" />
      {c.bigote && <path d="M41.5 57 Q46 52.5 50 55.5 Q54 52.5 58.5 57 Q54 58.8 50 57.8 Q46 58.8 41.5 57 Z" fill={hair} />}

      {/* Accesorios */}
      {c.aretes && (
        <g fill="#E3B94C">
          <circle cx="28.5" cy="57" r="2.3" />
          <circle cx="71.5" cy="57" r="2.3" />
        </g>
      )}
      {c.gafas && (
        <g fill="white" fillOpacity=".18" stroke="#22252E" strokeWidth="2">
          <circle cx="42.5" cy="46.5" r="6.2" />
          <circle cx="57.5" cy="46.5" r="6.2" />
          <path d="M48.7 46 h2.6 M36.3 45.5 L29.5 44 M63.7 45.5 L70.5 44" fill="none" />
        </g>
      )}
      {c.sombrero === 'gorra' && (
        <g>
          <path d="M28 37 Q27 17 50 17 Q73 17 72 37 Z" fill={shirtFor(c.id + 'g')} />
          <path d="M60 35 Q80 31 87 37 Q76 41 58 38.5 Z" fill={shirtFor(c.id + 'g')} />
          <path d="M28 37 Q50 33 72 37" fill="none" stroke={shade} strokeWidth="2" />
          <circle cx="50" cy="17.5" r="2" fill={shade} />
        </g>
      )}
      {c.sombrero === 'sombrero' && (
        // Un sombrero vueltiao, con sus franjas negras
        <g>
          <ellipse cx="50" cy="31" rx="31" ry="6.5" fill="#F2E6C9" />
          <ellipse cx="50" cy="31" rx="25" ry="4.6" fill="none" stroke="#22252E" strokeWidth="1.4" />
          <ellipse cx="50" cy="31" rx="19" ry="3.3" fill="none" stroke="#22252E" strokeWidth="1.4" />
          <path d="M37 31 Q37 12 50 12 Q63 12 63 31 Z" fill="#F2E6C9" />
          <path d="M37.8 24 Q50 21.5 62.2 24 M38.6 18.5 Q50 16 61.4 18.5" fill="none" stroke="#22252E" strokeWidth="1.6" />
        </g>
      )}
    </svg>
  )
}
