import type { Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'

/** Scripted voice note: the "speech" Sakhi pretends to hear in Vent Mode. */
export const transcript: Record<Lang, string> = {
  hi: 'आज फिर रात को तीन बजे नींद खुल गई, पूरा शरीर पसीने से भीगा हुआ था। सुबह से थकान है, घुटनों में दर्द है, और छोटी-छोटी बातों पर गुस्सा आ रहा है। किसी को समझ ही नहीं आता कि मैं क्या झेल रही हूँ।',
  mr: 'आज पुन्हा रात्री तीन वाजता जाग आली, अंग घामानं ओलं झालं होतं. सकाळपासून खूप थकवा आहे, गुडघे दुखतायत, आणि छोट्या छोट्या गोष्टींवर चिडचिड होतेय. मी काय सहन करतेय ते कुणालाच कळत नाही.',
  gu: 'આજે ફરી રાત્રે ત્રણ વાગ્યે ઊંઘ ઊડી ગઈ, આખું શરીર પરસેવાથી ભીંજાઈ ગયું હતું. સવારથી ખૂબ થાક છે, ઘૂંટણમાં દુખાવો છે, અને નાની નાની વાતમાં ગુસ્સો આવે છે. હું શું સહન કરું છું એ કોઈને સમજાતું જ નથી.',
  en: "Aaj phir 3 baje neend khul gayi, my whole body was soaked in sweat. I've been so tired since morning, my knees hurt, and I'm snapping at small things. Nobody understands what I'm going through.",
}

export type Detected = {
  id: string
  label: StrKey
  sev: StrKey
  level: 1 | 2 | 3
  mrs: string
  domain: 'Somatic' | 'Psychological' | 'Urogenital'
  /** fraction of the transcript at which this chip appears */
  at: number
  /** placement around the orb, degrees (0 = right, clockwise) */
  angle: number
}

export const detected: Detected[] = [
  { id: 'sleep', label: 'sym_sleep', sev: 'sev_poor', level: 3, mrs: 'MRS 3', domain: 'Somatic', at: 0.18, angle: 205 },
  { id: 'hot', label: 'sym_hot', sev: 'sev_moderate', level: 2, mrs: 'MRS 1', domain: 'Somatic', at: 0.32, angle: 335 },
  { id: 'exhaust', label: 'sym_exhaust', sev: 'sev_severe', level: 3, mrs: 'MRS 7', domain: 'Psychological', at: 0.46, angle: 160 },
  { id: 'joint', label: 'sym_joint', sev: 'sev_mild', level: 1, mrs: 'MRS 11', domain: 'Somatic', at: 0.57, angle: 20 },
  { id: 'irrit', label: 'sym_irrit', sev: 'sev_moderate', level: 2, mrs: 'MRS 5', domain: 'Psychological', at: 0.76, angle: 245 },
  { id: 'mood', label: 'sym_mood', sev: 'sev_mild', level: 1, mrs: 'MRS 4', domain: 'Psychological', at: 0.95, angle: 295 },
]
