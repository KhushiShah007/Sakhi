import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import { BookOpen, CalendarDays, Download, EyeOff, LayoutDashboard, LineChart, LifeBuoy, ShieldCheck, Sparkles, TrendingUp, Users, Clock3, Handshake } from 'lucide-react'
import { ToastProvider, useToast } from '../components/ui'
import { useGo } from '../components/nav'
import { hr } from '../mock/clinical'
import { useSession } from '../api/session'
import { useEmbedded } from '../components/nav'
import HRLive from './HRLive'

const pct = Math.round((hr.participating / hr.eligible) * 100)
const tooltipStyle = { borderRadius: 14, border: 'none', boxShadow: '0 8px 24px rgba(59,31,43,.12)', fontFamily: 'Poppins', fontSize: 13 }

function Kpi({ icon: Icon, label, value, sub, tint, bar }: { icon: typeof Users; label: string; value: string; sub: string; tint: string; bar?: number }) {
  return (
    <div className="glass-strong rounded-[24px] p-5">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-ink-soft">{label}</span>
        <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: tint }}><Icon size={19} className="text-ink" /></span>
      </div>
      <div className="mt-2 text-[32px] font-bold leading-none tracking-tight">{value}</div>
      <div className="mt-2 text-[13.5px] text-ink-soft">{sub}</div>
      {bar !== undefined && (
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F6E6EA]">
          <div className="h-full rounded-full" style={{ width: `${bar}%`, background: 'linear-gradient(90deg,#FEA38E,#D6336C)' }} />
        </div>
      )}
    </div>
  )
}

