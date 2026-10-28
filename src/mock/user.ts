import type { Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'

export type Mood = 'calm' | 'hot' | 'tired' | 'anxious' | 'low' | 'okay'

export const MOODS: Mood[] = ['calm', 'hot', 'tired', 'anxious', 'low', 'okay']

/** Soft blob colours per mood. Faces are always drawn in Ink, so every fill is light. */
export const MOOD_COLOR: Record<Mood, string> = {
  calm: '#BFE3D2',
  hot: '#FEA38E',
  tired: '#D8C5F2',
  anxious: '#FBA2AB',
  low: '#B4BEF0',
  okay: '#FFD58A',
}

export const user = {
  name: 'Sunita',
  age: 48,
  city: 'Pune',
  stage: 'perimenopause',
  // Mock "today" is Friday 30 October 2026
  today: { weekday: 5, date: 30, month: 'Oct' },
}

const DAY_LETTERS: Record<Lang, string[]> = {
  en: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  hi: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
  mr: ['र', 'सो', 'मं', 'बु', 'गु', 'शु', 'श'],
  gu: ['ર', 'સો', 'મં', 'બુ', 'ગુ', 'શુ', 'શ'],
}
export const dayLetters = (l: Lang) => DAY_LETTERS[l]

export type DayCell = { date: number; mood?: Mood; load?: number; kind: 'past' | 'today' | 'forecast' }
export const week: DayCell[] = [
  { date: 25, mood: 'calm', load: 1, kind: 'past' },
  { date: 26, mood: 'tired', load: 3, kind: 'past' },
  { date: 27, mood: 'hot', load: 4, kind: 'past' },
  { date: 28, mood: 'okay', load: 2, kind: 'past' },
  { date: 29, mood: 'low', load: 3, kind: 'past' },
  { date: 30, mood: 'hot', load: 4, kind: 'today' },
  { date: 31, kind: 'forecast' },
]

/** Monthly view: 30 days of mood dots for the Monthly toggle. */
export const month: Mood[] = [
  'okay', 'calm', 'tired', 'tired', 'hot', 'okay', 'calm',
  'low', 'tired', 'hot', 'hot', 'okay', 'calm', 'hot',
  'hot', 'tired', 'anxious', 'okay', 'calm', 'okay', 'tired',
  'low', 'okay', 'calm', 'calm', 'tired', 'hot', 'okay', 'low', 'hot',
]

export const weatherTomorrow = { tempC: 34, humidity: 78, aqi: 162 }

export type FamilyMember = {
  id: string
  nameKey: StrKey
  relKey: StrKey
  initial: string
  tint: string
  signals: boolean
  weather: boolean
  learning: boolean
  paused?: boolean
  trusted?: boolean
  last: Record<Lang, string>
}

export const family: FamilyMember[] = [
  {
    id: 'rajesh', nameKey: 'rajesh', relKey: 'rel_husband', initial: 'R', tint: '#FFDFC3',
    signals: true, weather: true, learning: true,
    last: { en: 'Dinner tonight · replied 💛', hi: 'आज रात का खाना · जवाब 💛', mr: 'आज रात्रीचं जेवण · उत्तर 💛', gu: 'આજે રાતનું જમવાનું · જવાબ 💛' },
  },
  {
    id: 'anaya', nameKey: 'anaya', relKey: 'rel_daughter', initial: 'A', tint: '#E6D6F5',
    signals: false, weather: true, learning: true, paused: true,
    last: { en: 'Teen lesson · finished', hi: 'टीन सीख · पूरी की', mr: 'टीन धडा · पूर्ण', gu: 'ટીન પાઠ · પૂરો' },
  },
  {
    id: 'meena', nameKey: 'meena', relKey: 'rel_friend', initial: 'M', tint: '#BFE3D2',
    signals: false, weather: false, learning: false, trusted: true,
    last: { en: 'Only for hard nights', hi: 'सिर्फ़ कठिन रातों के लिए', mr: 'फक्त कठीण रात्रींसाठी', gu: 'ફક્ત કઠિન રાતો માટે' },
  },
]

export type HistoryItem = {
  when: Record<Lang, string>
  titleKey: StrKey
  mood: Mood
  note: Record<Lang, string>
  to: string
}

export const history: HistoryItem[] = [
  {
    when: { en: 'Today · 7:40 am', hi: 'आज · सुबह 7:40', mr: 'आज · सकाळी 7:40', gu: 'આજે · સવારે 7:40' },
    titleKey: 'vent', mood: 'hot', to: '/vent?stage=reflect',
    note: { en: 'Hot flashes, poor sleep', hi: 'हॉट फ़्लैश, ख़राब नींद', mr: 'हॉट फ्लॅश, अपुरी झोप', gu: 'હોટ ફ્લેશ, ખરાબ ઊંઘ' },
  },
  {
    when: { en: 'Yesterday · 3:12 am', hi: 'कल · रात 3:12', mr: 'काल · रात्री 3:12', gu: 'ગઈકાલે · રાત્રે 3:12' },
    titleKey: 't_3am', mood: 'low', to: '/3am',
    note: { en: '12 min · fell back asleep', hi: '12 मिनट · फिर नींद आ गई', mr: '12 मिनिटं · पुन्हा झोप लागली', gu: '12 મિનિટ · ફરી ઊંઘ આવી ગઈ' },
  },
  {
    when: { en: 'Wed · 6:50 pm', hi: 'बुध · शाम 6:50', mr: 'बुध · संध्या 6:50', gu: 'બુધ · સાંજે 6:50' },
    titleKey: 'rightnow', mood: 'hot', to: '/right-now',
    note: { en: 'Cooled down in 90 seconds', hi: '90 सेकंड में ठंडक', mr: '90 सेकंदांत थंडावा', gu: '90 સેકન્ડમાં ઠંડક' },
  },
  {
    when: { en: 'Tue · 8:10 am', hi: 'मंगल · सुबह 8:10', mr: 'मंगळ · सकाळी 8:10', gu: 'મંગળ · સવારે 8:10' },
    titleKey: 't_rehearse', mood: 'okay', to: '/rehearsal?s=doctor',
    note: { en: 'Practised: talking to the doctor', hi: 'अभ्यास: डॉक्टर से बात', mr: 'सराव: डॉक्टरांशी बोलणं', gu: 'અભ્યાસ: ડૉક્ટર સાથે વાત' },
  },
  {
    when: { en: 'Mon · 9:30 pm', hi: 'सोम · रात 9:30', mr: 'सोम · रात्री 9:30', gu: 'સોમ · રાત્રે 9:30' },
    titleKey: 'sayit', mood: 'tired', to: '/family',
    note: { en: 'Signal to Rajesh · he replied 💛', hi: 'राजेश को संकेत · जवाब आया 💛', mr: 'राजेशला संकेत · उत्तर आलं 💛', gu: 'રાજેશને સંકેત · જવાબ આવ્યો 💛' },
  },
]
