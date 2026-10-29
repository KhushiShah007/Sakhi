import { useCallback, useEffect, useState } from 'react'
import { Check, ChevronRight, FileHeart, Globe, LogOut, Mail, Moon, PhoneCall, ShieldCheck, Smile, Theater } from 'lucide-react'
import { LANGS, useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api } from '../api/client'
import { useSession } from '../api/session'
import { BottomNav } from '../components/Frame'
import { Screen, Stagger } from '../components/ui'
import { useGo } from '../components/nav'
import { Avatar } from '../illustrations/Woman'
import { MoodBlob } from '../illustrations/Blob'
import type { Mood } from '../mock/user'

interface Vent { kind: 'vent'; at: string; day: string; mood: Mood | null; symptoms: string[] }
interface Sig { kind: 'signal'; id: string; at: string; card: string; person: string; status: 'new' | 'done' | 'needs_help'; helped: boolean }

/** Live Letters & Moments: the days she spoke (symptoms only) and every signal, with the "did it help?" tap that feeds the Household Understanding Index. */
export function HistoryLive() {
  const { t, lang } = useI18n()
  const go = useGo()
  const [items, setItems] = useState<(Vent | Sig)[] | null>(null)
  const [err, setErr] = useState(false)
  const load = useCallback(async () => { try { setItems((await api<{ items: (Vent | Sig)[] }>('GET', '/api/moments')).items); setErr(false) } catch { setErr(true) } }, [])
  useEffect(() => { void load() }, [load])
  const helped = async (id: string) => { await api('POST', `/api/signals/${id}/helped`); await load() }
  const when = (iso: string) => new Intl.DateTimeFormat(`${lang}-IN`, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso))

  return (
    <Screen nav={<BottomNav active="letters" />}>
      <div className="px-5 pb-36">
        <h1 className="pb-4 pt-2 text-[27px] font-bold tracking-tight">{t('hist_title')}</h1>
        <Stagger>
          <button onClick={() => go('/letter')} className="relative w-full overflow-hidden rounded-[28px] p-5 text-left shadow-soft" style={{ background: 'linear-gradient(135deg, #FFF8F1 0%, #FFE6D6 100%)' }}>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[12.5px] font-semibold text-rose-pressed"><Mail size={14} /> {t('t_letter')}</span>
            <div className="mt-2 text-[20px] font-bold leading-snug">{t('hist_letter')}</div>
            <div className="mt-1 text-[14px] text-ink-soft">{t('t_letter_s')}</div>
          </button>
        </Stagger>
        <Stagger delay={0.05} className="mt-3">
          <button onClick={() => go('/brief')} className="glass flex w-full items-center gap-3 rounded-[24px] p-4 text-left">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#5361C8,#6C7BD9)' }}><FileHeart size={22} /></span>
            <span className="min-w-0 flex-1"><span className="block text-[17px] font-semibold leading-tight">{t('t_brief')}</span><span className="block text-[14px] text-ink-soft">{t('hist_brief_s')}</span></span>
            <ChevronRight size={20} className="text-ink-soft" />
          </button>
        </Stagger>

        <h2 className="h-section mb-3 mt-6">{t('hist_recent')}</h2>
        {err && <p role="alert" className="rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')} <button className="underline" onClick={() => void load()}>{t('fl_retry')}</button></p>}
        {items?.length === 0 && <p className="glass rounded-[22px] p-4 text-[15.5px] text-ink-soft">{t('hm_empty')}</p>}
        <div className="flex flex-col gap-2.5" data-testid="moments">
          {items?.map((it) => it.kind === 'vent' ? (
            <div key={`v${it.day}`} className="glass flex items-center gap-3 rounded-[22px] p-3">
              {it.mood ? <MoodBlob mood={it.mood} size={48} /> : <MoodBlob mood="okay" size={48} faded />}
              <span className="min-w-0 flex-1"><span className="block text-[13px] text-ink-soft">{when(it.at)}</span><span className="block text-[16px] font-semibold leading-tight">{t('hm_vent')}</span><span className="block truncate text-[14px] text-ink-soft">{it.symptoms.map((s) => t(`sy_${s}` as StrKey)).join(', ')}</span></span>
            </div>
          ) : (
            <div key={it.id} className="glass rounded-[22px] p-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-peach-light text-[18px] font-bold">{it.person.slice(0, 1).toUpperCase()}</span>
                <span className="min-w-0 flex-1"><span className="block text-[13px] text-ink-soft">{when(it.at)}</span><span className="block text-[16px] font-semibold leading-tight">{t('hm_signal', { name: it.person, card: t(`tl_card_${it.card}` as StrKey) })}</span><span className="block text-[14px] text-ink-soft">{t(it.status === 'done' ? 'pv_st_done' : it.status === 'needs_help' ? 'pv_st_help' : 'pv_st_new')}</span></span>
              </div>
              {it.status === 'done' && (it.helped
                ? <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#E3F3EA] px-3 py-1.5 text-[14px] font-semibold text-[#24563F]"><Check size={15} /> {t('hm_helped_done')}</div>
                : <div className="mt-2 flex items-center gap-2"><span className="text-[14px] text-ink-soft">{t('hm_ask')}</span><button onClick={() => void helped(it.id)} className="min-h-[44px] rounded-full bg-rose px-4 text-[14.5px] font-semibold text-white">{t('hm_helped')}</button></div>)}
            </div>
          ))}
        </div>
      </div>
    </Screen>
  )
}

