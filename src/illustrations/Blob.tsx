import { MOOD_COLOR, type Mood } from '../mock/user'

const INK = '#3B1F2B'

/** Slightly different soft-blob outlines so the characters feel hand-made. */
const SHAPES: Record<Mood, string> = {
  calm: 'M50 5 C76 5 95 22 95 50 C95 77 76 95 50 95 C24 95 5 78 5 51 C5 24 24 5 50 5Z',
  hot: 'M52 4 C78 6 96 24 95 52 C94 78 74 96 48 95 C22 94 4 76 6 49 C8 22 26 2 52 4Z',
  tired: 'M50 8 C78 8 96 26 95 54 C94 80 74 95 49 95 C23 95 5 80 5 54 C5 26 22 8 50 8Z',
  anxious: 'M50 4 C74 3 97 21 95 50 C93 79 77 96 50 96 C23 96 5 79 5 50 C5 21 26 5 50 4Z',
  low: 'M50 10 C77 10 95 28 95 56 C95 80 76 95 50 95 C24 95 5 80 5 56 C5 28 23 10 50 10Z',
  okay: 'M49 5 C75 4 95 23 95 50 C95 77 75 96 49 95 C23 94 5 76 5 50 C5 23 23 6 49 5Z',
}

function Face({ mood }: { mood: Mood }) {
  const s = { stroke: INK, strokeWidth: 3.2, strokeLinecap: 'round' as const, fill: 'none' }
  switch (mood) {
    case 'calm':
      return (
        <g>
          <path d="M31 47 Q37 52 43 47" {...s} />
          <path d="M57 47 Q63 52 69 47" {...s} />
          <path d="M41 62 Q50 69 59 62" {...s} />
        </g>
      )
    case 'hot':
      return (
        <g>
          <circle cx="37" cy="47" r="3.6" fill={INK} />
          <circle cx="63" cy="47" r="3.6" fill={INK} />
          <path d="M39 65 Q44 61 50 65 Q56 69 61 65" {...s} />
          <path d="M80 26 C84 32 86 36 82 39 C78 41 76 36 80 26Z" fill="#fff" opacity=".9" />
        </g>
      )
    case 'tired':
      return (
        <g>
          <path d="M30 50 L44 50" {...s} />
          <path d="M56 50 L70 50" {...s} />
          <path d="M44 66 Q50 63 56 66" {...s} />
          <text x="72" y="30" fontSize="13" fontWeight="700" fill={INK} opacity=".7" fontFamily="Poppins">z</text>
          <text x="80" y="20" fontSize="9" fontWeight="700" fill={INK} opacity=".5" fontFamily="Poppins">z</text>
        </g>
      )
    case 'anxious':
      return (
        <g>
          <circle cx="37" cy="48" r="6" fill="#fff" />
          <circle cx="63" cy="48" r="6" fill="#fff" />
          <circle cx="37" cy="49" r="2.6" fill={INK} />
          <circle cx="63" cy="49" r="2.6" fill={INK} />
          <path d="M29 36 L41 33" {...s} strokeWidth={2.6} />
          <path d="M59 33 L71 36" {...s} strokeWidth={2.6} />
          <path d="M40 67 Q45 63 50 67 Q55 71 60 67" {...s} />
        </g>
      )
    case 'low':
      return (
        <g>
          <path d="M31 51 Q37 47 43 51" {...s} />
          <path d="M57 51 Q63 47 69 51" {...s} />
          <path d="M42 70 Q50 63 58 70" {...s} />
          <path d="M66 58 C68 62 69 65 66 66 C63 66 64 62 66 58Z" fill="#fff" opacity=".9" />
        </g>
      )
    case 'okay':
    default:
      return (
        <g>
          <circle cx="37" cy="48" r="3.6" fill={INK} />
          <circle cx="63" cy="48" r="3.6" fill={INK} />
          <path d="M40 63 Q50 70 61 61" {...s} />
        </g>
      )
  }
}

export function MoodBlob({ mood, size = 120, faded = false, className }: { mood: Mood; size?: number; faded?: boolean; className?: string }) {
  const color = faded ? '#EDE3E8' : MOOD_COLOR[mood]
  const id = `bg-${mood}-${faded ? 'f' : 'n'}`
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <defs>
        <radialGradient id={id} cx="35%" cy="28%" r="80%">
          <stop offset="0" stopColor="#fff" stopOpacity=".75" />
          <stop offset=".35" stopColor={color} />
          <stop offset="1" stopColor={color} />
        </radialGradient>
      </defs>
      <path d={SHAPES[mood]} fill={`url(#${id})`} />
      <path d={SHAPES[mood]} fill="none" stroke="#000" strokeOpacity=".04" strokeWidth="3" />
      {!faded && (
        <>
          <ellipse cx="27" cy="58" rx="6" ry="3.5" fill="#E8577D" opacity=".28" />
          <ellipse cx="73" cy="58" rx="6" ry="3.5" fill="#E8577D" opacity=".28" />
        </>
      )}
      <g opacity={faded ? 0.35 : 1}>
        <Face mood={mood} />
      </g>
    </svg>
  )
}

/** Week-strip chip for a future day with no data: an empty, sleepy blob outline. */
export function EmptyBlob({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
      <path d={SHAPES.okay} fill="#fff" fillOpacity=".55" stroke="#C9AEB9" strokeWidth="3" strokeDasharray="6 7" />
      <circle cx="38" cy="50" r="3.5" fill="#C9AEB9" />
      <circle cx="62" cy="50" r="3.5" fill="#C9AEB9" />
    </svg>
  )
}