function Body() {
  const toast = useToast()
  const go = useGo()
  return (
    <div className="min-h-screen w-full" style={{ background: 'linear-gradient(160deg, #FFE7D6 0%, #FCE0E4 45%, #F1E6FA 100%)' }}>
      <div className="mx-auto flex max-w-[1440px] gap-6 p-4 md:p-6">
        {/* sidebar */}
        <aside className="glass-strong sticky top-6 hidden h-[calc(100vh-48px)] w-[240px] shrink-0 flex-col rounded-[28px] p-5 lg:flex">
          <button onClick={() => go('/home')} className="flex items-center gap-2.5 text-left">
            <img src="./favicon.svg" alt="" className="h-10 w-10" />
            <span>
              <span className="block text-[18px] font-bold leading-tight">Sakhi</span>
              <span className="block text-[12px] text-ink-soft">for Workplaces</span>
            </span>
          </button>
          <nav className="mt-8 flex flex-col gap-1">
            {[
              [LayoutDashboard, 'Overview', true],
              [LineChart, 'Trends', false],
              [LifeBuoy, 'Support resources', false],
              [ShieldCheck, 'Privacy model', false],
            ].map(([I, l, on]) => {
              const Icon = I as typeof Users
              return (
                <button key={l as string} onClick={() => !on && toast.show()} className={`flex min-h-[46px] items-center gap-3 rounded-2xl px-3 text-[15px] font-medium ${on ? 'bg-rose text-white shadow-soft' : 'text-ink hover:bg-white/60'}`}>
                  <Icon size={19} /> {l as string}
                </button>
              )
            })}
          </nav>
          <div className="mt-auto rounded-2xl bg-white/70 p-3 text-[13px] leading-snug text-ink-soft">
            <div className="font-semibold text-ink">{hr.org}</div>
            HR view · aggregates only
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mb-3 flex justify-end">
            <span className="rounded-full bg-white/60 px-3 py-1 text-[12px] font-medium text-ink-soft">Prototype · simulated data</span>
          </div>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-[0.14em] text-rose-pressed">Menopause support programme</div>
              <h1 className="mt-1 text-[30px] font-bold tracking-tight md:text-[34px]">Overview</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="btn-ghost min-h-[46px] text-[15px]"><CalendarDays size={18} /> Jun – Oct 2026</span>
              <button onClick={() => toast.show()} className="btn-primary min-h-[46px] text-[15px]"><Download size={18} /> Export report</button>
            </div>
          </header>

          <div className="mt-5 flex items-start gap-3 rounded-[22px] p-4 text-white shadow-soft" style={{ background: 'linear-gradient(120deg,#5361C8,#6C7BD9)' }}>
            <ShieldCheck size={24} className="mt-0.5 shrink-0" />
            <div>
              <div className="text-[16px] font-semibold">k-anonymised aggregates only. Groups under 10 people are hidden.</div>
              <div className="text-[14px] text-white">No names, no individual check-ins, no symptom details — ever. Employees' words never leave their phone.</div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi icon={Users} label="Participating" value={String(hr.participating)} sub={`${pct}% of ${hr.eligible.toLocaleString('en-IN')} eligible employees`} tint="#FFDFC3" bar={pct} />
            <Kpi icon={Clock3} label="Check-ins / week" value={String(hr.checkinsPerWeek)} sub="Median per participant" tint="#E6D6F5" />
            <Kpi icon={Handshake} label="Flexi requests supported" value={String(hr.flexSupported)} sub="This quarter · via Rehearsal Room" tint="#DDF1E6" />
            <Kpi icon={TrendingUp} label="Wellbeing index" value="69" sub="+11 since June (self-reported)" tint="#FBD0D5" />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-5">
            <section className="glass-strong rounded-[24px] p-5 xl:col-span-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[18px] font-semibold">Participation & wellbeing</h2>
                <div className="flex gap-4 text-[13px] text-ink-soft">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose" /> People</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-peri" /> Wellbeing index</span>
                </div>
              </div>
              <div className="mt-3 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={hr.monthly} margin={{ top: 8, right: 0, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ppl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#D6336C" stopOpacity={0.35} />
                        <stop offset="1" stopColor="#FEA38E" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#F0DDE3" />
                    <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 13 }} />
                    <YAxis yAxisId="l" tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 12 }} />
                    <YAxis yAxisId="r" orientation="right" domain={[40, 80]} tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 12 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area yAxisId="l" type="monotone" dataKey="people" name="People" stroke="#D6336C" strokeWidth={3} fill="url(#ppl)" />
                    <Line yAxisId="r" type="monotone" dataKey="wellbeing" name="Wellbeing index" stroke="#6C7BD9" strokeWidth={3} dot={{ r: 4, fill: '#fff', strokeWidth: 2.5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="glass-strong rounded-[24px] p-5 xl:col-span-2">
              <h2 className="text-[18px] font-semibold">What people are dealing with</h2>
              <div className="text-[13px] text-ink-soft">% of participants reporting each theme in October</div>
              <div className="mt-3 h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hr.themes} layout="vertical" margin={{ top: 0, right: 28, left: 8, bottom: 0 }} barCategoryGap={8}>
                    <XAxis type="number" hide domain={[0, 100]} />
                    <YAxis type="category" dataKey="theme" tickLine={false} axisLine={false} width={86} tick={{ fill: '#3B1F2B', fontSize: 13 }} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(251,162,171,.12)' }} formatter={(v: number) => [`${v}%`, 'Reporting']} />
                    <Bar dataKey="pct" radius={[0, 10, 10, 0]} label={{ position: 'right', fill: '#3B1F2B', fontSize: 12, formatter: (v: number) => `${v}%` }}>
                      {hr.themes.map((_, i) => (
                        <Cell key={i} fill={['#D6336C', '#E5577F', '#FA7F86', '#FEA38E', '#F3B5A0', '#FBC9B5'][i]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <section className="glass-strong rounded-[24px] p-5">
              <h2 className="text-[18px] font-semibold">By location</h2>
              <div className="mt-3 divide-y divide-[#F1E4E8]">
                {hr.sites.map((s) => (
                  <div key={s.site} className={`flex min-h-[52px] items-center gap-3 ${s.n == null ? 'text-ink-soft' : ''}`}>
                    <span className="flex-1 text-[15px] font-medium">{s.site}</span>
                    {s.n == null ? (
                      <span className="flex items-center gap-1.5 rounded-full bg-[#F3EDF0] px-3 py-1 text-[13px]"><EyeOff size={14} /> Fewer than 10 · hidden</span>
                    ) : (
                      <>
                        <span className="w-28">
                          <span className="block h-2 overflow-hidden rounded-full bg-[#F6E6EA]"><span className="block h-full rounded-full bg-rose" style={{ width: `${(s.n / 150) * 100}%` }} /></span>
                        </span>
                        <span className="w-10 text-right text-[15px] font-semibold tabular-nums">{s.n}</span>
                        <span className="w-14 text-right text-[13px] font-semibold text-[#24563F]">{s.trend}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>
            <section className="glass-strong rounded-[24px] p-5">
              <h2 className="text-[18px] font-semibold">Support resources</h2>
              <div className="mt-3 flex flex-col gap-2">
                {hr.resources.map((r, i) => (
                  <button key={r.title} onClick={() => toast.show()} className="flex min-h-[56px] items-center gap-3 rounded-2xl bg-white/70 px-4 text-left">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: ['#FFDFC3', '#E6D6F5', '#FBD0D5', '#DDF1E6'][i] }}>
                      {i === 2 ? <BookOpen size={17} /> : <Sparkles size={17} />}
                    </span>
                    <span className="flex-1 text-[15px] font-medium">{r.title}</span>
                    <span className="rounded-full bg-[#F6EFEA] px-2.5 py-1 text-[12.5px] font-semibold text-ink-soft">{r.status}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
          <p className="mt-6 pb-4 text-center text-[13px] text-ink-soft">Sakhi shares only cohort-level trends with employers. Prototype — all figures are simulated.</p>
        </main>
      </div>
    </div>
  )
}

/** With a backend: the real, k-anonymised dashboard (HR logs in with an access code). Static hosting, demo and screenshots keep the scripted one. */
export default function HRDashboard() {
  const { status } = useSession()
  const embedded = useEmbedded()
  if (status === 'loading') return null
  return status === 'offline' || embedded ? <HRMock /> : <HRLive />
}

function HRMock() {
  return (
    <ToastProvider fixed>
      <Body />
    </ToastProvider>
  )
}
