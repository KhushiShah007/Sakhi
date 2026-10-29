import type { Symptom } from './mrs.js';

export type Mood = 'calm' | 'hot' | 'tired' | 'anxious' | 'low' | 'okay';

/** Which mood blob a symptom pulls towards. Unmapped symptoms (pain, bladder, ...) pull towards "okay-ish". */
const PULL: Record<Symptom, Mood> = {
  hot_flash: 'hot', night_sweats: 'hot',
  palpitations: 'anxious', anxiety: 'anxious', irritability: 'anxious',
  poor_sleep: 'tired', night_waking: 'tired', fatigue: 'tired', brain_fog: 'tired',
  low_mood: 'low', low_desire: 'low',
  joint_pain: 'okay', muscle_ache: 'okay', headache: 'okay', bladder_urgency: 'okay', vaginal_dryness: 'okay',
};
const TIE_ORDER: Mood[] = ['hot', 'anxious', 'low', 'tired', 'okay'];

export interface DayLog { symptom: Symptom; severity: number }

/**
 * A day's blob. No logs = no blob (she did not check in; that is not "calm").
 * Light days (total load <= 2) are calm; otherwise the heaviest group wins.
 */
export function moodForDay(logs: DayLog[]): { mood: Mood | null; load: number } {
  if (!logs.length) return { mood: null, load: 0 };
  const load = logs.reduce((a, l) => a + Math.max(0, Math.min(4, l.severity)), 0);
  if (load <= 2) return { mood: 'calm', load };
  const score = new Map<Mood, number>();
  for (const l of logs) score.set(PULL[l.symptom], (score.get(PULL[l.symptom]) ?? 0) + Math.max(0, l.severity));
  const best = [...score.entries()].sort((a, b) => b[1] - a[1] || TIE_ORDER.indexOf(a[0]) - TIE_ORDER.indexOf(b[0]))[0][0];
  return { mood: best, load };
}
