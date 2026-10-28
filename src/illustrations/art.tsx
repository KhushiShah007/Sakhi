// Original flat doodles for Sakhi. Soft shapes, palette colours, no heavy outlines.

function catmull(points: [number, number][]) {
  let d = `M${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

const SCRIBBLE = (() => {
  const pts: [number, number][] = []
  const n = 70
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 * 6
    const r = 26 + 10 * Math.sin(i * 0.9) + 6 * Math.cos(i * 1.7)
    pts.push([70 + r * Math.cos(t) + 7 * Math.sin(i * 0.37), 66 + r * 0.82 * Math.sin(t) + 5 * Math.cos(i * 0.53)])
  }
  return catmull(pts)
})()

/** Vent: a tangled thought-scribble with speech bubbles. Drawn for a deep-rose card. */
export function VentDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 130" className={className} aria-hidden>
      <path d={SCRIBBLE} fill="none" stroke="#3B1F2B" strokeWidth="2.6" strokeLinecap="round" opacity=".85" />
      {/* burst */}
      <path d="M120 92 l5 -10 l3 10 l10 -4 l-6 9 l9 6 l-11 1 l1 11 l-7 -8 l-7 8 l1 -11 l-11 -1 l9 -6 l-6 -9z" fill="#FFD58A" />
      {/* speech bubble */}
      <g transform="translate(6 10)">
        <path d="M0 10 C0 4 4 0 10 0 L50 0 C56 0 60 4 60 10 L60 26 C60 32 56 36 50 36 L22 36 L12 46 L13 36 L10 36 C4 36 0 32 0 26Z" fill="#FFFFFF" />
        <circle cx="18" cy="18" r="4" fill="#D6336C" />
        <circle cx="30" cy="18" r="4" fill="#D6336C" />
        <circle cx="42" cy="18" r="4" fill="#D6336C" />
      </g>
    </svg>
  )
}

/** Lotus with layered petals. Use `tone="light"` on dark/rose backgrounds. */
export function Lotus({ className, tone = 'warm' }: { className?: string; tone?: 'warm' | 'light' }) {
  const outer = tone === 'light' ? 'rgba(255,255,255,0.35)' : '#FBA2AB'
  const mid = tone === 'light' ? 'rgba(255,255,255,0.55)' : '#FEA38E'
  const inner = tone === 'light' ? 'rgba(255,255,255,0.85)' : '#FFDFC3'
  const petal = 'M0 0 C14 -18 14 -48 0 -70 C-14 -48 -14 -18 0 0Z'
  return (
    <svg viewBox="-100 -100 200 200" className={className} aria-hidden>
      <circle r="92" fill="none" stroke={tone === 'light' ? 'rgba(255,255,255,0.25)' : '#F3B5A0'} strokeWidth="1.5" strokeDasharray="2 6" />
      {Array.from({ length: 12 }).map((_, i) => (
        <path key={`o${i}`} d={petal} fill={outer} transform={`rotate(${i * 30}) scale(1.15)`} />
      ))}
      {Array.from({ length: 8 }).map((_, i) => (
        <path key={`m${i}`} d={petal} fill={mid} transform={`rotate(${i * 45 + 22.5}) scale(0.9)`} />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <path key={`i${i}`} d={petal} fill={inner} transform={`rotate(${i * 60}) scale(0.55)`} />
      ))}
      <circle r="13" fill="#FFD58A" />
      <circle r="6" fill="#FFFFFF" opacity=".7" />
      {tone === 'light' &&
        Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <circle key={`d${i}`} cx={Math.cos(a) * 84} cy={Math.sin(a) * 84} r={i % 2 ? 1.6 : 2.6} fill="#fff" opacity=".7" />
        })}
    </svg>
  )
}

/** Right Now card doodle: lotus + cooling sparkles on periwinkle. */
export function CoolDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 130" className={className} aria-hidden>
      <g transform="translate(78 70) scale(0.55)">
        {Array.from({ length: 8 }).map((_, i) => (
          <path key={i} d="M0 0 C16 -20 16 -54 0 -80 C-16 -54 -16 -20 0 0Z" fill={i % 2 ? '#E6D6F5' : '#FFFFFF'} opacity={i % 2 ? 0.9 : 0.95} transform={`rotate(${i * 45})`} />
        ))}
        <circle r="16" fill="#FFD58A" />
      </g>
      {/* snowflake sparkles */}
      {[[22, 28, 1], [130, 22, 0.8], [132, 108, 0.7], [20, 100, 0.6]].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`} stroke="#fff" strokeWidth="2.4" strokeLinecap="round">
          <path d="M0 -9 V9 M-8 -4.5 L8 4.5 M-8 4.5 L8 -4.5" />
        </g>
      ))}
    </svg>
  )
}

/** Say-it-for-me: two bubbles, one tangled, one calm with a heart. */
export function SayDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 90" className={className} aria-hidden>
      <path d="M8 14 C8 8 12 4 18 4 L58 4 C64 4 68 8 68 14 L68 36 C68 42 64 46 58 46 L30 46 L18 58 L20 46 L18 46 C12 46 8 42 8 36Z" fill="#E6D6F5" />
      <path d="M20 26 C24 16 30 34 36 22 C40 14 46 32 54 24" stroke="#6C5A9C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M48 44 C48 38 52 34 58 34 L104 34 C110 34 114 38 114 44 L114 68 C114 74 110 78 104 78 L100 78 L102 88 L90 78 L58 78 C52 78 48 74 48 68Z" fill="#FFFFFF" />
      <path d="M81 68 C72 62 68 57 68 52 C68 48 71 46 74 46 C77 46 79 48 81 51 C83 48 85 46 88 46 C91 46 94 48 94 52 C94 57 90 62 81 68Z" fill="#D6336C" />
    </svg>
  )
}

