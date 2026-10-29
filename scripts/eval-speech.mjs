// Speech + symptom-extraction evaluation harness.  npm run eval:speech [dir]
//
// Put test items in eval/speech/<lang>/<name>.json:
//   { "reference": "what was actually said", "asr": "what the speech recogniser returned", "expected": ["hot_flash","fatigue"] }
// Target before any pilot (a HYPOTHESIS, not a result): >= 90% symptom-extraction F1 on ~20 clips each in Hindi and Marathi.
// Word error rate is computed when both "reference" and "asr" exist. Audio is not read here: run your recogniser over the clips
// (browser Web Speech, Sarvam, Whisper...) and save its output as "asr".
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { ruleBasedExtract } from '../server/src/llm/provider.ts'

const root = process.argv[2] || 'eval/speech'
const TARGET = 0.9
const edit = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length] }
const words = (s) => s.normalize('NFC').toLowerCase().replace(/[.,!?।]/g, ' ').split(/\s+/).filter(Boolean)

if (!existsSync(root)) { console.log(`No ${root} folder. Create ${root}/hi and ${root}/mr with JSON items (see the header of this file).`); process.exit(0) }
let anyReal = false
for (const lang of readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const files = readdirSync(join(root, lang)).filter((f) => f.endsWith('.json'))
  let tp = 0, fp = 0, fn = 0, werNum = 0, werDen = 0, n = 0, fixtures = 0
  for (const f of files) {
    const item = JSON.parse(readFileSync(join(root, lang, f), 'utf8'))
    if (item.fixture) fixtures++
    const text = item.asr ?? item.reference
    if (!text || !Array.isArray(item.expected)) continue
    const got = new Set(ruleBasedExtract(text).symptoms.map((s) => s.symptom)), want = new Set(item.expected)
    for (const s of got) want.has(s) ? tp++ : fp++
    for (const s of want) if (!got.has(s)) fn++
    if (item.reference && item.asr) { const r = words(item.reference); werNum += edit(r, words(item.asr)); werDen += r.length }
    n++
  }
  const p = tp / Math.max(1, tp + fp), r = tp / Math.max(1, tp + fn), f1 = p + r ? (2 * p * r) / (p + r) : 0
  const real = n - fixtures
  if (real > 0) anyReal = true
  console.log(`${lang}: ${n} items (${fixtures} demo fixtures, ${real} real)  precision ${(p * 100).toFixed(0)}%  recall ${(r * 100).toFixed(0)}%  F1 ${(f1 * 100).toFixed(0)}%` + (werDen ? `  WER ${((werNum / werDen) * 100).toFixed(0)}%` : '  WER n/a (needs reference + asr)') + `  -> ${real < 20 ? `NOT A RESULT: needs ~20 real clips (has ${real})` : f1 >= TARGET ? 'meets the 90% target' : 'BELOW the 90% target'}`)
}
if (!anyReal) console.log('\nOnly demo fixtures were scored. These prove the harness works; they say nothing about accuracy on real speech.')
