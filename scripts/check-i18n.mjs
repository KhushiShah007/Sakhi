// Fails (exit 1) if any UI string is missing or empty in any of the 4 languages, or if placeholders differ between languages.
import { S } from '../src/i18n/strings.ts'
const LANGS = ['en', 'hi', 'mr', 'gu']
const ph = (s) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
let bad = 0
for (const [key, v] of Object.entries(S)) {
  for (const l of LANGS) if (typeof v[l] !== 'string' || !v[l].trim()) { console.error(`MISSING  ${key}.${l}`); bad++ }
  if (LANGS.every((l) => typeof v[l] === 'string')) {
    const base = ph(v.en)
    for (const l of LANGS.slice(1)) if (ph(v[l]) !== base) { console.error(`PLACEHOLDERS differ  ${key}.${l}: ${ph(v[l])} vs en ${base}`); bad++ }
    for (const l of ['hi', 'mr']) if (!/[ऀ-ॿ]/.test(v[l]) && /[A-Za-z]{4,}/.test(v[l].replace(/\{\w+\}|MRS|WhatsApp|PIN|PDF|HR|AQI|SAKHI|Sakhi|TSH|DEXA|PHQ-9|GAD-7/g, ''))) { console.error(`NOT TRANSLATED?  ${key}.${l}: ${v[l]}`); bad++ }
    if (!/[઀-૿]/.test(v.gu) && /[A-Za-z]{4,}/.test(v.gu.replace(/\{\w+\}|MRS|WhatsApp|PIN|PDF|HR|AQI|SAKHI|Sakhi|TSH|DEXA|PHQ-9|GAD-7/g, ''))) { console.error(`NOT TRANSLATED?  ${key}.gu: ${v.gu}`); bad++ }
  }
}
console.log(bad ? `\n${bad} problem(s) in ${Object.keys(S).length} strings` : `OK: ${Object.keys(S).length} strings x ${LANGS.length} languages, placeholders consistent`)
process.exit(bad ? 1 : 0)