export function SunCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <g transform="translate(46 40)">
        {Array.from({ length: 10 }).map((_, i) => (
          <rect key={i} x="-3" y="-36" width="6" height="12" rx="3" fill="#FEA38E" transform={`rotate(${i * 36})`} />
        ))}
        <circle r="22" fill="#FFC56B" />
        <circle r="22" fill="url(#sunGlow)" />
      </g>
      <defs>
        <radialGradient id="sunGlow" cx="35%" cy="30%">
          <stop offset="0" stopColor="#fff" stopOpacity=".6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path d="M40 86 C28 86 22 78 24 70 C26 62 34 58 42 60 C44 50 54 44 64 46 C74 48 80 56 80 64 C90 62 98 68 98 76 C98 82 94 86 86 86Z" fill="#FFFFFF" />
      {/* humid droplets */}
      <path d="M52 94 C54 97 55 99 52 100 C49 99 50 97 52 94Z" fill="#9AA6E8" />
      <path d="M68 92 C70 95 71 97 68 98 C65 97 66 95 68 92Z" fill="#9AA6E8" />
    </svg>
  )
}

/** Tiny forecast glyph for the week strip. */
export function ForecastGlyph({ size = 30 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      <circle cx="16" cy="15" r="8" fill="#FFC56B" />
      {Array.from({ length: 8 }).map((_, i) => (
        <rect key={i} x="15" y="1.5" width="2" height="4" rx="1" fill="#FEA38E" transform={`rotate(${i * 45} 16 15)`} />
      ))}
      <path d="M12 33 C7 33 5 29 6.5 26 C8 23 11 22 14 23 C15 19 19 17 23 18 C27 19 29 22 29 25 C33 24 36 27 36 30 C36 32 34 33 32 33Z" fill="#fff" stroke="#F3B5A0" strokeWidth="1.2" />
    </svg>
  )
}

/** Soft wave band used at the bottom edge of deep-rose hero panels. */
export function WaveEdge({ className, fill = '#FBEBDD' }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 390 40" preserveAspectRatio="none" className={className} aria-hidden>
      <path d="M0 22 C60 4 120 4 195 20 C270 36 330 34 390 16 L390 40 L0 40Z" fill={fill} />
    </svg>
  )
}

/** Swirly background waves for rose hero panels (inspired by ref 04, drawn fresh). */
export function HeroSwirls({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 390 320" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <path d="M-20 90 C60 40 140 140 230 80 C300 34 360 60 420 30" stroke="#fff" strokeOpacity=".12" strokeWidth="28" fill="none" strokeLinecap="round" />
      <path d="M-20 200 C80 150 150 240 250 180 C320 140 370 170 420 150" stroke="#fff" strokeOpacity=".08" strokeWidth="36" fill="none" strokeLinecap="round" />
      <circle cx="330" cy="70" r="46" fill="none" stroke="#fff" strokeOpacity=".1" strokeWidth="14" />
      <circle cx="330" cy="70" r="16" fill="#fff" fillOpacity=".08" />
    </svg>
  )
}

/** Simple lesson illustrations for the family learning module. */
export function LessonArt({ kind, className }: { kind: 'wave' | 'body' | 'home' | 'speech'; className?: string }) {
  if (kind === 'wave')
    return (
      <svg viewBox="0 0 200 120" className={className} aria-hidden>
        <path d="M0 70 C25 30 50 30 75 60 C100 90 125 90 150 50 C165 28 185 26 200 40" stroke="#D6336C" strokeWidth="6" fill="none" strokeLinecap="round" />
        <path d="M0 84 C30 60 60 70 90 80 C120 90 160 70 200 64" stroke="#6C7BD9" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="2 10" />
        <circle cx="75" cy="60" r="7" fill="#FEA38E" />
        <circle cx="150" cy="50" r="7" fill="#FEA38E" />
      </svg>
    )
  if (kind === 'body')
    return (
      <svg viewBox="0 0 200 120" className={className} aria-hidden>
        {[['#FEA38E', 40, 50], ['#D8C5F2', 90, 34], ['#FBA2AB', 140, 56], ['#B4BEF0', 70, 88], ['#FFD58A', 124, 92]].map(([c, x, y], i) => (
          <circle key={i} cx={x as number} cy={y as number} r={i % 2 ? 18 : 22} fill={c as string} />
        ))}
      </svg>
    )
  if (kind === 'home')
    return (
      <svg viewBox="0 0 200 120" className={className} aria-hidden>
        <path d="M50 64 L100 24 L150 64 L150 108 L50 108Z" fill="#FFDFC3" />
        <path d="M40 66 L100 18 L160 66" stroke="#D6336C" strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="88" y="74" width="24" height="34" rx="4" fill="#FEA38E" />
        <path d="M100 66 C92 60 88 56 88 52 C88 48 91 46 94 46 C97 46 99 48 100 50 C101 48 103 46 106 46 C109 46 112 48 112 52 C112 56 108 60 100 66Z" fill="#D6336C" />
      </svg>
    )
  return (
    <svg viewBox="0 0 200 120" className={className} aria-hidden>
      <rect x="14" y="16" width="92" height="44" rx="16" fill="#FBEBDD" />
      <path d="M40 38 L80 38" stroke="#B02458" strokeWidth="5" strokeLinecap="round" />
      <path d="M34 32 L86 44" stroke="#B02458" strokeWidth="4" strokeLinecap="round" />
      <rect x="92" y="62" width="96" height="44" rx="16" fill="#6C7BD9" />
      <path d="M110 84 l8 8 l16 -16" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M142 84 L172 84" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
