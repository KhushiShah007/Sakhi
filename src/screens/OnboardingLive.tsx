import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, Copy, Flower2, Mic, Scissors, Sparkles, UserRound, Waves } from 'lucide-react'
import { LANGS, useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, type Consents } from '../api/client'
import { useSession } from '../api/session'
import { Orb, Screen, Waveform } from '../components/ui'
import AddPerson, { type Added } from '../components/AddPerson'
import { useGo } from '../components/nav'
import { Woman } from '../illustrations/Woman'
import { matchLanguage, matchStage, type StageId } from '../voice/match'
import { speak, useListen } from '../voice/speech'

const field = 'h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-4 text-[18px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose/30'
const STAGES: { id: StageId; t: StrKey; s: StrKey; icon: typeof Waves; tint: string }[] = [
  { id: 'perimenopause', t: 'stage_peri', s: 'stage_peri_s', icon: Waves, tint: '#FFDFC3' },
  { id: 'menopause', t: 'stage_meno', s: 'stage_meno_s', icon: Flower2, tint: '#FBD0D5' },
  { id: 'surgical_early', t: 'stage_surg', s: 'stage_surg_s', icon: Scissors, tint: '#E6D6F5' },
  { id: 'no_family', t: 'stage_solo', s: 'stage_solo_s', icon: UserRound, tint: '#DDF1E6' },
]

