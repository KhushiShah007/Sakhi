import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react'
import { LANGS, useI18n } from '../i18n'
import { Device, PHONE_H, useViewport } from '../components/Frame'
import { EmbeddedContext } from '../components/nav'
import CheckIn from '../screens/CheckIn'
import Vent from '../screens/Vent'
import Translator from '../screens/Translator'
import Home from '../screens/Home'
import Brief from '../screens/Brief'
import FamilyChat, { type ChatUpto } from '../family/FamilyChat'

type Step = { title: string; caption: string; her: () => ReactNode; fam: ChatUpto; banner?: boolean; dur: number; focus: 'her' | 'fam' | 'both' }

const STEPS: Step[] = [
  { title: 'Morning check-in', caption: '“How are you really feeling today?” One swipe through soft faces — no forms, no streak pressure.', her: () => <CheckIn initialMood="hot" />, fam: 'intro', dur: 6, focus: 'her' },
  { title: 'Tap the orb → Vent Mode', caption: 'Sunita speaks in her own language. Symptoms and MRS items fill in live around the orb.', her: () => <Vent stage="listening" />, fam: 'intro', dur: 13, focus: 'her' },
  { title: 'Tap to correct', caption: 'Nothing is saved until she confirms. One tap changes severity or removes an item.', her: () => <Vent stage="confirm" />, fam: 'intro', dur: 6, focus: 'her' },
  { title: 'A warm reflection', caption: 'Sakhi reflects back what she is carrying — and offers to ask for help on her behalf.', her: () => <Vent stage="reflect" />, fam: 'intro', dur: 8, focus: 'her' },
  { title: 'Say it for me', caption: 'Her vent becomes one calm sentence. She picks the tone and approves it. Her words stay private.', her: () => <Translator stage="compose" />, fam: 'intro', dur: 7, focus: 'her' },
  { title: 'The Signal Card lands', caption: 'Rajesh gets a Signal Card on WhatsApp — a clear ask, never her story. No app to install.', her: () => <Translator stage="sent" />, fam: 'signal', banner: true, dur: 7, focus: 'fam' },
  { title: 'Rajesh responds', caption: 'One tap: “Done ✅”. Sunita just sees a small 💛.', her: () => <Translator stage="sent" />, fam: 'replied', dur: 5, focus: 'fam' },
  { title: 'Symptom Weather', caption: 'Hot, humid tomorrow + two short nights = high hot-flash risk. Sakhi warns her and nudges the family.', her: () => <Home weatherOpen />, fam: 'weather', dur: 8, focus: 'both' },
  { title: 'Doctor-Ready Brief', caption: 'At month end: a one-page clinical summary — MRS scores, timeline, rule-outs and a 20-year prevention plan.', her: () => <Brief />, fam: 'all', dur: 10, focus: 'her' },
]

