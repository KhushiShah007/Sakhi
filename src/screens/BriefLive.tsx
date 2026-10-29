import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Bone, CheckSquare, Copy, Download, Dumbbell, HeartPulse, Languages, MessageCircleQuestion, Printer, ScanSearch, Share2, ShieldCheck, Send } from 'lucide-react'
import { useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, ApiError } from '../api/client'
import { Screen, TopBar } from '../components/ui'

interface Brief {
  lang: Lang; periodFrom: string; periodTo: string; checkInDays: number; lowData: boolean
  patient: { name: string; age: number; city: string | null; stageLabel: string }
  total: { score: number; max: number; band: string; bandLabel: string }
  subscales: { id: string; name: string; score: number; max: number; band: string; bandLabel: string }[]
  items: { id: string; name: string; score: number }[]
  timeline: { week: number; hotFlashDays: number; poorSleepDays: number }[]
  highlights: string[]
  ruleOut: { id: string; question: string; because: string }[]
  questions: string[]
  next20: { id: string; title: string; action: string }[]
  headings: Record<'title' | 'mrs' | 'timeline' | 'ruleOut' | 'questions' | 'next20' | 'next20Sub' | 'source' | 'footer' | 'period' | 'total', string>
}
interface Share { id: string; createdAt: string; expiresAt: string; active: boolean }
const N20_ICON: Record<string, typeof Bone> = { bone: Bone, heart: HeartPulse, strength: Dumbbell, screening: ScanSearch }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<section className="border-t border-[#F1E4E8] pt-4"><h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-rose-pressed">{title}</h3>{children}</section>)
}