export default function OnboardingLive() {
  const { t, lang, setLang } = useI18n()
  const go = useGo()
  const { me, refresh } = useSession()
  const [step, setStep] = useState(1)
  const [name, setName] = useState(me?.name ?? '')
  const [city, setCity] = useState(me?.city ?? '')
  const [stage, setStage] = useState<StageId | null>(null)
  const [heard, setHeard] = useState<string | null>(null)
  const [canShare, setCanShare] = useState(true)
  const [added, setAdded] = useState<Added[]>([])
  const [copied, setCopied] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)
  const listener = useListen(lang)
  const spoke = useRef(-1)

  const titleKey: StrKey = step === 1 ? 'ob_lang' : step === 2 ? 'ob_stage' : 'ob_trust'

  useEffect(() => { void api<Consents>('GET', '/api/consents').then((c) => setCanShare(c.current.family_signals)).catch(() => {}) }, [])

  // the app asks the question out loud (browser voice, neutral, never cloned)
  useEffect(() => {
    if (step > 3 || spoke.current === step) return
    spoke.current = step
    speak(t(titleKey), lang)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, lang])

  const chooseLang = (l: Lang) => { setLang(l); setHeard(LANGS.find((x) => x.id === l)!.native); void api('PATCH', '/api/me', { lang: l }).catch(() => {}) }

  const onVoice = () => {
    if (listener.listening) {
      const said = listener.stop()
      if (step === 1) { const l = matchLanguage(said); if (l) chooseLang(l) }
      if (step === 2) { const s = matchStage(said); if (s) { setStage(s); setHeard(t(STAGES.find((x) => x.id === s)!.t)) } }
      listener.reset()
    } else { setHeard(null); listener.reset(); listener.start() }
  }

  const copy = async (a: Added) => {
    try { await navigator.clipboard.writeText(a.link) } catch { /* clipboard blocked: the link is also shown on screen */ }
    setCopied(a.id); window.setTimeout(() => setCopied(null), 1500)
  }

  const next = async () => {
    setErr(false)
    if (step === 1) { setBusy(true); try { await api('PATCH', '/api/me', { name: name.trim(), lang }); setStep(2) } catch { setErr(true) } finally { setBusy(false) } return }
    if (step === 2) { setBusy(true); try { await api('PATCH', '/api/me', { stage, ...(city.trim() ? { city: city.trim() } : {}) }); setStep(3) } catch { setErr(true) } finally { setBusy(false) } return }
    setBusy(true)
    try { await api('PATCH', '/api/me', { onboarded: true }); await refresh(); setStep(4) } catch { setErr(true) } finally { setBusy(false) }
  }

  const canContinue = step === 1 ? name.trim().length > 0 : step === 2 ? !!stage : true

  if (step > 3)
    return (
      <Screen bg="wash" className="flex flex-col items-center px-6 text-center">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative mt-8 h-[330px] w-[280px] overflow-hidden rounded-t-full" style={{ background: 'linear-gradient(180deg,#FBA2AB 0%,#FFDFC3 100%)' }}>
          <Woman className="absolute bottom-0 left-1/2 h-[300px] w-[270px] -translate-x-1/2" />
          <span className="absolute right-6 top-16 grid h-14 w-14 place-items-center rounded-full bg-white text-rose shadow-card"><Sparkles size={26} /></span>
        </motion.div>
        <h1 className="mt-8 text-[32px] font-bold">{t('ob_welcome', { name: name.trim() })}</h1>
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
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/70"><motion.div className="h-full rounded-full bg-rose" animate={{ width: `${(step / 3) * 100}%` }} /></div>
        </div>
      </div>

      <div className="flex flex-col items-center px-5 pt-4">
        <Orb size={92} active={listener.listening} onClick={onVoice} label={<Mic size={30} className="text-rose-pressed" aria-hidden />} />
        <div className="mt-3 min-h-8 text-center">
          {listener.listening ? (
            <div className="flex items-center justify-center gap-2 text-[14px] text-ink-soft"><Waveform bars={14} height={20} /> {listener.text || t('listening')}</div>
          ) : heard ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E3F3EA] px-3 py-1 text-[14px] font-semibold text-[#24563F]"><Check size={15} /> {t('ob_heard')}: “{heard}”</span>
          ) : (
            <span className="text-[14px] text-ink-soft">{listener.supported ? t('ob_hint') : t('ob_say_ans')}</span>
          )}
        </div>
        <h1 className="mt-2 text-center text-[24px] font-bold leading-tight">{t(titleKey)}</h1>
        {step === 3 && <p className="mt-1 text-center text-[15.5px] text-ink-soft">{t('ob_trust_sub')}</p>}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="px-5 pt-4">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {LANGS.map((l) => {
                  const on = l.id === lang
                  return (
                    <button key={l.id} onClick={() => chooseLang(l.id as Lang)} aria-pressed={on} className={`flex h-[84px] flex-col items-start justify-between rounded-[22px] p-3.5 text-left transition ${on ? 'bg-rose text-white shadow-soft' : 'glass text-ink'}`}>
                      <span className="text-[24px] font-bold leading-none">{l.native}</span>
                      <span className={`flex w-full items-center justify-between text-[13.5px] ${on ? 'text-white' : 'text-ink-soft'}`}>{l.label}{on && <Check size={17} />}</span>
                    </button>
                  )
                })}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[15px] font-semibold">{t('ob_name')}</span>
                <input className={field} value={name} maxLength={40} autoComplete="given-name" placeholder={t('ob_name_ph')} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-2.5">
              {STAGES.map((s) => {
                const on = stage === s.id
                const I = s.icon
                return (
                  <button key={s.id} onClick={() => setStage(s.id)} aria-pressed={on} className={`flex items-center gap-3 rounded-[22px] p-3 text-left transition ${on ? 'bg-white shadow-soft ring-2 ring-rose' : 'glass'}`}>
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ background: s.tint }}><I size={21} className="text-ink" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16.5px] font-semibold leading-tight">{t(s.t)}</span>
                      <span className="block text-[13.5px] leading-snug text-ink-soft">{t(s.s)}</span>
                    </span>
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-rose bg-rose text-white' : 'border-[#D9B9C5]'}`}>{on && <Check size={14} strokeWidth={3} />}</span>
                  </button>
                )
              })}
              <label className="mt-1 block">
                <span className="mb-1.5 block text-[15px] font-semibold">{t('ob_city')}</span>
                <input className={field} value={city} maxLength={60} placeholder={t('ob_city_ph')} onChange={(e) => setCity(e.target.value)} />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-3">
              {!canShare && <p className="rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[14.5px] text-[#54656F]">{t('ob_needs_consent')}</p>}
              {added.map((a) => (
                <div key={a.id} className="glass rounded-2xl p-3.5">
                  <div className="text-[16px] font-semibold">{a.name}{a.contentOnly && <span className="ml-2 text-[13px] font-normal text-ink-soft">{t('ob_who_teen')}</span>}</div>
                  <div className="mt-1 text-[13.5px] text-ink-soft">{t('ob_who_link', { name: a.name })}</div>
                  <div className="mt-1.5 break-all rounded-xl bg-white/80 px-3 py-2 text-[13px] text-ink" data-testid="person-link">{a.link}</div>
                  <button onClick={() => void copy(a)} className="btn-ghost mt-2 min-h-[44px] w-full">{copied === a.id ? <><Check size={17} /> {t('ob_who_copied')}</> : <><Copy size={17} /> {t('ob_who_copy')}</>}</button>
                </div>
              ))}
              {canShare && <AddPerson herLabel={name} onAdded={(a) => setAdded((x) => [...x, a])} onNoConsent={() => setCanShare(false)} />}
            </div>
          )}
          {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}
        </motion.div>
      </AnimatePresence>

      <div className="mt-auto px-5 pb-8 pt-5">
        <button onClick={() => void next()} disabled={!canContinue || busy} className="btn-primary w-full disabled:opacity-50">{step === 3 ? (added.length ? t('ob_finish') : t('ob_who_skip')) : t('continue')}</button>
      </div>
    </Screen>
  )
}
