import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, ShieldCheck } from 'lucide-react'
import { LANGS, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, ApiError, setCsrf, type Consents, type Purpose } from '../api/client'
import { useSession } from '../api/session'
import { Screen, Switch } from '../components/ui'
import { useGo } from '../components/nav'

/** After sign-in: consent first (nothing is saved without it), then onboarding, then home. */
export async function nextRoute(onboarded: boolean): Promise<string> {
  try {
    const c = await api<Consents>('GET', '/api/consents')
    if (!c.history.length) return '/consent'
  } catch { /* fall through */ }
  return onboarded ? '/home' : '/onboarding'
}

const field = 'h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-4 text-[18px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose/30'

export default function Login() {
  const { t, lang, setLang } = useI18n()
  const go = useGo()
  const { health, refresh, status, me } = useSession()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [year, setYear] = useState('')
  const [err, setErr] = useState<StrKey | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (status === 'authed' && me) void nextRoute(me.onboarded).then((r) => go(r))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, me])

  const normPhone = () => {
    const d = phone.replace(/[\s-]/g, '')
    if (/^\d{10}$/.test(d)) return `+91${d}`
    return /^\+\d{10,13}$/.test(d) ? d : null
  }

  const send = async () => {
    const p = normPhone()
    if (!p) return setErr('lg_bad_phone')
    setBusy(true); setErr(null)
    try { await api('POST', '/api/auth/otp/request', { phone: p }); setStep('code') }
    catch (e) {
      const s = e instanceof ApiError ? e.status : 0
      setErr(s === 429 ? 'lg_wait' : s === 503 ? 'lg_no_sms' : s === 400 ? 'lg_bad_phone' : 'fl_error')
    } finally { setBusy(false) }
  }

  const verify = async () => {
    const p = normPhone()
    if (!p) return
    setBusy(true); setErr(null)
    try {
      const r = await api<{ csrf: string }>('POST', '/api/auth/otp/verify', { phone: p, code, ...(year ? { birthYear: Number(year) } : {}), lang })
      setCsrf(r.csrf)
      await refresh()
    } catch (e) {
      const x = e instanceof ApiError ? e : null
      setErr(x?.code === 'under_18' ? 'lg_under18' : x?.code === 'birth_year_required' ? 'lg_year' : x?.status === 401 ? 'lg_bad_code' : 'fl_error')
    } finally { setBusy(false) }
  }

  return (
    <Screen bg="wash" className="flex flex-col px-6">
      <div className="flex items-center justify-between pt-2">
        <span className="flex items-center gap-2 text-[18px] font-bold tracking-tight"><img src="./favicon.svg" alt="" className="h-8 w-8" /> Sakhi</span>
        <div className="flex gap-1 rounded-full bg-white/60 p-1">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} aria-label={l.label} className={`min-h-[40px] rounded-full px-2.5 text-[13px] font-semibold ${lang === l.id ? 'bg-rose text-white' : 'text-ink'}`}>{l.native}</button>
          ))}
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-10">
        <h1 className="text-[32px] font-bold leading-tight">{t('lg_title')}</h1>
        <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{t('lg_sub')}</p>
      </motion.div>

      <form className="mt-8 flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void (step === 'phone' ? send() : verify()) }}>
        <label className="block">
          <span className="mb-1.5 block text-[15px] font-semibold">{t('lg_phone')}</span>
          <input className={field} inputMode="tel" autoComplete="tel" placeholder="98XXXXXXXX" value={phone} disabled={step === 'code'} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {step === 'code' && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold">{t('lg_code')}</span>
              <input className={`${field} tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[15px] font-semibold">{t('lg_year')}</span>
              <input className={field} inputMode="numeric" maxLength={4} placeholder="1978" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
              <span className="mt-1 block text-[13.5px] text-ink-soft">{t('lg_year_why')}</span>
            </label>
          </>
        )}
        {err && <p role="alert" className="rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t(err)}</p>}
        {health?.demoAuth && step === 'code' && <p className="rounded-2xl bg-[#FFF3C4] px-4 py-2.5 text-[14.5px] text-[#54656F]">{t('lg_demo')}</p>}
        <button type="submit" disabled={busy || (step === 'code' && code.length !== 6)} className="btn-primary mt-1 w-full disabled:opacity-50">
          {step === 'phone' ? t('lg_send') : t('continue')}
        </button>
      </form>

      <div className="mb-8 mt-auto flex items-start gap-2 pt-8 text-[14px] leading-snug text-ink-soft">
        <Lock size={16} className="mt-0.5 shrink-0" /> {t('lg_private')}
      </div>
    </Screen>
  )
}

const CHOICES: { id: Purpose; t: StrKey; s: StrKey; required?: boolean }[] = [
  { id: 'core_logging', t: 'cs_core', s: 'cs_core_s', required: true },
  { id: 'family_signals', t: 'cs_family', s: 'cs_family_s' },
  { id: 'doctor_brief', t: 'cs_brief', s: 'cs_brief_s' },
  { id: 'employer_aggregate', t: 'cs_employer', s: 'cs_employer_s' },
  { id: 'research_atlas', t: 'cs_research', s: 'cs_research_s' },
  { id: 'store_audio', t: 'cs_audio', s: 'cs_audio_s' },
]

/** Plain-language, per-purpose consent. Everything optional is off until she turns it on. */
export function Consent() {
  const { t } = useI18n()
  const go = useGo()
  const { me } = useSession()
  const [on, setOn] = useState<Record<string, boolean>>({ core_logging: true, family_signals: true, doctor_brief: true })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  const save = async () => {
    setBusy(true); setErr(false)
    try {
      for (const c of CHOICES) await api('POST', '/api/consents', { purpose: c.id, granted: c.required ? true : !!on[c.id] })
      go(me?.onboarded ? '/home' : '/onboarding')
    } catch { setErr(true) } finally { setBusy(false) }
  }

  return (
    <Screen bg="wash" className="flex flex-col px-5">
      <div className="mt-2 flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/80 text-rose-pressed"><ShieldCheck size={26} /></span>
        <div>
          <h1 className="text-[26px] font-bold leading-tight">{t('cs_title')}</h1>
        </div>
      </div>
      <p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{t('cs_sub')}</p>
      <div className="mt-4 flex flex-col gap-2.5">
        {CHOICES.map((c) => (
          <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-3.5">
            <div className="min-w-0 flex-1">
              <div className="text-[16.5px] font-semibold leading-snug">{t(c.t)}</div>
              <div className="text-[14px] leading-snug text-ink-soft">{t(c.s)}</div>
              {c.required && <div className="mt-1 text-[12.5px] font-semibold text-rose-pressed">{t('cs_required')}</div>}
            </div>
            {c.required ? <Switch on label={t(c.t)} onChange={() => {}} /> : <Switch on={!!on[c.id]} label={t(c.t)} onChange={(v) => setOn((o) => ({ ...o, [c.id]: v }))} />}
          </div>
        ))}
      </div>
      {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}
      <button onClick={() => void save()} disabled={busy} className="btn-primary mb-8 mt-5 w-full disabled:opacity-50">{t('cs_agree')}</button>
    </Screen>
  )
}
