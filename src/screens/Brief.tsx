import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Bone, CheckSquare, Download, Dumbbell, HeartPulse, Languages, MessageCircleQuestion, ScanSearch, Share2, ShieldCheck } from 'lucide-react'
import { useI18n } from '../i18n'
import { Screen, TopBar, useToast } from '../components/ui'
import { brief } from '../mock/clinical'
import { useLive } from '../api/session'
import { useEmbedded } from '../components/nav'
import BriefLive from './BriefLive'

const N20_ICON = { bone: Bone, heart: HeartPulse, strength: Dumbbell, screen: ScanSearch }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#F1E4E8] pt-4">
      <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.12em] text-rose-pressed">{title}</h3>
      {children}
    </section>
  )
}

/** Live when logged in; demo/screenshots/static hosting keep the scripted version. */
export default function Brief() {
  const live = useLive()
  const embedded = useEmbedded()
  return live && !embedded ? <BriefLive /> : <BriefMock />
}

function BriefMock() {
  const { t } = useI18n()
  const toast = useToast()
  return (
    <Screen bg="plain" nav={
      <div className="absolute inset-x-0 bottom-0 z-30 flex gap-3 px-5 pb-7 pt-6" style={{ background: 'linear-gradient(to top, #F6EFEA 60%, rgba(246,239,234,0))' }}>
        <button onClick={() => toast.show()} className="btn-ghost flex-1 bg-white"><Share2 size={18} /> Share</button>
        <button onClick={() => toast.show()} className="btn-primary flex-[1.4]"><Download size={18} /> Download PDF</button>
      </div>
    } header={<TopBar title={t('t_brief')} right={<button aria-label="Share" className="icon-btn" onClick={() => toast.show()}><Share2 size={18} /></button>} />}>
      <div className="px-4 pb-32">
        <div className="mb-3 flex justify-center">
          <span className="chip bg-white"><Languages size={15} className="text-peri-deep" /> {t('br_note')}</span>
        </div>
        <article className="flex flex-col gap-4 rounded-[26px] bg-white p-5 text-ink shadow-card" lang="en">
          <header>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-pressed">Sakhi · Doctor-Ready Brief</span>
              <span className="rounded-full bg-[#F6EFEA] px-2 py-0.5 text-[11px] font-semibold text-ink-soft">1 page</span>
            </div>
            <h2 className="mt-1 text-[21px] font-bold">{brief.patient}</h2>
            <div className="text-[14px] text-ink-soft">{brief.period}</div>
            <div className="mt-1 text-[14px] leading-snug">{brief.stage}</div>
          </header>

          <Section title="Menopause Rating Scale (MRS)">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <span className="text-[34px] font-bold leading-none">{brief.mrsTotal}</span>
                <span className="text-[15px] text-ink-soft"> / 44</span>
              </div>
              <span className="rounded-full bg-peach-light px-3 py-1 text-[13px] font-semibold text-rose-pressed">{brief.mrsBand}</span>
            </div>
            <div className="flex flex-col gap-3">
              {brief.domains.map((d) => (
                <div key={d.name}>
                  <div className="flex items-baseline justify-between text-[15px]">
                    <span className="font-semibold">{d.name}</span>
                    <span className="tabular-nums text-ink-soft">{d.score}/{d.max} · {d.band}</span>
                  </div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-[#F6E6EA]">
                    <div className="h-full rounded-full" style={{ width: `${(d.score / d.max) * 100}%`, background: 'linear-gradient(90deg,#FEA38E,#D6336C)' }} />
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-soft">{d.items}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Symptom timeline · October">
            <div className="h-[150px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={brief.timeline} barGap={3} margin={{ top: 4, right: 4, bottom: 0, left: -26 }}>
                  <CartesianGrid vertical={false} stroke="#F3E6EA" />
                  <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: '#6B4A57', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(251,162,171,0.15)' }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 6px 20px rgba(0,0,0,.1)' }} />
                  <Bar dataKey="flashes" name="Hot flushes" fill="#D6336C" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="poorSleep" name="Poor-sleep nights" fill="#6C7BD9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-[13px] text-ink-soft">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose" />Hot flushes</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-peri" />Poor-sleep nights</span>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {brief.highlights.map((h) => (
                <li key={h} className="flex gap-2 text-[15px] leading-snug"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-peach" />{h}</li>
              ))}
            </ul>
          </Section>

          <Section title="Please help rule out">
            <div className="flex flex-col gap-2">
              {brief.ruleOut.map((r) => (
                <div key={r.test} className="flex items-start gap-2.5 rounded-2xl bg-[#FBF5F2] p-3">
                  <CheckSquare size={18} className="mt-0.5 shrink-0 text-rose" />
                  <div>
                    <div className="text-[15px] font-semibold">{r.test}</div>
                    <div className="text-[13.5px] leading-snug text-ink-soft">{r.why}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Questions I'd like to ask">
            {brief.questions.map((q) => (
              <div key={q} className="flex gap-2 py-1 text-[15px] leading-snug"><MessageCircleQuestion size={17} className="mt-0.5 shrink-0 text-peri-deep" />{q}</div>
            ))}
          </Section>

          <div className="rounded-[22px] p-4 text-white" style={{ background: 'linear-gradient(135deg, #5361C8, #6C7BD9)' }}>
            <div className="text-[12px] font-bold uppercase tracking-[0.14em] text-white/90">The next 20 years</div>
            <div className="mb-3 text-[17px] font-semibold">Prevention plan to discuss</div>
            <div className="grid grid-cols-2 gap-2">
              {brief.next20.map((n) => {
                const I = N20_ICON[n.key as keyof typeof N20_ICON]
                return (
                  <div key={n.key} className="rounded-2xl bg-white/15 p-3">
                    <I size={18} />
                    <div className="mt-1 text-[15px] font-semibold">{n.title}</div>
                    <div className="text-[13px] leading-snug text-white">{n.text}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <footer className="flex items-start gap-2 rounded-2xl bg-[#F6EFEA] p-3 text-[13px] leading-snug text-ink-soft">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-ink" />
            <span><b className="text-ink">Supportive, not diagnostic.</b> Generated by Sakhi from self-reported voice check-ins. Prototype — simulated data.</span>
          </footer>
        </article>
      </div>
    </Screen>
  )
}
