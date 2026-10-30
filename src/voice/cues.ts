/** What Right Now says while she breathes. Pure, so it can be tested without a browser. */
export const ENCOURAGE = ['rn_e1', 'rn_e2', 'rn_e3', 'rn_e4'] as const
/** The full "breathe in / hold / breathe out" cue is spoken for this many seconds (two 12-second cycles); after that she knows the rhythm. */
export const FULL_CUE_SECONDS = 24
/** After that, at most one short encouraging line this often, at the start of an in-breath. */
export const ENCOURAGE_EVERY = 30

export interface CueState { lastPhase: string; lastEncAt: number; lastEnc: number; lastSpoken: string }
export const freshCueState = (): CueState => ({ lastPhase: '', lastEncAt: 0, lastEnc: -1, lastSpoken: '' })

/** Returns the string key to speak now, or null for silence. Never the same line twice in a row. Mutates `st`. */
export function nextCue(elapsed: number, phaseKey: string, st: CueState): string | null {
  const changed = phaseKey !== st.lastPhase
  st.lastPhase = phaseKey
  if (!changed) return null
  let key: string | null = null
  if (elapsed < FULL_CUE_SECONDS) key = phaseKey
  else if (phaseKey === 'rn_in' && elapsed - st.lastEncAt >= ENCOURAGE_EVERY) {
    let i = (st.lastEnc + 1) % ENCOURAGE.length
    if (ENCOURAGE[i] === st.lastSpoken) i = (i + 1) % ENCOURAGE.length
    st.lastEnc = i; st.lastEncAt = elapsed; key = ENCOURAGE[i]
  }
  if (key === st.lastSpoken) return null
  if (key) st.lastSpoken = key
  return key
}