const STAGES: { id: string; t: StrKey }[] = [{ id: 'perimenopause', t: 'stage_peri' }, { id: 'menopause', t: 'stage_meno' }, { id: 'surgical_early', t: 'stage_surg' }, { id: 'no_family', t: 'stage_solo' }]
const field = 'h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-4 text-[18px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose/30'

function Row({ icon: Icon, label, to, tint }: { icon: typeof Moon; label: string; to: string; tint: string }) {
  const go = useGo()
  return (
    <button onClick={() => go(to)} className="flex min-h-[60px] w-full items-center gap-3 px-1 py-2 text-left">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: tint }}><Icon size={19} className="text-ink" /></span>
      <span className="min-w-0 flex-1 text-[16px] font-medium leading-tight">{label}</span>
      <ChevronRight size={18} className="text-ink-soft" />
    </button>
  )
}

/** Live Me tab: her profile (name, city, stage, language), tools, privacy, sign out. */
export function MeLive() {
  const { t, lang, setLang } = useI18n()
  const { me, refresh, logout } = useSession()
  const go = useGo()
  const [name, setName] = useState(me?.name ?? '')
  const [city, setCity] = useState(me?.city ?? '')
  const [stage, setStage] = useState(me?.stage ?? '')
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(false)
  const stageLabel = STAGES.find((s) => s.id === me?.stage)

  const save = async () => {
    setErr(false)
    try {
      await api('PATCH', '/api/me', { ...(name.trim() ? { name: name.trim() } : {}), ...(city.trim() ? { city: city.trim() } : {}), ...(stage ? { stage } : {}) })
      await refresh(); setSaved(true); window.setTimeout(() => setSaved(false), 2000)
    } catch { setErr(true) }
  }
  const chooseLang = async (l: Lang) => { setLang(l); try { await api('PATCH', '/api/me', { lang: l }) } catch { /* the choice still applies on this device */ } }

  return (
    <Screen nav={<BottomNav active="me" />}>
      <div className="px-5 pb-36">
        <div className="glass mt-2 flex items-center gap-4 rounded-[28px] p-4">
          <Avatar size={68} />
          <div className="min-w-0">
            <div className="truncate text-[22px] font-bold leading-tight">{me?.name}{me?.age ? `, ${me.age}` : ''}</div>
            <div className="text-[15px] text-ink-soft">{[me?.city, stageLabel && t(stageLabel.t)].filter(Boolean).join(' · ')}</div>
          </div>
        </div>

        <div className="glass mt-3 flex flex-col gap-3 rounded-[24px] p-4">
          <label className="block"><span className="mb-1 block text-[14px] font-semibold">{t('me_name')}</span><input className={field} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /></label>
          <label className="block"><span className="mb-1 block text-[14px] font-semibold">{t('me_city')}</span><input className={field} value={city} maxLength={60} placeholder={t('ob_city_ph')} onChange={(e) => setCity(e.target.value)} /></label>
          <div className="flex flex-wrap gap-2">
            {STAGES.map((s) => <button key={s.id} aria-pressed={stage === s.id} onClick={() => setStage(s.id)} className={`min-h-[44px] rounded-full px-4 text-[14.5px] font-semibold ${stage === s.id ? 'bg-rose text-white' : 'bg-white/70 text-ink'}`}>{t(s.t)}</button>)}
          </div>
          {err && <p role="alert" className="rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}
          <button onClick={() => void save()} className="btn-primary">{saved ? <><Check size={18} /> {t('me_saved')}</> : t('me_save')}</button>
        </div>

        <h2 className="h-section mb-2 mt-6 flex items-center gap-2"><Globe size={18} /> {t('me_lang')}</h2>
        <div className="grid grid-cols-4 gap-2">
          {LANGS.map((l) => <button key={l.id} onClick={() => void chooseLang(l.id)} aria-pressed={lang === l.id} className={`min-h-[56px] rounded-2xl text-[15px] font-semibold transition ${lang === l.id ? 'bg-rose text-white shadow-soft' : 'glass text-ink'}`}>{l.native}</button>)}
        </div>

        <h2 className="h-section mb-2 mt-6">{t('me_tools')}</h2>
        <div className="glass divide-y divide-white/80 rounded-[24px] px-3">
          <Row icon={Smile} label={t('t_checkin')} to="/checkin" tint="#FFDFC3" />
          <Row icon={Theater} label={t('t_rehearse')} to="/rehearsal" tint="#E6D6F5" />
          <Row icon={Moon} label={t('t_3am')} to="/3am" tint="#E9DDE3" />
          <Row icon={PhoneCall} label={t('t_missed')} to="/missed-call" tint="#DDF1E6" />
          <Row icon={FileHeart} label={t('t_brief')} to="/brief" tint="#FBD0D5" />
          <Row icon={ShieldCheck} label={t('me_privacy')} to="/privacy" tint="#DCE0F7" />
        </div>

        <button onClick={() => { void logout().then(() => go('/')) }} className="btn-ghost mt-6 w-full"><LogOut size={18} /> {t('me_logout')}</button>
      </div>
    </Screen>
  )
}
