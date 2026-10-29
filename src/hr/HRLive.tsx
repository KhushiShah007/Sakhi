import { useCallback, useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Download, EyeOff, Handshake, LifeBuoy, LogOut, ShieldCheck, TrendingUp, Users } from 'lucide-react'
import { api, ApiError } from '../api/client'

/** Sakhi for Workplaces. HR-facing, English. Every number here comes from the k >= 10 query layer; hidden cells are shown as hidden, never estimated. */
interface Summary {
  suppressed: boolean; k: number; employer: string; eligible: number
  participants: number | null; participationPct: number | null; checkInsPerWeek: number | null; wellbeingIndex: number | null
  themes: { id: string; label: string; pct: number | null; hidden: boolean }[]
  locations: { name: string; participants: number | null; wellbeingIndex: number | null; hidden: boolean }[]
  otherLocations: number | null; flexiSupported: number; resources: { title: string; status: string }[]; note: string
}
const tooltip = { borderRadius: 14, border: 'none', boxShadow: '0 8px 24px rgba(59,31,43,.12)', fontFamily: 'Poppins', fontSize: 13 }
const wash = { background: 'linear-gradient(160deg, #FFE7D6 0%, #FCE0E4 45%, #F1E6FA 100%)' }

function Kpi({ icon: Icon, label, value, sub, tint, testid }: { icon: typeof Users; label: string; value: string; sub: string; tint: string; testid: string }) {
  return (
    <div className="glass-strong rounded-[24px] p-5">
      <div className="flex items-center justify-between"><span className="text-[14px] font-medium text-ink-soft">{label}</span><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: tint }}><Icon size={19} className="text-ink" /></span></div>
      <div className="mt-2 text-[32px] font-bold leading-none tracking-tight" data-testid={testid}>{value}</div>
      <div className="mt-2 text-[13.5px] text-ink-soft">{sub}</div>
    </div>
  )
}