export default function Demo() {
  const { w, h } = useViewport()
  const { lang, setLang } = useI18n()
  const params = useMemo(() => new URLSearchParams(window.location.hash.split('?')[1] ?? ''), [])
  const [i, setI] = useState(() => Math.min(STEPS.length - 1, Math.max(0, +(params.get('step') ?? 0))))
  const [auto, setAuto] = useState(params.get('auto') === '1')
  const [run, setRun] = useState(0) // bump to remount on reset

  const next = useCallback(() => setI((x) => Math.min(STEPS.length - 1, x + 1)), [])
  const prev = useCallback(() => setI((x) => Math.max(0, x - 1)), [])
  const reset = useCallback(() => { setI(0); setRun((r) => r + 1) }, [])

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (['ArrowRight', ' ', 'Enter', 'n', 'N'].includes(e.key)) { e.preventDefault(); next() }
      else if (['ArrowLeft', 'p', 'P'].includes(e.key)) prev()
      else if (e.key === 'r' || e.key === 'R') reset()
      else if (e.key === 'a' || e.key === 'A') setAuto((a) => !a)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [next, prev, reset])

  useEffect(() => {
    if (!auto || i >= STEPS.length - 1) return
    const id = window.setTimeout(next, STEPS[i].dur * 1000)
    return () => window.clearTimeout(id)
  }, [auto, i, next, run])

  const step = STEPS[i]
  const headerH = 128
  const footerH = 64
  const devH = PHONE_H + 24 + 40
  const scale = Math.min((h - headerH - footerH - 16) / devH, (w - 120) / (2 * 414 + 120), 1)
  const embedded = useMemo(() => ({ onGo: () => next() }), [next])

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden" style={{ background: 'radial-gradient(900px 500px at 25% 30%, rgba(255,255,255,.55), rgba(255,255,255,0) 70%), linear-gradient(120deg, #FFDFC3 0%, #FBCACF 48%, #E6D6F5 100%)' }}>
      <header className="flex shrink-0 items-start justify-between gap-6 px-8 pt-5" style={{ height: headerH }}>
        <div className="flex min-w-0 items-start gap-4">
          <img src="./favicon.svg" alt="" className="mt-1 h-12 w-12 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-bold uppercase tracking-[0.16em] text-rose-pressed">Sakhi · 3-minute story</span>
              <span className="rounded-full bg-white/60 px-2.5 py-0.5 text-[12px] font-semibold text-ink-soft">Prototype · simulated data</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                <h1 className="text-[30px] font-bold leading-tight tracking-tight text-ink">{i + 1}. {step.title}</h1>
                <p className="max-w-[760px] text-[17px] leading-snug text-ink-soft">{step.caption}</p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button onClick={reset} className="btn-ghost min-h-[46px] px-4 text-[15px]" title="Reset (R)"><RotateCcw size={17} /> Reset</button>
            <button onClick={() => setAuto((a) => !a)} className="btn-ghost min-h-[46px] px-4 text-[15px]" title="Auto-play (A)">{auto ? <Pause size={17} /> : <Play size={17} />} Auto</button>
            <button onClick={prev} aria-label="Previous" className="icon-btn"><ChevronLeft size={22} /></button>
            <button onClick={next} className="btn-primary min-h-[46px] px-5 text-[15px]" title="Next (→ / Space)">Next <ChevronRight size={18} /></button>
          </div>
          <div className="flex gap-1 rounded-full bg-white/60 p-1">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => { setLang(l.id); setRun((r) => r + 1) }} className={`min-h-[30px] rounded-full px-2.5 text-[12px] font-semibold ${lang === l.id ? 'bg-rose text-white' : 'text-ink'}`}>{l.native}</button>
            ))}
          </div>
        </div>
      </header>

      <EmbeddedContext.Provider value={embedded}>
        <div className="flex flex-1 items-start justify-center gap-[120px]" style={{ gap: 120 * scale }}>
          <motion.div animate={{ opacity: step.focus === 'fam' ? 0.72 : 1, scale: step.focus === 'fam' ? 0.98 : 1 }}>
            <Device scale={scale} label="Sunita’s phone · Sakhi app">
              <div key={`${run}-${i}-${lang}`} className="h-full w-full">{step.her()}</div>
            </Device>
          </motion.div>
          <motion.div animate={{ opacity: step.focus === 'her' ? 0.72 : 1, scale: step.focus === 'her' ? 0.98 : 1 }}>
            <Device scale={scale} label="Rajesh’s phone · WhatsApp">
              <FamilyChat key={`${run}-${lang}`} upto={step.fam} banner={!!step.banner} />
            </Device>
          </motion.div>
        </div>
      </EmbeddedContext.Provider>

      <footer className="flex shrink-0 items-center justify-center gap-2" style={{ height: footerH }}>
        {STEPS.map((s, k) => (
          <button key={k} onClick={() => setI(k)} title={s.title} aria-label={s.title} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-10 bg-rose' : k < i ? 'w-2.5 bg-rose/50' : 'w-2.5 bg-white'}`} />
        ))}
        <span className="ml-4 text-[13px] text-ink-soft">→ / Space: next · ←: back · R: reset · A: auto</span>
      </footer>
    </div>
  )
}
