/** Her voice choices, kept on this device only. Spoken guidance is a comfort, never a requirement, so she can turn it off. */
export type Pace = 'slower' | 'calm' | 'normal'
export interface VoicePrefs { on: boolean; pace: Pace; voice: string }
export const PACE_RATE: Record<Pace, number> = { slower: 0.7, calm: 0.8, normal: 0.95 }
const KEY = 'sakhi.voice'
const DEFAULT: VoicePrefs = { on: true, pace: 'calm', voice: '' }

export function getVoicePrefs(): VoicePrefs {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { on: p.on !== false, pace: p.pace in PACE_RATE ? p.pace : DEFAULT.pace, voice: typeof p.voice === 'string' ? p.voice : '' }
  } catch { return DEFAULT }
}
export function setVoicePrefs(p: Partial<VoicePrefs>) {
  try { localStorage.setItem(KEY, JSON.stringify({ ...getVoicePrefs(), ...p })) } catch { /* private window: applies until reload */ }
}
