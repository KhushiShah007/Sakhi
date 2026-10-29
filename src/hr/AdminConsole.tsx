import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Download, FlaskConical, LogOut, ShieldAlert } from 'lucide-react'
import { api, ApiError } from '../api/client'

/** Admin / science console. Staff-facing, English. Shows clinician review honestly: nothing is "reviewed" until a named person and date are recorded. */
interface Item { kind: string; key: string; title: string; liveVersion: number; versions: { version: number; status: string; clinicianReviewed: boolean; reviewer: string | null; reviewedAt: string | null }[]; review: { state: string; reviewer?: string; reviewedAt?: string } }
interface Content { items: Item[]; pending: number; total: number; note: string }
interface Pilot { suppressed: boolean; k: number; cohort: number | null; mrs: { baselineMean: number; currentMean: number; changePct: number; users: number } | null; week4ActivePct: number | null; signalAcceptancePct: number | null; huiPct: number | null; medianDaysToFirstConsult: number | null; targets: string }
const wash = { background: 'linear-gradient(160deg, #FFE7D6 0%, #FCE0E4 45%, #F1E6FA 100%)' }
const hidden = 'Hidden (under 10)'

export default function AdminConsole() {
  const [state, setState] = useState<'checking' | 'login' | 'ready' | 'disabled'>('checking')
  const [key, setKey] = useState('')
  const [err, setErr] = useState('')
  const [content, setContent] = useState<Content | null>(null)
  const [pilot, setPilot] = useState<Pilot | null>(null)
  const [tab, setTab] = useState<'content' | 'pilot'>('content')
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState({ reviewer: '', date: '' })
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try { setContent(await api<Content>('GET', '/api/admin/content')); setPilot(await api<Pilot>('GET', '/api/admin/analytics')); setState('ready') } catch { setState((s) => (s === 'disabled' ? s : 'login')) }
  }, [])
  useEffect(() => { void load() }, [load])

  const login = async () => {
    setErr('')
    try { await api('POST', '/api/admin/login', { key }); setKey(''); await load() }
    catch (e) { if (e instanceof ApiError && e.status === 503) setState('disabled'); else setErr(e instanceof ApiError && e.status === 429 ? 'Too many attempts. Wait a few minutes.' : 'That key is not valid.') }
  }
  const review = async (it: Item) => {
    setMsg('')
    try { await api('POST', '/api/admin/content/review', { kind: it.kind, key: it.key, version: it.liveVersion, reviewer: form.reviewer, reviewedAt: form.date }); setForm({ reviewer: '', date: '' }); setOpen(null); await load() }
    catch (e) { setMsg(e instanceof ApiError && (e.body as { error?: string }).error === 'review_date_in_future' ? 'A review cannot be dated in the future.' : 'Enter the reviewer’s full name and the date of the review.') }
  }

  if (state === 'checking') return <div role="status" className="grid min-h-screen place-items-center" style={wash}>Loading…</div>
  if (state === 'disabled') return <div className="grid min-h-screen place-items-center px-5 text-center" style={wash}><p className="max-w-md rounded-2xl bg-white p-6 text-[16px]">The admin console is switched off. Set <code>ADMIN_KEY</code> on the server to enable it.</p></div>
  if (state === 'login' || !content || !pilot)
    return (
      <div className="grid min-h-screen place-items-center px-5" style={wash}>
        <form className="glass-strong w-full max-w-[420px] rounded-[28px] p-7" onSubmit={(e) => { e.preventDefault(); void login() }}>
          <div className="flex items-center gap-2.5"><img src="./favicon.svg" alt="" className="h-10 w-10" /><div><div className="text-[20px] font-bold leading-tight">Sakhi admin</div><div className="text-[13px] text-ink-soft">Content review and pilot science</div></div></div>
          <label className="mt-6 block text-[14px] font-semibold" htmlFor="admin-key">Admin key</label>
          <input id="admin-key" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} className="mt-1.5 h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white px-4 text-[17px] outline-none focus:border-rose focus:ring-2 focus:ring-rose/30" />
          {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[14.5px] font-medium text-[#8A1F42]">{err}</p>}
          <button type="submit" disabled={key.trim().length < 6} className="btn-primary mt-5 w-full disabled:opacity-50">Open console</button>
        </form>
      </div>
    )

  return (
    <div className="min-h-screen w-full" style={wash}>
      <div className="mx-auto max-w-[1100px] p-4 md:p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="text-[13px] font-bold uppercase tracking-[0.14em] text-rose-pressed">Admin</div><h1 className="text-[28px] font-bold leading-tight">Content and pilot science</h1></div>
          <button onClick={() => { void api('POST', '/api/admin/logout').then(() => setState('login')) }} className="btn-ghost min-h-[48px] bg-white px-4"><LogOut size={18} /> Sign out</button>
        </header>
        <div role="tablist" className="mt-4 inline-flex gap-1 rounded-full bg-white p-1 shadow-card">
          {(['content', 'pilot'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-[44px] rounded-full px-5 text-[14.5px] font-semibold ${tab === t ? 'bg-rose text-white' : 'text-ink'}`}>{t === 'content' ? 'Content library' : 'Pilot analytics'}</button>)}
        </div>

        {tab === 'content' && (
          <section className="mt-4">
            <div className="glass-strong flex flex-wrap items-center gap-3 rounded-[22px] p-4" data-testid="review-summary">
              <ShieldAlert size={22} className="text-rose-pressed" />
              <div><div className="text-[17px] font-semibold">{content.pending} of {content.total} items are pending clinician review</div><div className="text-[13.5px] text-ink-soft">{content.note}</div></div>
            </div>
            <ul className="mt-3 flex flex-col gap-2" data-testid="content-list">
              {content.items.map((it) => {
                const id = `${it.kind}|${it.key}`
                return (
                  <li key={id} className="glass-strong rounded-[20px] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0"><div className="text-[12px] font-bold uppercase tracking-wide text-ink-soft">{it.kind.replace('_', ' ')} · v{it.liveVersion}{it.versions.length > 1 && ` · ${it.versions.length - 1} draft`}</div><div className="truncate text-[16px] font-semibold">{it.title}</div></div>
                      {it.review.state === 'reviewed'
                        ? <span className="inline-flex items-center gap-1 rounded-full bg-[#E3F3EA] px-3 py-1 text-[13px] font-semibold text-[#24563F]" data-testid="reviewed"><BadgeCheck size={15} /> Reviewed by {it.review.reviewer} on {it.review.reviewedAt}</span>
                        : <button onClick={() => { setOpen(open === id ? null : id); setMsg('') }} aria-expanded={open === id} className="inline-flex min-h-[44px] items-center rounded-full bg-[#FFF3C4] px-4 text-[13.5px] font-semibold text-[#54656F]" data-testid="pending">Pending clinician review</button>}
                    </div>
                    {open === id && (
                      <form className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]" onSubmit={(e) => { e.preventDefault(); void review(it) }}>
                        <input aria-label="Reviewer full name" placeholder="Reviewer’s full name" value={form.reviewer} onChange={(e) => setForm((f) => ({ ...f, reviewer: e.target.value }))} className="h-12 rounded-xl border border-[#E7CBD3] bg-white px-3" />
                        <input aria-label="Date of review" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-12 rounded-xl border border-[#E7CBD3] bg-white px-3" />
                        <button type="submit" className="btn-primary min-h-[48px] px-5">Record review</button>
                        {msg && <p role="alert" className="sm:col-span-3 text-[14px] font-medium text-[#8A1F42]">{msg}</p>}
                        <p className="sm:col-span-3 text-[12.5px] text-ink-soft">Only record this after a named clinician has actually reviewed this exact wording.</p>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {tab === 'pilot' && (
          <section className="mt-4">
            <div className="glass-strong rounded-[22px] p-4 text-[14px] leading-snug text-ink-soft"><FlaskConical size={18} className="mb-1 inline text-rose-pressed" /> <b className="text-ink">{pilot.targets}</b> Only people who consented to research are counted; any figure under {pilot.k} people is hidden.</div>
            {pilot.suppressed ? <p className="mt-3 rounded-2xl bg-white p-5 text-[15.5px]" data-testid="pilot-hidden">Fewer than {pilot.k} people have consented to research, so no pilot figures are shown.</p> : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="pilot">
                {[
                  ['Research cohort', pilot.cohort === null ? hidden : `about ${pilot.cohort}`],
                  ['MRS change (first 10 days vs latest 10)', pilot.mrs ? `${pilot.mrs.changePct > 0 ? '+' : ''}${pilot.mrs.changePct}% (${pilot.mrs.baselineMean} → ${pilot.mrs.currentMean}, about ${pilot.mrs.users} people)` : hidden],
                  ['Week-4 active use', pilot.week4ActivePct === null ? hidden : `${pilot.week4ActivePct}%`],
                  ['Signal Card acceptance', pilot.signalAcceptancePct === null ? hidden : `${pilot.signalAcceptancePct}%`],
                  ['Household Understanding Index', pilot.huiPct === null ? hidden : `${pilot.huiPct}`],
                  ['Median days to first consultation', pilot.medianDaysToFirstConsult === null ? hidden : `${pilot.medianDaysToFirstConsult}`],
                ].map(([l, v]) => <div key={l} className="glass-strong rounded-[20px] p-4"><div className="text-[13.5px] text-ink-soft">{l}</div><div className="mt-1 text-[20px] font-bold leading-tight">{v}</div></div>)}
              </div>
            )}
            <a href="/api/admin/atlas.csv" className="btn-primary mt-4 min-h-[48px] px-5"><Download size={18} /> Download Menopause Symptom Atlas (CSV)</a>
          </section>
        )}
      </div>
    </div>
  )
}
