import { z } from 'zod';
import type { Lang } from '../config.js';
import { SYMPTOMS } from './mrs.js';
import { normalise } from './redflags.js';

/** The ONLY shape the extractor may return. Anything else is rejected, never repaired. */
export const extractionSchema = z.object({
  intent: z.enum(['vent', 'checkin', 'ask_help', 'question', 'other']),
  symptoms: z.array(z.object({
    symptom: z.enum(SYMPTOMS),
    severity: z.number().int().min(0).max(4),
    time: z.enum(['morning', 'afternoon', 'evening', 'night', 'unspecified']).default('unspecified'),
    trigger: z.enum(['stress', 'heat', 'food', 'sleep', 'family', 'work', 'none', 'unspecified']).default('unspecified'),
  }).strict()).max(12),
}).strict();
export type Extraction = z.infer<typeof extractionSchema>;

/** Output blocklist: things the assistant must never say. Applied to every LLM string before display. */
const BLOCK: RegExp[] = [
  /\b\d+(\.\d+)?\s?(mg|mcg|µg|ug|ml|iu|tablets?|pills?|capsules?)\b/,
  /\b(take|start|use|try|increase|decrease|stop|skip)\b.{0,40}\b(hrt|hormone therapy|estrogen|oestrogen|progesterone|tibolone|antidepressant|ssri|paroxetine|fluoxetine|gabapentin|clonidine|medicine|medication|tablet|pill)\b/,
  /\byou (definitely |probably |likely |clearly )?(have|are suffering from|suffer from|got) (menopause|perimenopause|cancer|thyroid|hypothyroidism|diabetes|depression|an? (infection|tumou?r|disorder|disease))/,
  /\b(i|we) (diagnose|prescribe)\b/, /\bthis (is|means you have|confirms)\b.{0,30}\b(cancer|thyroid|diabetes|depression|disease)\b/,
  /\bguarantee(d)?\b/, /\b(cure|cures|cured)\b/, /\b100 ?%\b.{0,20}\b(safe|effective|accurate|sure)\b/, /\bclinically proven\b/, /\bmedical device\b.{0,20}\b(approved|certified)\b/,
  /\bsystem prompt\b/, /\bas an ai language model\b/,
  /\b(your|her) (husband|family|in-?laws?) (will|can|may) (read|see) (your|her) (words|vent|transcript)/,
  /(हार्मोन थेरेपी|एचआरटी|इस्ट्रोजन|एस्ट्रोजन)\s*(ले|लें|लीजिए|शुरू|घेऊ|घ्या|सुरू|લો|શરૂ)/,
  /आपको (थायरॉइड|कैंसर|डिप्रेशन|मेनोपॉज़|मधुमेह|डायबिटीज) (है|हो गया)/, /तुम्हाला (थायरॉईड|कर्करोग|डिप्रेशन|मधुमेह) (आहे|झाला)/, /તમને (થાઇરોઇડ|કેન્સર|ડિપ્રેશન|ડાયાબિટીસ) (છે|થયું)/,
  /\d+\s?(एमजी|मिलीग्राम|मिग्रॅ|મિલિગ્રામ|એમજી)/,
];

export function violatesOutputPolicy(text: string): boolean {
  const t = normalise(text);
  return text.length > 1500 || BLOCK.some((r) => r.test(t) || r.test(text.toLowerCase()));
}

const SAFE_FALLBACK: Record<Lang, string> = {
  hi: 'मैं आपकी बात सुन रही हूँ। जो आपने बताया वो मायने रखता है। इसे अपने डॉक्टर से साझा करना अच्छा रहेगा।',
  mr: 'मी तुमचे ऐकत आहे. तुम्ही जे सांगितले ते महत्त्वाचे आहे. हे तुमच्या डॉक्टरांशी बोलण्यासारखे असू शकते.',
  gu: 'હું તમારી વાત સાંભળું છું. તમે જે કહ્યું તે મહત્વનું છે. આ તમારા ડૉક્ટર સાથે ચર્ચા કરવા જેવું હોઈ શકે છે.',
  en: 'I hear you, and what you said matters. It may be worth discussing with your doctor.',
};

/** Returns the text if safe, otherwise a pre-written safe reply. */
export function sanitiseOutput(text: string, lang: Lang): { text: string; blocked: boolean } {
  return violatesOutputPolicy(text) ? { text: SAFE_FALLBACK[lang], blocked: true } : { text, blocked: false };
}
