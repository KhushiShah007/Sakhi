import { z } from 'zod';
import { normalise } from './redflags.js';

export const MRS_ITEMS = [
  'hot_flushes', 'heart_discomfort', 'sleep', 'joint_muscle',
  'depressive_mood', 'irritability', 'anxiety', 'exhaustion',
  'sexual', 'bladder', 'vaginal_dryness',
] as const;
export type MrsItem = (typeof MRS_ITEMS)[number];
export type MrsSubscale = 'somatic' | 'psychological' | 'urogenital';

export const MRS_SUBSCALE: Record<MrsItem, MrsSubscale> = {
  hot_flushes: 'somatic', heart_discomfort: 'somatic', sleep: 'somatic', joint_muscle: 'somatic',
  depressive_mood: 'psychological', irritability: 'psychological', anxiety: 'psychological', exhaustion: 'psychological',
  sexual: 'urogenital', bladder: 'urogenital', vaginal_dryness: 'urogenital',
};
export const MRS_SUBSCALE_MAX: Record<MrsSubscale, number> = { somatic: 16, psychological: 16, urogenital: 12 };

/** Fixed symptom vocabulary the extractor may emit. Each maps to exactly one MRS item (or none). */
export const SYMPTOMS = [
  'hot_flash', 'night_sweats', 'palpitations', 'poor_sleep', 'night_waking', 'joint_pain', 'muscle_ache',
  'low_mood', 'irritability', 'anxiety', 'fatigue', 'brain_fog', 'low_desire', 'bladder_urgency', 'vaginal_dryness', 'headache',
] as const;
export type Symptom = (typeof SYMPTOMS)[number];

export const SYMPTOM_TO_MRS: Record<Symptom, MrsItem | null> = {
  hot_flash: 'hot_flushes', night_sweats: 'hot_flushes', palpitations: 'heart_discomfort', poor_sleep: 'sleep', night_waking: 'sleep',
  joint_pain: 'joint_muscle', muscle_ache: 'joint_muscle', low_mood: 'depressive_mood', irritability: 'irritability', anxiety: 'anxiety',
  fatigue: 'exhaustion', brain_fog: 'exhaustion', low_desire: 'sexual', bladder_urgency: 'bladder', vaginal_dryness: 'vaginal_dryness', headache: null,
};

/** Deterministic keyword lexicon (en, Hinglish, hi, mr, gu). Used by the keyless extractor AND to cross-check the LLM. */
const LEXICON: Record<Symptom, RegExp[]> = {
  hot_flash: [/hot flash|hot flush|flushes|burning up|feel(ing)? hot|garmi|garmi lag|bahut garam|पसीना और गर्मी|गर्मी (लग|महसूस)|अचानक गर्मी|गरम (होत|वाटत)|उष्णता|अचानक गरम|ગરમી (લાગ|થાય)|અચાનક ગરમી|હોટ ફ્લેશ|हॉट फ्लैश/],
  night_sweats: [/night sweat|sweat(ing)? at night|raat (ko|mein) pasina|रात (को|में) पसीना|रात्री घाम|रात्री.*घाम|રાત્રે પરસેવો/],
  palpitations: [/palpitation|heart (is )?(racing|pounding)|dil (tez|zor se) dhadak|दिल (तेज़|तेज) धड़क|धड़कन (तेज़|तेज|बढ)|हृदयाचे ठोके|छातीत धडधड|ધબકારા (વધ|તેજ)|દિલ ધડક/],
  poor_sleep: [/can t sleep|cannot sleep|no sleep|poor sleep|insomnia|neend nahi|नींद नहीं|नींद (कम|खराब)|झोप (येत नाही|लागत नाही|नाही)|ઊંઘ (નથી|ના આવ)|ઉંઘ (નથી|ના આવ)/],
  night_waking: [/wake up (at )?(night|3|4)|waking (up )?at night|woke up at|raat (ko|mein) (aankh|nind) (khul|tut)|रात (को|में) (आँख|आंख|नींद) (खुल|टूट)|रात्री जाग|मध्यरात्री जाग|રાત્રે (જાગ|ઊંઘ ઉડ)/],
  joint_pain: [/joint pain|joints? (hurt|ache)|knee pain|ghutne|जोड़ों (में )?दर्द|घुटनों? (में )?दर्द|सांधेदुखी|सांधे दुख|सांध्यांत|સાંધાનો દુખાવો|સાંધામાં દુખાવો|ઘૂંટણ/],
  muscle_ache: [/muscle (pain|ache)|body ache|badan dard|बदन दर्द|शरीर (में )?दर्द|अंगदुखी|अंग दुख|स्नायू|સ્નાયુ|શરીર દુખ/],
  low_mood: [/feel(ing)? (sad|low|down|empty|hopeless)|depress|crying|udaas|उदास|रोना आ|मन नहीं लग|उदासी|दुःखी|दु:खी|उदास वाट|રડવું આવ|ઉદાસ|મન નથી લાગ/],
  irritability: [/irritat|short.?tempered|snap(ping)? at|angry|gussa|chidchid|चिड़चिड़|गुस्सा|चिडचिड|राग (येतो|येत)|ગુસ્સો|ચિડાઈ|ચીડિયા/],
  anxiety: [/anxi|panic|worried|nervous|restless|ghabra|घबराह|बेचैन|चिंता|काळजी|अस्वस्थ|भीती|ગભરાટ|ચિંતા|બેચેન/],
  fatigue: [/tired|exhaust|fatigue|no energy|drained|thak|थक|थकवा|थकान|ऊर्जा नहीं|थकल|थकावट|થાક|થાકી/],
  brain_fog: [/brain fog|can t (focus|concentrate)|forget(ting|ful)|memory|bhool|भूल (जा|ती)|ध्यान नहीं|याददाश्त|विसर|एकाग्र|ભૂલી|યાદશક્તિ|ધ્યાન નથી/],
  low_desire: [/low (desire|libido)|no desire|no interest in (sex|intimacy)|intimacy.*(less|no)|इच्छा नहीं|इच्छा कम|इच्छा राहिली नाही|ઈચ્છા નથી|ઇચ્છા નથી/],
  bladder_urgency: [/bladder|urinat|pee (often|more)|leak(ing)? urine|baar baar (peshab|toilet)|बार बार (पेशाब|टॉयलेट)|पेशाब (बार|जल्दी)|लघवी|वारंवार लघवी|વારંવાર પેશાબ|પેશાબ/],
  vaginal_dryness: [/vaginal dry|dryness down|dry down there|योनि.*(सूख|रूखे)|योनीमार्ग.*कोरड|યોનિ.*(શુષ્ક|સુકી)/],
  headache: [/headache|migraine|sar (mein )?dard|सिर (में )?दर्द|डोकेदुखी|डोके दुख|માથાનો દુખાવો|માથું દુખ/],
};

