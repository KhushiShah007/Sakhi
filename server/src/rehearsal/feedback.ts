import type { Lang } from '../config.js';

export type CheckId = 'i_statement' | 'ask' | 'no_blame' | 'calm';
const P: Record<CheckId, Record<Lang, RegExp>> = {
  i_statement: {
    en: /\bI (feel|felt|am|have been|need|can ?not|can't|want|would like)\b|\bI'm\b|\bmy (sleep|body|days?)\b/i,
    hi: /मुझे|मैं|मेरा|मेरी|मेरे/, mr: /मला|मी |माझे|माझी|माझा/, gu: /મને|હું|મારું|મારી|મારો|મારા/,
  },
  ask: {
    en: /\b(could|can|would|will) you\b|\bplease\b|\bI need (you|us|some)\b|\bwhat if\b|\b(every|each|by|before|after|on) (day|week|morning|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)/i,
    hi: /कृपया|क्या आप|क्या तुम|सकते हैं|सकती हो|चाहिए|चाहती हूँ|मदद|हर (दिन|हफ़्ते|हफ्ते|सुबह|शाम)/, mr: /कृपया|तुम्ही.*शकता|तू.*शकतोस|शकाल का|हवे|पाहिजे|मदत|दर (दिवशी|आठवड्याला)/, gu: /કૃપા|તમે.*શકો|તું.*શકે|જોઈએ|મદદ|દર (દિવસે|અઠવાડિયે)/,
  },
  no_blame: {
    en: /\b(always|never|you don'?t care|you never|your fault|because of you|you should have)\b/i,
    hi: /हमेशा|कभी नहीं|तुम्हारी वजह|आपकी वजह|परवाह नहीं|तुम्हारी गलती|आपकी गलती/, mr: /नेहमी|कधीच नाही|तुझ्यामुळे|तुमच्यामुळे|काळजी नाही|तुझी चूक|तुमची चूक/, gu: /હંમેશા|ક્યારેય નહીં|તમારા કારણે|તારા કારણે|પરવા નથી|તમારી ભૂલ|તારી ભૂલ/,
  },
  calm: { en: /[A-Z]{5,}|[!?]{2,}/, hi: /[!?]{2,}/, mr: /[!?]{2,}/, gu: /[!?]{2,}/ },
};

export interface Check { id: CheckId; pass: boolean }
/** Pure, rule-based feedback on HER OWN lines in a rehearsal. It judges phrasing (I-statement, a clear ask, no blame, calm), never her feelings. */
export function evaluateRehearsal(lines: string[], lang: Lang): { checks: Check[]; tip: CheckId | 'great' } {
  const text = lines.join(' \n ');
  const norm = text.normalize('NFC');
  const checks: Check[] = [
    { id: 'i_statement', pass: P.i_statement[lang].test(norm) },
    { id: 'ask', pass: P.ask[lang].test(norm) },
    { id: 'no_blame', pass: !P.no_blame[lang].test(norm) },
    { id: 'calm', pass: !P.calm[lang].test(text) },
  ];
  const firstFail = checks.find((c) => !c.pass);
  return { checks, tip: firstFail ? firstFail.id : 'great' };
}
