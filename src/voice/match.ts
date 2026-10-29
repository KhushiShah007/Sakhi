type Lang = 'hi' | 'mr' | 'gu' | 'en'

/** Maps a spoken (or typed) answer to one of a small set of options. Pure, so it is unit-tested. */
const norm = (s: string) => s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()

const LANG_WORDS: [Lang, RegExp][] = [
  ['hi', /hindi|हिंदी|हिन्दी|हिन्दि/],
  ['mr', /marathi|मराठी|मराठि/],
  ['gu', /gujarati|gujrati|ગુજરાતી|गुजराती|गुजरती/],
  ['en', /english|inglish|इंग्लिश|अंग्रेज़ी|अंग्रेजी|इंग्रजी|ઇંગ્લિશ|અંગ્રેજી/],
]
export function matchLanguage(text: string): Lang | null {
  const t = norm(text)
  return LANG_WORDS.find(([, r]) => r.test(t))?.[0] ?? null
}

export type StageId = 'perimenopause' | 'menopause' | 'surgical_early' | 'no_family'
/** Order matters: "perimenopause" contains "menopause", so it is tested first. */
const STAGE_WORDS: [StageId, RegExp][] = [
  ['no_family', /alone|akeli|no family|nobody|कोई नहीं|अकेली|अकेले|एकटी|कोणी नाही|એકલી|કોઈ નથી/],
  ['surgical_early', /surg|operation|hysterectomy|early|ऑपरेशन|सर्जरी|जल्दी|लवकर|शस्त्रक्रिया|ઓપરેશન|વહેલી/],
  ['perimenopause', /peri|irregular|पेरि|पेरी|अनियमित|अनियमीत|अनियमित|પેરિ|પેરી|અનિયમિત/],
  ['menopause', /menopause|meno|periods? (have )?stopped|मेनोपॉज़?|रजोनिवृत्ति|रजोनिवृत्ती|पीरियड.*बंद|पाळी.*बंद|મેનોપોઝ|માસિક.*બંધ/],
]
export function matchStage(text: string): StageId | null {
  const t = norm(text)
  return STAGE_WORDS.find(([, r]) => r.test(t))?.[0] ?? null
}