export function matchSymptoms(text: string): Symptom[] {
  const t = normalise(text);
  return SYMPTOMS.filter((s) => LEXICON[s].some((r) => r.test(t)));
}

export const severityScale = z.number().int().min(0).max(4);
export const mrsScores = z.partialRecord(z.enum(MRS_ITEMS), severityScale);
export type MrsScores = Partial<Record<MrsItem, number>>;

export type MrsBand = 'none' | 'mild' | 'moderate' | 'severe';

/** Published MRS total bands: 0-4 none/little, 5-8 mild, 9-16 moderate, 17+ severe. */
export function totalBand(total: number): MrsBand {
  if (total <= 4) return 'none';
  if (total <= 8) return 'mild';
  if (total <= 16) return 'moderate';
  return 'severe';
}

/** Published MRS subscale severity cut-offs (Heinemann et al.): upper bound of each band. */
const SUB_CUTS: Record<MrsSubscale, [number, number, number]> = { somatic: [2, 4, 8], psychological: [1, 3, 6], urogenital: [0, 1, 3] };
export function subscaleBand(sub: MrsSubscale, score: number): MrsBand {
  const [none, mild, mod] = SUB_CUTS[sub];
  return score <= none ? 'none' : score <= mild ? 'mild' : score <= mod ? 'moderate' : 'severe';
}

export interface MrsResult {
  items: Record<MrsItem, number>;
  somatic: number; psychological: number; urogenital: number; total: number; band: MrsBand;
  max: { somatic: 16; psychological: 16; urogenital: 12; total: 44 };
}

/** Score. Missing items count as 0 (not reported). Throws on out-of-range input. */
export function scoreMrs(input: MrsScores): MrsResult {
  const parsed = mrsScores.parse(input) as MrsScores;
  const items = {} as Record<MrsItem, number>;
  for (const k of MRS_ITEMS) items[k] = parsed[k] ?? 0;
  const sum = (s: MrsSubscale) => MRS_ITEMS.filter((k) => MRS_SUBSCALE[k] === s).reduce((a, k) => a + items[k], 0);
  const somatic = sum('somatic'), psychological = sum('psychological'), urogenital = sum('urogenital');
  const total = somatic + psychological + urogenital;
  return { items, somatic, psychological, urogenital, total, band: totalBand(total), max: { somatic: 16, psychological: 16, urogenital: 12, total: 44 } };
}

export interface ConfirmedLog { symptom: Symptom; severity: number; at: string; time?: string; trigger?: string }

/** Aggregate her CONFIRMED logs into MRS item scores: per item, the highest severity in the window. */
export function mrsFromLogs(logs: ConfirmedLog[]): MrsResult {
  const items: MrsScores = {};
  for (const l of logs) {
    const item = SYMPTOM_TO_MRS[l.symptom];
    if (!item) continue;
    items[item] = Math.max(items[item] ?? 0, Math.min(4, Math.max(0, Math.round(l.severity))));
  }
  return scoreMrs(items);
}