export default function HRLive() {
  const [s, setS] = useState<Summary | null>(null)
  const [code, setCode] = useState('')
  const [state, setState] = useState<'checking' | 'login' | 'ready'>('checking')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    try { setS(await api<Summary>('GET', '/api/hr/summary')); setState('ready') } catch { setState('login') }
  }, [])
  useEffect(() => { void load() }, [load])

  const login = async () => {
    setErr('')
    try { await api('POST', '/api/hr/login', { code }); setCode(''); await load() }
    catch (e) { setErr(e instanceof ApiError && e.status === 429 ? 'Too many attempts. Please wait a few minutes.' : 'That access code is not valid.') }
  }
  const out = async () => { await api('POST', '/api/hr/logout'); setS(null); setState('login') }

  if (state === 'checking') return <div role="status" className="grid min-h-screen place-items-center" style={wash}>Loading…</div>
  if (state === 'login' || !s)
    return (
      <div className="grid min-h-screen place-items-center px-5" style={wash}>
        <form className="glass-strong w-full max-w-[420px] rounded-[28px] p-7" onSubmit={(e) => { e.preventDefault(); void login() }}>
          <div className="flex items-center gap-2.5"><img src="./favicon.svg" alt="" className="h-10 w-10" /><div><div className="text-[20px] font-bold leading-tight">Sakhi for Workplaces</div><div className="text-[13px] text-ink-soft">Aggregates only. Never individuals.</div></div></div>
          <label className="mt-6 block text-[14px] font-semibold" htmlFor="hr-code">HR access code</label>
          <input id="hr-code" type="password" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} className="mt-1.5 h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white px-4 text-[17px] outline-none focus:border-rose focus:ring-2 focus:ring-rose/30" />
          {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[14.5px] font-medium text-[#8A1F42]">{err}</p>}
          <button type="submit" disabled={code.trim().length < 6} className="btn-primary mt-5 w-full disabled:opacity-50">Open dashboard</button>
        </form>
      </div>
    )

  const shownThemes = s.themes.filter((t) => !t.hidden)
  const unavailable = 'Hidden: fewer than 10 people'
  return (
    <div className="min-h-screen w-full" style={wash}>
      <div className="mx-auto max-w-[1180px] p-4 md:p-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-rose-pressed">Menopause support programme</div>
            <h1 className="mt-1 text-[30px] font-bold leading-tight tracking-tight">{s.employer}</h1>
            <p className="mt-1 max-w-[560px] text-[15px] text-ink-soft">Anonymous totals for people who chose to opt in. Counts are rounded, and any group under {s.k} people is hidden.</p>
          </div>
          <div className="flex gap-2">
            <a href="/api/hr/report.csv" className="btn-primary min-h-[48px] px-5"><Download size={18} /> Export report</a>
            <button onClick={() => void out()} className="btn-ghost min-h-[48px] bg-white px-4"><LogOut size={18} /> Sign out</button>
          </div>
        </header>

        {s.suppressed && (
          <div role="status" className="glass-strong mt-6 rounded-[24px] p-6" data-testid="suppressed">
            <div className="flex items-center gap-2 text-[18px] font-semibold"><EyeOff size={20} /> Not enough people to show anything yet</div>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">Fewer than {s.k} employees have opted in. To protect privacy, Sakhi shows no numbers at all until at least {s.k} people take part. This is enforced by the system, not by this page.</p>
          </div>
        )}

        {!s.suppressed && (
          <>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi testid="kpi-participation" icon={Users} label="Participation" value={`${s.participationPct}%`} sub={`about ${s.participants} of ${s.eligible} eligible`} tint="#FFDFC3" />
              <Kpi testid="kpi-checkins" icon={CalendarDays} label="Check-ins per week" value={String(s.checkInsPerWeek)} sub="per participating person" tint="#E6D6F5" />
              <Kpi testid="kpi-flexi" icon={Handshake} label="Flexi requests supported" value={String(s.flexiSupported)} sub="entered by HR, not from employees" tint="#BFE3D2" />
              <Kpi testid="kpi-wellbeing" icon={TrendingUp} label="Wellbeing index" value={s.wellbeingIndex === null ? 'Hidden' : String(s.wellbeingIndex)} sub={s.wellbeingIndex === null ? unavailable : 'indicative, rounded to 5. Not clinical'} tint="#FBD0D5" />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <section className="glass-strong rounded-[24px] p-5">
                <h2 className="text-[17px] font-semibold">What people are talking about</h2>
                <p className="text-[13.5px] text-ink-soft">Share of participants who mentioned each theme this month</p>
                {shownThemes.length === 0 ? <p className="mt-4 text-[15px] text-ink-soft" data-testid="themes-hidden">{unavailable}</p> : (
                  <div className="mt-3 h-[260px]" data-testid="themes">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={shownThemes} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid horizontal={false} stroke="#F3E6EA" />
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: '#6B4A57' }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 13, fill: '#3B1F2B' }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v) => `${v}%`} contentStyle={tooltip} />
                        <Bar dataKey="pct" radius={[0, 8, 8, 0]}>{shownThemes.map((t) => <Cell key={t.id} fill="#D6336C" />)}</Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {s.themes.some((t) => t.hidden) && <p className="mt-2 text-[13px] text-ink-soft">Themes mentioned by fewer than {s.k} people are not shown.</p>}
              </section>

              <section className="glass-strong rounded-[24px] p-5">
                <h2 className="text-[17px] font-semibold">By location</h2>
                <p className="text-[13.5px] text-ink-soft">Small sites are hidden so no one can be picked out</p>
                <ul className="mt-3 flex flex-col gap-2" data-testid="locations">
                  {s.locations.map((l) => (
                    <li key={l.name} className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-[15px]">
                      <span className="font-medium">{l.name}</span>
                      {l.hidden ? <span className="flex items-center gap-1.5 text-[13.5px] text-ink-soft" data-testid="loc-hidden"><EyeOff size={15} /> {unavailable}</span>
                        : <span className="tabular-nums text-ink-soft">about {l.participants}{l.wellbeingIndex !== null && ` · wellbeing ${l.wellbeingIndex}`}</span>}
                    </li>
                  ))}
                  {s.otherLocations !== null && <li className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 text-[15px]"><span className="font-medium">Other sites (combined)</span><span className="tabular-nums text-ink-soft">about {s.otherLocations}</span></li>}
                </ul>
              </section>
            </div>
          </>
        )}

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="glass-strong rounded-[24px] p-5">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold"><LifeBuoy size={18} /> Support resources</h2>
            <ul className="mt-3 flex flex-col gap-2">{s.resources.map((r) => <li key={r.title} className="flex items-center justify-between gap-3 rounded-2xl bg-white/70 px-4 py-3 text-[15px]"><span>{r.title}</span><span className="shrink-0 rounded-full bg-[#E3F3EA] px-2.5 py-1 text-[12.5px] font-semibold text-[#24563F]">{r.status}</span></li>)}</ul>
          </section>
          <section className="glass-strong rounded-[24px] p-5">
            <h2 className="flex items-center gap-2 text-[17px] font-semibold"><ShieldCheck size={18} /> How privacy works</h2>
            <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-[14.5px] leading-snug text-ink-soft">
              <li>Employees opt in themselves, and can leave or withdraw consent at any time. They disappear from the totals immediately.</li>
              <li>You never see names, individual check-ins, or anything an employee said.</li>
              <li>Fewer than {s.k} people in any group means that group is hidden, and a hidden group cannot be worked out by subtraction.</li>
              <li>Counts and percentages are rounded to the nearest 5 so one person joining or leaving does not move a number.</li>
              <li>{s.note}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
