import { ChevronRight, FileHeart, Globe, LayoutDashboard, Mail, MessageCircle, Moon, PhoneCall, PlayCircle, RotateCcw, Smile, Theater } from 'lucide-react'
import { LANGS, pick, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { BottomNav } from '../components/Frame'
import { Screen, Stagger } from '../components/ui'
import { useGo } from '../components/nav'
import { Avatar } from '../illustrations/Woman'
import { MoodBlob } from '../illustrations/Blob'
import { history } from '../mock/user'
import { useLive } from '../api/session'
import { useEmbedded } from '../components/nav'
import { HistoryLive, MeLive } from './TabsLive'

export function History() {
  const live = useLive()
  const embedded = useEmbedded()
  return live && !embedded ? <HistoryLive /> : <HistoryMock />
}

function HistoryMock() {
  const { t, lang } = useI18n()
  const go = useGo()
  return (
    <Screen nav={<BottomNav active="letters" />}>
      <div className="px-5 pb-36">
        <h1 className="pb-4 pt-2 text-[27px] font-bold tracking-tight">{t('hist_title')}</h1>

        <Stagger>
          <button onClick={() => go('/letter')} className="relative w-full overflow-hidden rounded-[28px] p-5 text-left shadow-soft" style={{ background: 'linear-gradient(135deg, #FFF8F1 0%, #FFE6D6 100%)' }}>
            <svg viewBox="0 0 120 90" className="absolute -right-2 bottom-2 h-[96px] w-[128px]" aria-hidden>
              <rect x="8" y="14" width="104" height="68" rx="10" fill="#FBA2AB" />
              <path d="M8 22 L60 56 L112 22" stroke="#fff" strokeWidth="5" fill="none" strokeLinejoin="round" />
              <path d="M60 50 C52 44 48 40 48 36 C48 32 51 30 54 30 C57 30 59 32 60 34 C61 32 63 30 66 30 C69 30 72 32 72 36 C72 40 68 44 60 50Z" fill="#D6336C" />
            </svg>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[12.5px] font-semibold text-rose-pressed"><Mail size={14} /> {t('t_letter')}</span>
            <div className="mt-2 max-w-[62%] text-[20px] font-bold leading-snug">{t('hist_letter')}</div>
            <div className="mt-1 max-w-[62%] text-[14px] text-ink-soft">{t('lt_month')}</div>
          </button>
        </Stagger>

        <Stagger delay={0.05} className="mt-3">
          <button onClick={() => go('/brief')} className="glass flex w-full items-center gap-3 rounded-[24px] p-4 text-left">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: 'linear-gradient(135deg,#5361C8,#6C7BD9)' }}><FileHeart size={22} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[17px] font-semibold leading-tight">{t('t_brief')}</span>
              <span className="block text-[14px] text-ink-soft">{t('hist_brief_s')}</span>
            </span>
            <ChevronRight size={20} className="text-ink-soft" />
          </button>
        </Stagger>

        <h2 className="h-section mb-3 mt-6">{t('hist_recent')}</h2>
        <div className="flex flex-col gap-2.5">
          {history.map((h, i) => (
            <Stagger key={i} delay={0.1 + i * 0.04}>
              <button onClick={() => go(h.to)} className="glass flex w-full items-center gap-3 rounded-[22px] p-3 text-left">
                <MoodBlob mood={h.mood} size={48} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink-soft">{pick(h.when, lang)}</span>
                  <span className="block text-[16px] font-semibold leading-tight">{t(h.titleKey)}</span>
                  <span className="block truncate text-[14px] text-ink-soft">{pick(h.note, lang)}</span>
                </span>
                <ChevronRight size={18} className="text-ink-soft" />
              </button>
            </Stagger>
          ))}
        </div>
      </div>
    </Screen>
  )
}

function Row({ icon: Icon, label, sub, to, tint }: { icon: typeof Moon; label: string; sub?: string; to: string; tint: string }) {
  const go = useGo()
  return (
    <button onClick={() => go(to)} className="flex min-h-[60px] w-full items-center gap-3 px-1 py-2 text-left">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: tint }}><Icon size={19} className="text-ink" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-medium leading-tight">{label}</span>
        {sub && <span className="block text-[13px] text-ink-soft">{sub}</span>}
      </span>
      <ChevronRight size={18} className="text-ink-soft" />
    </button>
  )
}

export function Me() {
  const live = useLive()
  const embedded = useEmbedded()
  return live && !embedded ? <MeLive /> : <MeMock />
}

function MeMock() {
  const { t, lang, setLang } = useI18n()
  const tools: [typeof Moon, StrKey, string, string][] = [
    [Smile, 't_checkin', '/checkin', '#FFDFC3'],
    [Theater, 't_rehearse', '/rehearsal', '#E6D6F5'],
    [Moon, 't_3am', '/3am', '#E9DDE3'],
    [PhoneCall, 't_missed', '/missed-call', '#DDF1E6'],
    [FileHeart, 't_brief', '/brief', '#FBD0D5'],
  ]
  return (
    <Screen nav={<BottomNav active="me" />}>
      <div className="px-5 pb-36">
        <div className="glass mt-2 flex items-center gap-4 rounded-[28px] p-4">
          <Avatar size={68} />
          <div>
            <div className="text-[22px] font-bold leading-tight">{t('sunita')}, 48</div>
            <div className="text-[15px] text-ink-soft">Pune · {t('me_stage')}</div>
          </div>
        </div>

        <h2 className="h-section mb-2 mt-6 flex items-center gap-2"><Globe size={18} /> {t('me_lang')}</h2>
        <div className="grid grid-cols-4 gap-2">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} className={`min-h-[56px] rounded-2xl text-[15px] font-semibold transition ${lang === l.id ? 'bg-rose text-white shadow-soft' : 'glass text-ink'}`}>
              {l.native}
            </button>
          ))}
        </div>

        <h2 className="h-section mb-2 mt-6">{t('me_tools')}</h2>
        <div className="glass divide-y divide-white/80 rounded-[24px] px-3">
          {tools.map(([icon, k, to, tint]) => (
            <Row key={to} icon={icon} label={t(k)} to={to} tint={tint} />
          ))}
        </div>

        <h2 className="h-section mb-2 mt-6">{t('me_views')}</h2>
        <div className="glass divide-y divide-white/80 rounded-[24px] px-3">
          <Row icon={MessageCircle} label={t('me_family_view')} to="/family" tint="#D7EFE6" />
          <Row icon={LayoutDashboard} label={t('me_hr_view')} to="/hr" tint="#DCE0F7" />
          <Row icon={PlayCircle} label={t('me_demo')} to="/demo" tint="#FFDFC3" />
          <Row icon={RotateCcw} label={t('me_restart')} to="/" tint="#F3E8FB" />
        </div>
      </div>
    </Screen>
  )
}