/** Live Doctor-Ready Brief: scored from her confirmed logs by rules, English for the doctor, her language on request. */
export default function BriefLive() {
  const { t, lang } = useI18n()
  const [view, setView] = useState<'doctor' | 'mine'>('doctor')
  const [b, setB] = useState<Brief | null>(null)
  const [state, setState] = useState<'loading' | 'consent' | 'error' | 'ready'>('loading')
  const [shares, setShares] = useState<Share[]>([])
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [seen, setSeen] = useState(false)
  const apiLang: Lang = view === 'doctor' ? 'en' : lang

  const load = useCallback(async () => {
    try {
      setB(await api<Brief>('GET', `/api/brief?lang=${apiLang}`)); setState('ready')
      setShares((await api<{ shares: Share[] }>('GET', '/api/brief/shares')).shares)
    } catch (e) { setState(e instanceof ApiError && e.status === 403 ? 'consent' : 'error') }
  }, [apiLang])
  useEffect(() => { void load() }, [load])

  const allow = async () => { await api('POST', '/api/consents', { purpose: 'doctor_brief', granted: true }); await load() }
  const download = async () => {
    const res = await fetch('/api/brief.pdf', { credentials: 'same-origin' })
    if (!res.ok) return
    const url = URL.createObjectURL(await res.blob())
    const a = document.createElement('a'); a.href = url; a.download = 'sakhi-doctor-brief.pdf'; a.click(); URL.revokeObjectURL(url)
  }
  const share = async () => { setBusy(true); try { setLink((await api<{ link: string }>('POST', '/api/brief/share')).link); await load() } finally { setBusy(false) } }
  const stop = async (id: string) => { await api('DELETE', `/api/brief/shares/${id}`); setLink(null); await load() }
  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } catch { /* link is on screen */ } }
  const active = shares.filter((s) => s.active)

  const chrome = (children: React.ReactNode) => <Screen bg="plain" header={<TopBar title={t('t_brief')} />}>{children}</Screen>
  if (state === 'loading') return chrome(<div role="status" className="px-5 py-10 text-center text-ink-soft">{t('fl_loading')}</div>)
  if (state === 'error') return chrome(<div role="alert" className="px-5 py-10 text-center"><p>{t('fl_error')}</p><button onClick={() => void load()} className="btn-primary mt-4">{t('fl_retry')}</button></div>)
  if (state === 'consent') return chrome(<div className="px-5 pt-6"><p className="rounded-2xl bg-white p-4 text-[16px] leading-relaxed shadow-card">{t('bl_consent')}</p><button onClick={() => void allow()} className="btn-primary mt-4 w-full">{t('bl_allow')}</button></div>)
  if (!b) return null
  const H = b.headings

  return (
    <Screen bg="plain" header={<TopBar title={t('t_brief')} />}>
      <div className="px-4 pb-28">
        <div className="mb-3 flex justify-center">
          <div role="tablist" className="inline-flex gap-1 rounded-full bg-white p-1 shadow-card">
            {(['doctor', 'mine'] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={`min-h-[44px] rounded-full px-4 text-[14px] font-semibold ${view === v ? 'bg-rose text-white' : 'text-ink'}`}>{t(v === 'doctor' ? 'bl_doctor' : 'bl_mine')}</button>
            ))}
          </div>
        </div>
        {view === 'doctor' && <div className="mb-3 flex justify-center"><span className="chip bg-white"><Languages size={15} className="text-peri-deep" /> {t('br_note')}</span></div>}

        <article id="brief-article" lang={b.lang} className="flex flex-col gap-4 rounded-[26px] bg-white p-5 text-ink shadow-card">
          <header>
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-pressed">Sakhi · {H.title}</span>
            <h2 className="mt-1 text-[21px] font-bold" data-testid="brief-name">{[b.patient.name, b.patient.age || '', b.patient.city ?? ''].filter(Boolean).join(' · ')}</h2>
            <div className="text-[14px] text-ink-soft">{H.period}: {b.periodFrom} → {b.periodTo} · {b.checkInDays}</div>
            {b.patient.stageLabel && <div className="mt-1 text-[14px] leading-snug">{b.patient.stageLabel}</div>}
          </header>

          <Section title={H.mrs}>
            <div className="mb-3 flex items-end justify-between">
              <div><span className="text-[34px] font-bold leading-none" data-testid="mrs-total">{b.total.score}</span><span className="text-[15px] text-ink-soft"> / {b.total.max}</span></div>
              <span className="rounded-full bg-peach-light px-3 py-1 text-[13px] font-semibold text-rose-pressed">{b.total.bandLabel}</span>
            </div>
            <div className="flex flex-col gap-3">
              {b.subscales.map((d) => (
                <div key={d.id}>
                  <div className="flex items-baseline justify-between text-[15px]"><span className="font-semibold">{d.name}</span><span className="tabular-nums text-ink-soft">{d.score}/{d.max} · {d.bandLabel}</span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#F6E6EA]"><div className="h-full rounded-full" style={{ width: `${(d.score / d.max) * 100}%`, background: 'linear-gradient(90deg,#FEA38E,#D6336C)' }} /></div>
                </div>
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-1.5">
              {b.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-3 text-[14px]">
                  <span>{it.name}</span>
                  <span className="flex shrink-0 gap-1" role="img" aria-label={`${it.score}/4`}>{[0, 1, 2, 3].map((d) => <span key={d} className={`h-2.5 w-2.5 rounded-full ${d < it.score ? 'bg-rose' : 'bg-[#F1E4E8]'}`} />)}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title={H.timeline}>
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={b.timeline.map((w) => ({ ...w, label: `${t('bl_week')} ${w.week}` }))} barGap={3} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
                  <CartesianGrid vertical={false} stroke="#F3E6EA" />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 12 }} allowDecimals={false} domain={[0, 7]} />
                  <Tooltip cursor={{ fill: 'rgba(251,162,171,0.15)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.1)' }} />
                  <Bar dataKey="hotFlashDays" name={t('bl_hot_days')} fill="#D6336C" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="poorSleepDays" name={t('bl_sleep_days')} fill="#6C7BD9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[13px] text-ink-soft"><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose" />{t('bl_hot_days')}</span><span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-peri" />{t('bl_sleep_days')}</span></div>
            <ul className="mt-3 flex flex-col gap-1.5" data-testid="highlights">{b.highlights.map((h) => <li key={h} className="flex gap-2 text-[15px] leading-snug"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-peach" />{h}</li>)}</ul>
          </Section>

          <Section title={H.ruleOut}>
            {b.ruleOut.length === 0 ? <p className="text-[14.5px] text-ink-soft">{t('bl_no_flags')}</p> : (
              <div className="flex flex-col gap-2" data-testid="ruleout">
                {b.ruleOut.map((r) => (
                  <div key={r.id} className="flex items-start gap-2.5 rounded-2xl bg-[#FBF5F2] p-3"><CheckSquare size={18} className="mt-0.5 shrink-0 text-rose" /><div><div className="text-[15px] font-semibold">{r.question}</div><div className="text-[13.5px] leading-snug text-ink-soft">{r.because}</div></div></div>
                ))}
              </div>
            )}
          </Section>

          <Section title={H.questions}>{b.questions.map((q) => <div key={q} className="flex gap-2 py-1 text-[15px] leading-snug"><MessageCircleQuestion size={17} className="mt-0.5 shrink-0 text-peri-deep" />{q}</div>)}</Section>

          <div className="rounded-[22px] p-4 text-white" style={{ background: 'linear-gradient(135deg, #5361C8, #6C7BD9)' }}>
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/90">{H.next20}</div>
            <div className="mb-3 text-[17px] font-semibold">{H.next20Sub}</div>
            <div className="grid grid-cols-2 gap-2">
              {b.next20.map((n) => { const I = N20_ICON[n.id] ?? ScanSearch; return (<div key={n.id} className="rounded-2xl bg-white/15 p-3"><I size={18} /><div className="mt-1 text-[15px] font-semibold">{n.title}</div><div className="text-[13px] leading-snug text-white">{n.action}</div></div>) })}
            </div>
          </div>

          <footer className="flex items-start gap-2 rounded-2xl bg-[#F6EFEA] p-3 text-[13px] leading-snug text-ink-soft">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ink" />
            <span><b className="text-ink">{H.footer}</b><br />{H.source}</span>
          </footer>
        </article>

        <div className="mt-4 flex flex-col gap-3 print:hidden">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => void download()} className="btn-primary"><Download size={18} /> {t('bl_download')}</button>
            <button onClick={() => void share()} disabled={busy} className="btn-ghost bg-white disabled:opacity-60"><Share2 size={18} /> {t('bl_share')}</button>
          </div>
          {view === 'mine' && <button onClick={() => window.print()} className="btn-ghost bg-white"><Printer size={18} /> {t('bl_print')}</button>}
          {link && (
            <div className="rounded-2xl bg-white p-4 shadow-card" data-testid="share-box">
              <p className="text-[14.5px] leading-snug text-ink-soft">{t('bl_link_ready')}</p>
              <div className="mt-2 break-all rounded-xl bg-[#F6EFEA] px-3 py-2 text-[13px]" data-testid="share-link">{link}</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button onClick={() => void copy()} className="btn-ghost min-h-[48px] bg-white">{copied ? t('ob_who_copied') : <><Copy size={16} /> {t('bl_copy')}</>}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer" className="btn-primary min-h-[48px]"><Send size={16} /> {t('bl_whatsapp')}</a>
              </div>
            </div>
          )}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="text-[14px] font-semibold">{t('bl_active')}</div>
            {active.length === 0 ? <p className="mt-1 text-[14px] text-ink-soft">{t('bl_none_active')}</p> : active.map((s) => (
              <div key={s.id} className="mt-2 flex items-center justify-between gap-2 text-[14px]"><span>{new Date(s.createdAt).toLocaleDateString(`${lang}-IN`)} → {new Date(s.expiresAt).toLocaleDateString(`${lang}-IN`)}</span><button onClick={() => void stop(s.id)} className="min-h-[44px] rounded-full px-3 font-semibold text-rose-pressed">{t('bl_stop')}</button></div>
            ))}
          </div>
          <button onClick={() => { void api('POST', '/api/me/consultation').then(() => setSeen(true)) }} disabled={seen} className="btn-ghost bg-white disabled:opacity-70">{seen ? t('bl_seen_done') : t('bl_seen')}</button>
          <p className="px-1 text-[13px] leading-snug text-ink-soft">{t('bl_pending')}</p>
        </div>
      </div>
    </Screen>
  )
}

export type { StrKey }
