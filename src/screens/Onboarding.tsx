import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, Flower2, HeartHandshake, Scissors, Sparkles, UserRound, UsersRound, Waves } from 'lucide-react'
import { LANGS, useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Orb, Screen, Waveform } from '../components/ui'
import { useGo, useParam } from '../components/nav'
import { Woman } from '../illustrations/Woman'

const STAGES: { id: string; t: StrKey; s: StrKey; icon: typeof Waves; tint: string }[] = [
  { id: 'peri', t: 'stage_peri', s: 'stage_peri_s', icon: Waves, tint: '#FFDFC3' },
  { id: 'meno', t: 'stage_meno', s: 'stage_meno_s', icon: Flower2, tint: '#FBD0D5' },
  { id: 'surg', t: 'stage_surg', s: 'stage_surg_s', icon: Scissors, tint: '#E6D6F5' },
  { id: 'solo', t: 'stage_solo', s: 'stage_solo_s', icon: UserRound, tint: '#DDF1E6' },
]
const PEOPLE: { id: string; name: StrKey; rel: StrKey; init: string; tint: string }[] = [
  { id: 'rajesh', name: 'rajesh', rel: 'rel_husband', init: 'R', tint: '#FFDFC3' },
  { id: 'anaya', name: 'anaya', rel: 'rel_daughter', init: 'A', tint: '#E6D6F5' },
  { id: 'meena', name: 'meena', rel: 'rel_friend', init: 'M', tint: '#BFE3D2' },
]

export default function Onboarding() {
  const { t, lang, setLang } = useI18n()
  const go = useGo()
  const q = useParam('step')
  const [step, setStep] = useState(q ? +q : 1)
  const [stage, setStageSel] = useState<string | null>(q && +q > 2 ? 'peri' : null)
  const [trust, setTrust] = useState<Record<string, boolean>>(q && +q > 3 ? { rajesh: true } : {})
  const [heard, setHeard] = useState<string | null>(null)

  // Simulated voice: after a moment Sakhi "hears" an answer and pre-selects it.
  useEffect(() => {
    setHeard(null)
    if (step > 3) return
    const id = window.setTimeout(() => {
      if (step === 1) setHeard(LANGS.find((l) => l.id === lang)!.native)
      if (step === 2) { setStageSel('peri'); setHeard(t('stage_peri')) }
      if (step === 3) { setTrust((s) => ({ ...s, rajesh: true })); setHeard(t('rajesh')) }
    }, q ? 0 : 1800)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const title: StrKey = step === 1 ? 'ob_lang' : step === 2 ? 'ob_stage' : 'ob_trust'

  if (step > 3)
    return (
      <Screen bg="wash" className="flex flex-col items-center px-6 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative mt-8 h-[330px] w-[280px] overflow-hidden rounded-t-full" style={{ background: 'linear-gradient(180deg,#FBA2AB 0%,#FFDFC3 100%)' }}>
          <Woman className="absolute bottom-0 left-1/2 h-[300px] w-[270px] -translate-x-1/2" />
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring' }} className="absolute right-6 top-16 grid h-14 w-14 place-items-center rounded-full bg-white text-rose shadow-card"><Sparkles size={26} /></motion.span>
        </motion.div>
        <h1 className="mt-8 text-[32px] font-bold">{t('ob_done')}</h1>
        <p className="mt-2 text-[18px] text-ink-soft">{t('ob_done_s')}</p>
        <button onClick={() => go('/home')} className="btn-primary mb-10 mt-auto w-full">{t('ob_go_home')}</button>
      </Screen>
    )

  return (
    <Screen bg="wash" className="flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-1">
        <button className="icon-btn" aria-label="Back" onClick={() => (step === 1 ? go('/') : setStep(step - 1))}><ChevronLeft size={24} /></button>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-ink-soft">{t('ob_step', { n: step })}</div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/70">
            <motion.div className="h-full rounded-full bg-rose" animate={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>
        <span className="rounded-full bg-white/70 px-3 py-1.5 text-[13px] font-semibold tabular-nums">0:{String(20 * step).padStart(2, '0')}</span>
      </div>

      <div className="flex flex-col items-center px-5 pt-5">
        <Orb size={104} active={!heard} />
        <div className="mt-3 h-8">
          <AnimatePresence mode="wait">
            {heard ? (
              <motion.span key="h" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-1.5 rounded-full bg-[#E3F3EA] px-3 py-1 text-[14px] font-semibold text-[#24563F]">
                <Check size={15} /> {t('ob_heard')}: “{heard}”
              </motion.span>
            ) : (
              <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[14px] text-ink-soft">
                <Waveform bars={14} height={20} /> {t('ob_hint')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <h1 className="mt-3 text-center text-[26px] font-bold leading-tight">{t(title)}</h1>
        {step === 3 && <p className="mt-1 text-center text-[16px] text-ink-soft">{t('ob_trust_sub')}</p>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="px-5 pt-5">
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {LANGS.map((l) => {
                const on = l.id === lang
                return (
                  <button key={l.id} onClick={() => { setLang(l.id as Lang); setHeard(l.native) }} className={`flex h-[108px] flex-col items-start justify-between rounded-[24px] p-4 text-left transition ${on ? 'bg-rose text-white shadow-soft' : 'glass text-ink'}`}>
                    <span className="text-[26px] font-bold leading-none">{l.native}</span>
                    <span className={`flex w-full items-center justify-between text-[14px] ${on ? 'text-white' : 'text-ink-soft'}`}>{l.label}{on && <Check size={18} />}</span>
                  </button>
                )
              })}
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-2.5">
              {STAGES.map((s) => {
                const on = stage === s.id
                const I = s.icon
                return (
                  <button key={s.id} onClick={() => setStageSel(s.id)} className={`flex items-center gap-3 rounded-[22px] p-3.5 text-left transition ${on ? 'bg-white shadow-soft ring-2 ring-rose' : 'glass'}`}>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: s.tint }}><I size={22} className="text-ink" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold leading-tight">{t(s.t)}</span>
                      <span className="block text-[14px] leading-snug text-ink-soft">{t(s.s)}</span>
                    </span>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-rose bg-rose text-white' : 'border-[#D9B9C5]'}`}>{on && <Check size={14} strokeWidth={3} />}</span>
                  </button>
                )
              })}
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-col gap-2.5">
              {PEOPLE.map((p) => {
                const on = !!trust[p.id]
                return (
                  <button key={p.id} onClick={() => setTrust((s) => ({ ...s, [p.id]: !s[p.id] }))} className={`flex items-center gap-3 rounded-[22px] p-3.5 text-left transition ${on ? 'bg-white shadow-soft ring-2 ring-rose' : 'glass'}`}>
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[18px] font-bold" style={{ background: p.tint }}>{p.init}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-semibold leading-tight">{t(p.name)}</span>
                      <span className="block text-[14px] text-ink-soft">{t(p.rel)}</span>
                    </span>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-rose bg-rose text-white' : 'border-[#D9B9C5]'}`}>{on && <Check size={14} strokeWidth={3} />}</span>
                  </button>
                )
              })}
              <div className="mt-1 flex items-center gap-2 px-2 text-[14px] text-ink-soft">
                {stage === 'solo' ? <HeartHandshake size={16} /> : <UsersRound size={16} />} {t('ob_trust_sub')}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-auto px-5 pb-8 pt-5">
        <button onClick={() => setStep(step + 1)} className="btn-primary w-full">{t('continue')}</button>
      </div>
    </Screen>
  )
}
