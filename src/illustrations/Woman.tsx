// Original flat illustration: a woman in her late 40s in a kurta + dupatta, holding chai.
export const SKIN = { warm: '#C68863', deep: '#9A6244', light: '#DDA57F', dusk: '#7E4F37' }

type Props = {
  skin?: string
  kurta?: string
  dupatta?: string
  className?: string
  /** 'chai' = holding a cup; 'calm' = hands folded, eyes closed */
  pose?: 'chai' | 'calm'
}

function Leaf({ x, y, r, fill, s = 1 }: { x: number; y: number; r: number; fill: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 C8 -34 40 -52 70 -48 C62 -18 34 4 0 0Z" fill={fill} />
      <path d="M2 -2 C20 -18 40 -32 62 -44" stroke="#fff" strokeOpacity=".45" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  )
}

export function Woman({ skin = SKIN.warm, kurta = '#D6336C', dupatta = '#FEA38E', className, pose = 'chai' }: Props) {
  const hair = '#3A2329'
  const shade = 'rgba(59,31,43,0.14)'
  return (
    <svg viewBox="0 0 260 300" className={className} role="img" aria-label="Illustration of Sunita, a woman in her late forties">
      {/* plants behind */}
      <Leaf x={40} y={262} r={-70} fill="#F3B5A0" s={1.1} />
      <Leaf x={52} y={276} r={-30} fill="#FEA38E" />
      <Leaf x={220} y={262} r={-110} fill="#F3B5A0" s={1.1} />
      <g transform="translate(210 276) scale(-1 1)"><Leaf x={0} y={0} r={-30} fill="#FEA38E" /></g>
      {/* marigolds */}
      {[[30, 210], [232, 214], [22, 246]].map(([cx, cy], i) => (
        <g key={i}>
          <circle cx={cx} cy={cy} r="9" fill="#FFB547" />
          <circle cx={cx} cy={cy} r="4" fill="#F38A2E" />
        </g>
      ))}

      {/* bun + back hair */}
      <circle cx="130" cy="56" r="21" fill={hair} />
      <path d="M118 46 C124 40 136 40 142 46" stroke="#5A3A44" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <ellipse cx="130" cy="96" rx="39" ry="43" fill={hair} />

      {/* neck */}
      <path d="M117 128 L143 128 L145 160 L115 160 Z" fill={skin} />
      <path d="M117 136 C124 142 136 142 143 136 L143 146 C136 150 124 150 117 146 Z" fill={shade} />

      {/* body / kurta */}
      <path d="M58 300 C58 226 80 172 116 154 L144 154 C180 172 202 226 202 300 Z" fill={kurta} />
      {/* neckline with gold trim */}
      <path d="M116 154 L130 178 L144 154" fill={skin} />
      <path d="M114 153 L130 180 L146 153" stroke="#F6C15A" strokeWidth="3" fill="none" strokeLinejoin="round" />
      {/* kurta motif dots */}
      {[[92, 240], [104, 270], [168, 244], [156, 276], [130, 288]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="#fff" opacity=".35" />
      ))}
      {/* dupatta across shoulder */}
      <path d="M150 156 C176 164 194 190 202 222 L202 300 L182 300 C182 252 170 206 140 170 Z" fill={dupatta} />
      <path d="M182 300 C182 252 170 206 140 170" stroke="#fff" strokeOpacity=".6" strokeWidth="2" strokeDasharray="1 7" strokeLinecap="round" fill="none" />

      {pose === 'chai' ? (
        <>
          {/* sleeves */}
          <path d="M86 190 C86 214 98 230 114 236" stroke="#B02458" strokeWidth="24" strokeLinecap="round" fill="none" />
          <path d="M174 190 C174 214 162 230 146 236" stroke="#B02458" strokeWidth="24" strokeLinecap="round" fill="none" />
          {/* hands */}
          <ellipse cx="113" cy="236" rx="13" ry="10" fill={skin} />
          <ellipse cx="147" cy="236" rx="13" ry="10" fill={skin} />
          {/* bangles */}
          <path d="M100 228 C98 234 99 242 102 246" stroke="#F6C15A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          <path d="M160 228 C162 234 161 242 158 246" stroke="#F6C15A" strokeWidth="3.5" fill="none" strokeLinecap="round" />
          {/* chai cup */}
          <path d="M116 214 L144 214 L141 246 C140 250 120 250 119 246 Z" fill="#FBEBDD" />
          <rect x="117" y="222" width="26" height="6" fill="#F3B5A0" />
          <ellipse cx="130" cy="214" rx="14" ry="3.5" fill="#C9875F" />
          <path d="M124 206 C120 198 128 194 124 186" stroke="#fff" strokeOpacity=".8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <path d="M136 206 C132 198 140 194 136 186" stroke="#fff" strokeOpacity=".8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M86 190 C88 218 104 238 122 242" stroke="#B02458" strokeWidth="24" strokeLinecap="round" fill="none" />
          <path d="M174 190 C172 218 156 238 138 242" stroke="#B02458" strokeWidth="24" strokeLinecap="round" fill="none" />
          <path d="M122 250 C118 236 124 220 130 214 C136 220 142 236 138 250 Z" fill={skin} />
          <path d="M130 216 L130 248" stroke={shade} strokeWidth="2" />
        </>
      )}

      {/* ears + earrings */}
      <ellipse cx="97" cy="104" rx="6" ry="9" fill={skin} />
      <ellipse cx="163" cy="104" rx="6" ry="9" fill={skin} />
      <circle cx="97" cy="117" r="3.5" fill="#F6C15A" />
      <circle cx="163" cy="117" r="3.5" fill="#F6C15A" />

      {/* face */}
      <ellipse cx="130" cy="101" rx="32" ry="37" fill={skin} />
      {/* front hair, centre parting, with a soft grey streak */}
      <path d="M130 63 C110 61 96 75 97 104 C101 86 112 76 130 74 Z" fill={hair} />
      <path d="M130 63 C150 61 164 75 163 104 C159 86 148 76 130 74 Z" fill={hair} />
      <path d="M126 66 C113 68 103 78 100 96" stroke="#CDBAC1" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* bindi */}
      <circle cx="130" cy="88" r="3.2" fill="#D6336C" />
      {/* brows */}
      <path d="M108 93 Q116 89 124 92" stroke={hair} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M136 92 Q144 89 152 93" stroke={hair} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* calm closed eyes */}
      <path d="M109 103 Q116 108 123 103" stroke="#3B1F2B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M137 103 Q144 108 151 103" stroke="#3B1F2B" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* nose */}
      <path d="M131 105 Q127 115 132 117" stroke={shade} strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* cheeks */}
      <ellipse cx="111" cy="116" rx="7" ry="4" fill="#FBA2AB" opacity=".55" />
      <ellipse cx="149" cy="116" rx="7" ry="4" fill="#FBA2AB" opacity=".55" />
      {/* smile */}
      <path d="M121 124 Q130 131 139 124" stroke="#8E3B4F" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* smile lines: she is 48 */}
      <path d="M115 121 Q113 125 115 129" stroke={shade} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M145 121 Q147 125 145 129" stroke={shade} strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Small round avatar crop of Sunita. */
