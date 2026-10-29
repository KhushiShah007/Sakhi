/** Pure helpers for a calmer browser voice. No browser APIs here, so they are unit-tested. */
export const CALM = { rate: 0.85, pitch: 0.9, pauseMs: 550 } as const

/** Split into sentences (Latin and Devanagari/Gujarati full stops) so a pause can sit between them. */
export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?।॥])\s+/).map((s) => s.trim()).filter(Boolean)
}

export interface VoiceLike { name: string; lang: string; localService?: boolean }
const norm = (l: string) => l.replace('_', '-').toLowerCase()

/**
 * Higher is better. Wrong-language voices are excluded (-Infinity): a Hindi sentence read by an English voice is worse than silence.
 * Prefers neural / "natural" / online voices, which sound far less robotic than the default local ones.
 */
export function scoreVoice(v: VoiceLike, want: string): number {
  const vl = norm(v.lang), wl = norm(want)
  let s: number
  if (vl === wl) s = 100
  else if (vl.split('-')[0] === wl.split('-')[0]) s = 60
  else return -Infinity
  if (/natural|neural|online|premium|enhanced|wavenet|studio/i.test(v.name)) s += 40
  if (/google/i.test(v.name)) s += 25
  else if (/microsoft/i.test(v.name)) s += 10
  else if (/siri/i.test(v.name)) s += 15
  if (/espeak|compact|robot|novelty|bad news|bells|whisper|zarvox|trinoids/i.test(v.name)) s -= 80
  return s
}

export function pickVoice<T extends VoiceLike>(voices: T[], want: string): T | undefined {
  let best: T | undefined, bestScore = -Infinity
  for (const v of voices) { const s = scoreVoice(v, want); if (s > bestScore) { best = v; bestScore = s } }
  return bestScore > -Infinity ? best : undefined
}
