import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell, Check, ChevronRight, Droplets, FileHeart, Mail, Mic, Moon, Pause, PhoneCall, Play, SkipBack, SkipForward,
  Sprout, Theater, Thermometer, Waves, Wind, ListChecks, CircleDot,
} from 'lucide-react'
import { useI18n, type Lang } from '../i18n'
import { api } from '../api/client'
import { useHome, type HomeData } from '../api/home'
import { useSession } from '../api/session'
import { speak, stopSpeaking } from '../voice/speech'
import type { StrKey } from '../i18n/strings'
import { BottomNav } from '../components/Frame'
import { Screen, Segmented, Stagger, Waveform, useToast } from '../components/ui'
import { useGo, useParam } from '../components/nav'
import { Avatar } from '../illustrations/Woman'
import { EmptyBlob, MoodBlob } from '../illustrations/Blob'
import { CoolDoodle, ForecastGlyph, SayDoodle, SunCloud, VentDoodle } from '../illustrations/art'
import { dayLetters, month, week, weatherTomorrow, MOOD_COLOR, type Mood } from '../mock/user'

type Range = 'daily' | 'weekly' | 'monthly'

function WeekStrip({ data }: { data?: HomeData | null }) {
  const { t, lang } = useI18n()
  const go = useGo()
  const [range, setRange] = useState<Range>('weekly')
  const letters = dayLetters(lang)
  const cells = data
    ? data.week.map((w) => ({ date: w.day, mood: w.mood ?? undefined, kind: w.kind }))
    : week.map((w) => ({ date: w.date, mood: w.mood, kind: w.kind as string }))
  const monthMoods: (Mood | null)[] = data ? data.month : month
  const todayMood = data ? data.week.find((w) => w.kind === 'today')?.mood ?? null : 'hot'
  return (
    <div className="glass rounded-[28px] p-4">
      <div className="mb-3 flex items-center justify-between">
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { id: 'daily', label: t('daily') },
            { id: 'weekly', label: t('weekly') },
            { id: 'monthly', label: t('monthly') },
          ]}
        />
      </div>
      <AnimatePresence mode="wait">
        {range === 'weekly' && (
          <motion.div key="w" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-7 gap-1">
            {cells.map((d, i) => {
              const today = d.kind === 'today'
              const fc = d.kind === 'forecast'
              return (
                <button
                  key={d.date}
                  onClick={() => (today ? go('/checkin') : undefined)}
                  className={`flex flex-col items-center gap-1 rounded-2xl py-2 ${today ? 'bg-white shadow-card ring-2 ring-rose' : fc ? 'border-2 border-dashed border-[#E2C6CF]' : ''}`}
                  aria-label={fc ? t('forecast') : `${letters[i]} ${d.date}`}
                >
                  <span className={`text-[13px] font-semibold ${today ? 'text-rose-pressed' : 'text-ink-soft'}`}>{letters[i]}</span>
                  {fc ? <ForecastGlyph size={34} /> : d.mood ? <MoodBlob mood={d.mood} size={36} /> : <EmptyBlob size={34} />}
                  <span className={`text-[14px] font-semibold ${today ? 'text-ink' : 'text-ink-soft'}`}>{d.date}</span>
                </button>
              )
            })}
          </motion.div>
        )}
        {range === 'daily' && (
          <motion.div key="d" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
            {todayMood ? <MoodBlob mood={todayMood} size={52} /> : <EmptyBlob size={52} />}
            <div className="min-w-0">
              <div className="font-semibold">{todayMood ? t(`mood_${todayMood}` as StrKey) : t('ci_none')}</div>
              {data ? (
                <div className="text-[14px] text-ink-soft">{data.todayTop.map((x) => t(`sy_${x.symptom}` as StrKey)).join(' · ')}</div>
              ) : (
                <div className="text-[14px] text-ink-soft">{t('sym_hot')} · {t('sym_sleep')} · {t('sym_exhaust')}</div>
              )}
            </div>
          </motion.div>
        )}
        {range === 'monthly' && (
          <motion.div key="m" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-10 gap-2 px-1">
            {monthMoods.map((m, i) => (
              <span key={i} className="aspect-square rounded-full" style={{ background: m ? MOOD_COLOR[m] : '#F1E4E8' }} title={m ?? ''} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-3 flex items-center gap-3 border-t border-white/80 pt-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#E3F3EA] text-[#2F6B4F]">
          <Sprout size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold leading-tight">{data ? (data.daysCheckedLast7 > 0 ? t(data.daysCheckedLast7 === 1 ? 'ci_day1' : 'ci_days', { n: data.daysCheckedLast7 }) : t('ci_none')) : t('checked_in')}</div>
          <div className="text-[13px] leading-snug text-ink-soft">{t('checked_in_s')}</div>
        </div>
        <button onClick={() => go('/checkin')} aria-label={t('t_checkin')} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #fff, #FCD6DC 60%, #F7B7C6)', boxShadow: '0 0 18px 4px rgba(251,162,171,.6)' }}>
          <Mic size={20} className="text-rose-pressed" />
        </button>
      </div>
    </div>
  )
}

function WeatherCard({ open: openInit = false, data, onShared }: { open?: boolean; data?: HomeData | null; onShared?: () => void }) {
  const { t } = useI18n()
  const [open, setOpen] = useState(openInit)
  const [busy, setBusy] = useState(false)
  const w = data?.weather
  const tm = w?.tomorrow ?? null
  const title = !w ? t('risk_high') : w.level === 'high' ? t('risk_high') : w.level === 'moderate' ? t('risk_moderate') : t('risk_low')
  const why = !w ? t('risk_why') : w.factors.length ? t('wx_why', { list: w.factors.map((f) => t(`wf_${f.id}` as StrKey)).join(', ') }) : t('wx_calm')
  const tell = async () => {
    setBusy(true)
    try { await api('POST', '/api/symptom-weather', { share: true }); onShared?.() } finally { setBusy(false) }
  }
  return (
    <motion.div layout className="glass relative w-full overflow-hidden rounded-[28px] p-4 text-left" style={{ background: 'linear-gradient(135deg, rgba(255,223,195,0.9), rgba(255,255,255,0.75) 60%)' }}>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)} className="block w-full text-left">
      <div className="flex items-start gap-3">
        <SunCloud className="h-[78px] w-[92px] shrink-0 floaty" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-rose-pressed">
            {t('weather')} · {t('tomorrow')}
          </div>
          <div className="mt-0.5 text-[18px] font-bold leading-snug">{title}</div>
          <div className="text-[14px] leading-snug text-ink-soft">{why}</div>
        </div>
      </div>
      {!w || tm ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip"><Thermometer size={16} className="text-rose" />{tm ? tm.tempC : weatherTomorrow.tempC}°C</span>
          <span className="chip"><Droplets size={16} className="text-peri-deep" />{t('humidity')} {tm ? tm.humidityPct : weatherTomorrow.humidity}%</span>
          {(!w || tm?.aqi != null) && <span className="chip"><Wind size={16} className="text-ink-soft" />AQI {tm ? tm.aqi : weatherTomorrow.aqi}</span>}
        </div>
      ) : (
        <p className="mt-3 text-[14.5px] leading-snug text-ink-soft">{data?.city ? t('wx_offline') : t('wx_unknown')}</p>
      )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mt-3 rounded-2xl bg-white/70 p-3">
              <div className="mb-1.5 text-[14px] font-semibold text-rose-pressed">{t('w_tips')}</div>
              {(['w_tip1', 'w_tip2'] as StrKey[]).map((k) => (
                <div key={k} className="flex items-start gap-2 py-1 text-[15px] leading-snug"><CircleDot size={18} className="mt-0.5 shrink-0 text-peach" />{t(k)}</div>
              ))}
              {(!w || w.shared) ? (
                <div className="flex items-start gap-2 py-1 text-[15px] leading-snug"><Check size={18} className="mt-0.5 shrink-0 text-[#2F6B4F]" />{t('w_tip3')}</div>
              ) : (
                <button disabled={busy} onClick={() => void tell()} className="mt-1.5 inline-flex min-h-[48px] items-center rounded-full bg-rose px-5 text-[15px] font-semibold text-white disabled:opacity-60">{t('wx_tell')}</button>
              )}
              {w && <p className="mt-2 text-[13px] leading-snug text-ink-soft">{t('wx_estimate')}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SessionCards() {
  const { t } = useI18n()
  const go = useGo()
  return (
    <div className="flex flex-col gap-3">
      <button onClick={() => go('/vent')} className="waves relative min-h-[136px] overflow-hidden rounded-[30px] p-5 text-left shadow-soft transition active:scale-[0.99]">
        <div className="relative z-10 max-w-[56%]">
          <div className="text-[26px] font-bold leading-tight text-white">{t('vent')}</div>
          <div className="mt-1 text-[15px] leading-snug text-white">{t('vent_s')}</div>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] font-medium text-white"><Mic size={14} /> 2 min</span>
        </div>
        <VentDoodle className="absolute -right-1 bottom-0 h-[128px] w-[150px]" />
      </button>
      <button onClick={() => go('/right-now')} className="relative min-h-[136px] overflow-hidden rounded-[30px] p-5 text-left shadow-soft transition active:scale-[0.99]" style={{ background: 'linear-gradient(135deg, #5361C8 0%, #5D6BCE 55%, #6C7BD9 100%)' }}>
        <div className="relative z-10 max-w-[58%]">
          <div className="text-[26px] font-bold leading-tight text-white">{t('rightnow')}</div>
          <div className="mt-1 text-[15px] leading-snug text-white">{t('rightnow_s')}</div>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-[13px] font-medium text-white"><Play size={13} fill="currentColor" /> 1:30</span>
        </div>
        <CoolDoodle className="absolute -right-2 bottom-0 h-[130px] w-[150px]" />
      </button>
      <button onClick={() => go('/translator')} className="relative flex h-[96px] items-center overflow-hidden rounded-[26px] border border-white/70 px-5 text-left shadow-card transition active:scale-[0.99]" style={{ background: 'linear-gradient(120deg, #FFDFC3 0%, #FBD0CF 100%)' }}>
        <div className="relative z-10 max-w-[64%]">
          <div className="text-[19px] font-bold leading-tight text-ink">{t('sayit')}</div>
          <div className="mt-0.5 text-[14px] leading-snug text-ink-soft">{t('sayit_s')}</div>
        </div>
        <SayDoodle className="absolute right-3 top-1/2 h-[74px] w-[100px] -translate-y-1/2" />
      </button>
    </div>
  )
}

const RELAX: StrKey[] = ['rx_1', 'rx_2', 'rx_3', 'rx_4', 'rx_5', 'rx_6']

function PlanRelax() {
  const { t, lang } = useI18n()
  const [done, setDone] = useState<Record<string, boolean>>({ plan1: true })
  const [playing, setPlaying] = useState(false)
  const [line, setLine] = useState(0)
  const run = useRef(0)
  const say = (i: number, l: Lang) => {
    const id = ++run.current
    setLine(i); setPlaying(true)
    speak(t(RELAX[i]), l, () => {
      if (id !== run.current) return
      if (i + 1 < RELAX.length) window.setTimeout(() => id === run.current && say(i + 1, l), 2500) // a pause to breathe between lines
      else { setPlaying(false); setLine(0) }
    })
  }
  const toggle = () => { if (playing) { run.current++; stopSpeaking(); setPlaying(false) } else say(line, lang) }
  const skip = (d: number) => { const n = Math.min(RELAX.length - 1, Math.max(0, line + d)); if (playing) say(n, lang); else setLine(n) }
  useEffect(() => () => { run.current++; stopSpeaking() }, [])
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="glass rounded-[26px] p-4">
        <span className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-peach-light text-rose-pressed"><ListChecks size={18} /></span>
        <div className="mb-2 text-[16px] font-semibold">{t('plan')}</div>
        <div className="flex flex-col gap-1.5">
          {(['plan1', 'plan2', 'plan3'] as StrKey[]).map((k) => (
            <button key={k} onClick={() => setDone((d) => ({ ...d, [k]: !d[k] }))} className="flex min-h-[40px] items-center gap-2 rounded-xl bg-white/70 px-2 text-left text-[14px] leading-tight">
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${done[k] ? 'border-rose bg-rose text-white' : 'border-[#D9B9C5]'}`}>{done[k] && <Check size={12} strokeWidth={3} />}</span>
              <span className={done[k] ? 'text-ink-soft line-through' : ''}>{t(k)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="glass flex flex-col rounded-[26px] p-4" style={{ background: 'linear-gradient(160deg, rgba(243,232,251,0.95), rgba(255,255,255,0.7))' }}>
        <span className="mb-2 grid h-9 w-9 place-items-center rounded-full bg-lavender text-peri-deep"><Waves size={18} /></span>
        <div className="text-[16px] font-semibold">{t('relax')}</div>
        <div className="text-[14px] text-ink-soft">{t('relax_track')} · {line + 1}/{RELAX.length}</div>
        <Waveform bars={18} active={playing} height={30} color="#6C7BD9" className="my-2" />
        <div className="mt-auto flex items-center justify-between">
          <button aria-label="Previous" onClick={() => skip(-1)} className="grid h-12 w-12 place-items-center rounded-full text-ink-soft"><SkipBack size={18} /></button>
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} className="grid h-12 w-12 place-items-center rounded-full bg-rose text-white shadow-soft">
            {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-0.5" />}
          </button>
          <button aria-label="Next" onClick={() => skip(1)} className="grid h-12 w-12 place-items-center rounded-full text-ink-soft"><SkipForward size={18} /></button>
        </div>
      </div>
    </div>
  )
}

function Milestones({ data }: { data?: HomeData | null }) {
  const { t } = useI18n()
  const m = data?.milestones
  const items: { k: StrKey; state: 'done' | 'next' }[] = [
    { k: 'ms1', state: !m || m.firstWeek ? 'done' : 'next' },
    { k: 'ms3', state: !m || m.firstSignal ? 'done' : 'next' },
    { k: 'ms2', state: m && !m.firstBrief ? 'next' : m ? 'done' : 'next' },
  ]
  const doneN = items.filter((i) => i.state === 'done').length
  return (
    <div className="glass rounded-[26px] p-4">
      <div className="mb-3 text-[16px] font-semibold">{t('milestones')}</div>
      <div className="relative mb-2 flex items-center justify-between px-6">
        <div className="absolute inset-x-8 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white" />
        <div className="absolute left-8 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blush" style={{ width: `calc((100% - 4rem) * ${Math.max(0, doneN - 1) / 2})` }} />
        {items.map((it) => (
          <span key={it.k} className={`relative z-10 grid h-9 w-9 place-items-center rounded-full ${it.state === 'done' ? 'bg-rose text-white shadow-soft' : 'border-2 border-dashed border-rose bg-white text-rose-pressed'}`}>
            {it.state === 'done' ? <Check size={18} strokeWidth={3} /> : <FileHeart size={16} />}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center text-[13px] leading-snug text-ink-soft">
        {items.map((it) => (
          <span key={it.k}>{t(it.k)}</span>
        ))}
      </div>
    </div>
  )
}

function MoreRow() {
  const { t } = useI18n()
  const go = useGo()
  const tiles: { to: string; k: StrKey; s: StrKey; icon: typeof Moon; bg: string; fg: string }[] = [
    { to: '/brief', k: 't_brief', s: 't_brief_s', icon: FileHeart, bg: '#FFDFC3', fg: '#B02458' },
    { to: '/3am', k: 't_3am', s: 't_3am_s', icon: Moon, bg: '#3B1F2B', fg: '#F3E8FB' },
    { to: '/rehearsal', k: 't_rehearse', s: 't_rehearse_s', icon: Theater, bg: '#E6D6F5', fg: '#5361C8' },
    { to: '/letter', k: 't_letter', s: 't_letter_s', icon: Mail, bg: '#FBD0D5', fg: '#B02458' },
    { to: '/missed-call', k: 't_missed', s: 't_missed_s', icon: PhoneCall, bg: '#DDF1E6', fg: '#2F6B4F' },
  ]
  return (
    <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
      {tiles.map((tile) => {
        const Icon = tile.icon
        return (
          <button key={tile.to} onClick={() => go(tile.to)} className="glass flex w-[156px] shrink-0 flex-col items-start rounded-[24px] p-3 text-left">
            <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl" style={{ background: tile.bg, color: tile.fg }}><Icon size={20} /></span>
            <span className="text-[15px] font-semibold leading-tight">{t(tile.k)}</span>
            <span className="mt-0.5 text-[13px] leading-snug text-ink-soft">{t(tile.s)}</span>
          </button>
        )
      })}
    </div>
  )
}

export default function Home({ weatherOpen }: { weatherOpen?: boolean }) {
  const { t, lang } = useI18n()
  const go = useGo()
  const toast = useToast()
  const wParam = useParam('weather')
  const wOpen = weatherOpen ?? wParam === 'open'
  const { live, data, error, reload } = useHome()
  const { me } = useSession()
  const waiting = live && !data // never show the scripted demo week to a real user while their data loads
  const hour = new Date().getHours()
  const greeting = live ? t(hour < 12 ? 'gm_morning' : hour < 17 ? 'gm_afternoon' : 'gm_evening', { name: data?.name ?? me?.name ?? '' }).replace(/,\s*$/, '') : t('greet')
  const dateLine = live ? new Intl.DateTimeFormat(`${lang}-IN`, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()) : t('today_date')
  return (
    <Screen nav={<BottomNav active="home" />}>
      <div className="px-5 pb-36">
        <Stagger className="flex items-start justify-between pb-4 pt-2">
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-ink-soft">{dateLine}</div>
            <h1 className="text-[27px] font-bold leading-tight tracking-tight">{greeting}</h1>
            <p className="mt-0.5 text-[16px] text-ink-soft">{t('greet_s')}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            {!live && (
              <button className="icon-btn relative" aria-label="Notifications" onClick={() => toast.show()}>
                <Bell size={20} />
                <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose" />
              </button>
            )}
            <button onClick={() => go('/me')} aria-label={t('nav_me')}><Avatar size={48} /></button>
          </div>
        </Stagger>

        {waiting ? (
          error ? (
            <div role="alert" className="glass rounded-[28px] p-5 text-center">
              <p className="text-[16px]">{t('fl_error')}</p>
              <button onClick={() => void reload()} className="btn-primary mt-3">{t('fl_retry')}</button>
            </div>
          ) : (
            <div role="status" aria-label="loading" className="flex flex-col gap-3">
              <div className="glass h-[212px] animate-pulse rounded-[28px]" />
              <div className="glass h-[150px] animate-pulse rounded-[28px]" />
            </div>
          )
        ) : (
          <>
            <Stagger delay={0.05}><WeekStrip data={data} /></Stagger>
            <Stagger delay={0.1} className="mt-3"><WeatherCard open={wOpen} data={data} onShared={() => void reload()} /></Stagger>
          </>
        )}

        <Stagger delay={0.15} className="mb-3 mt-6 flex items-center gap-2">
          <h2 className="h-section">{t('start_session')}</h2>
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-rose px-1.5 text-[12px] font-bold text-white">3</span>
        </Stagger>
        <Stagger delay={0.2}><SessionCards /></Stagger>

        <Stagger delay={0.25} className="mt-6"><PlanRelax /></Stagger>
        {!waiting && <Stagger delay={0.3} className="mt-3"><Milestones data={data} /></Stagger>}

        <div className="mb-3 mt-6 flex items-center justify-between">
          <h2 className="h-section">{t('more')}</h2>
          <ChevronRight size={20} className="text-ink-soft" />
        </div>
        <MoreRow />
      </div>
    </Screen>
  )
}