export function Avatar({ size = 44, skin = SKIN.warm }: { size?: number; skin?: string }) {
  return (
    <div
      className="overflow-hidden rounded-full bg-gradient-to-br from-peach-light to-blush ring-2 ring-white"
      style={{ width: size, height: size }}
    >
      <svg viewBox="70 30 120 120" width={size} height={size} aria-hidden>
        <circle cx="130" cy="56" r="21" fill="#3A2329" />
        <ellipse cx="130" cy="96" rx="39" ry="43" fill="#3A2329" />
        <path d="M58 300 C58 226 80 172 116 154 L144 154 C180 172 202 226 202 300 Z" fill="#D6336C" />
        <path d="M117 128 L143 128 L145 160 L115 160 Z" fill={skin} />
        <ellipse cx="130" cy="101" rx="32" ry="37" fill={skin} />
        <path d="M130 63 C110 61 96 75 97 104 C101 86 112 76 130 74 Z" fill="#3A2329" />
        <path d="M130 63 C150 61 164 75 163 104 C159 86 148 76 130 74 Z" fill="#3A2329" />
        <circle cx="130" cy="88" r="3.2" fill="#D6336C" />
        <circle cx="116" cy="104" r="3" fill="#3B1F2B" />
        <circle cx="144" cy="104" r="3" fill="#3B1F2B" />
        <path d="M121 123 Q130 130 139 123" stroke="#8E3B4F" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <ellipse cx="111" cy="115" rx="7" ry="4" fill="#FBA2AB" opacity=".55" />
        <ellipse cx="149" cy="115" rx="7" ry="4" fill="#FBA2AB" opacity=".55" />
      </svg>
    </div>
  )
}
