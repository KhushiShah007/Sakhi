import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Check, Hand, HeartHandshake, Mic, RotateCcw, Sparkles, Stethoscope, X } from 'lucide-react'
import { pick, useI18n } from '../i18n'
import { Screen, Segmented, TopBar } from '../components/ui'
import { useEmbedded, useParam } from '../components/nav'
import RehearsalChat from './RehearsalChat'
import { api } from '../api/client'
import { useLive, useSession } from '../api/session'
import type { StrKey } from '../i18n/strings'
import { useListen } from '../voice/speech'
import { Avatar } from '../illustrations/Woman'
import { scenarios, type ScenarioId } from '../mock/content'

const ICON = { family: HeartHandshake, hr: Briefcase, doctor: Stethoscope }

/** Forced stage/scenario params (screenshots, the embedded demo) keep the scripted scene; everything else is the real chat. */
export default function Rehearsal() {
  const embedded = useEmbedded()
  const { status } = useSession()
  const forcedS = useParam('s')
  const forcedAll = useParam('all')
  const forced = forcedS || forcedAll
  if (embedded || forced) return <RehearsalScripted />
  if (status === 'authed') return <RehearsalChat />
  if (status === 'offline' || status === 'netdown') return <RehearsalChat offline />
  return <RehearsalScripted />
}

function RehearsalScripted() {
  const { t, lang } = useI18n()
  const qs = useParam('s') as ScenarioId | null
  const all = useParam('all') === '1'
  const [sid, setSid] = useState<ScenarioId>(qs ?? 'doctor')
  const sc = scenarios.find((s) => s.id === sid)!
  // number of turns revealed; the next turn is "me" → shown as a suggestion
  const [shown, setShown] = useState(all ? sc.turns.length : 1)
  const [typing, setTyping] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const live = useLive()
  const listener = useListen(lang)
  const [mine, setMine] = useState<string[]>([])
  const [own, setOwn] = useState('')
  const [fb, setFb] = useState<{ checks: { id: string; pass: boolean }[]; tip: string } | null>(null)
  const [crisis, setCrisis] = useState<string | null>(null)

  useEffect(() => { setShown(all ? sc.turns.length : 1); setTyping(false); setMine([]); setOwn(''); setFb(null); setCrisis(null) }, [sid, all, sc.turns.length])
  useEffect(() => { scroller.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, [shown, typing])

  const next = sc.turns[shown]
  const done = shown >= sc.turns.length
  const Icon = ICON[sid]

  // when the scene ends, get rule-based feedback on HER words (live only; nothing is stored)
  const done0 = shown >= sc.turns.length
  useEffect(() => {
    if (!live || !done0 || fb || mine.length === 0) return
    void api<{ kind: string; checks?: { id: string; pass: boolean }[]; tip?: string; message?: string }>('POST', '/api/rehearsal/feedback', { scenario: sid, lines: mine, lang })
      .then((r) => { if (r.kind === 'crisis') setCrisis(r.message ?? ''); else if (r.checks) setFb({ checks: r.checks, tip: r.tip ?? 'great' }) })
      .catch(() => {})
  }, [live, done0, fb, mine, sid, lang])

  const say = (words?: string) => {
    setMine((m) => [...m, words ?? pick(next.text, lang)])
    setOwn(''); listener.reset()
    setShown((s) => s + 1)
    if (sc.turns[shown + 1]?.who === 'them') {
      setTyping(true)
      window.setTimeout(() => { setTyping(false); setShown((s) => s + 1) }, 1300)
    }
  }

  return (
    <Screen bg="wash" scrollRef={scroller} header={<TopBar title={t('rh_title')} />}>
      <div className="px-5 pb-10">
        <p className="text-center text-[15px] leading-snug text-ink-soft">{t('rh_sub')}</p>
        <div className="mt-3 flex justify-center">
          <Segmented value={sid} onChange={setSid} options={[{ id: 'family', label: t('rh_family') }, { id: 'hr', label: t('rh_hr') }, { id: 'doctor', label: t('rh_doctor') }]} />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/75 py-1 pl-1 pr-3 text-[14px] font-medium shadow-card">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={16} /></span>
            {t('rh_playing')}: <b className="font-semibold">{pick(sc.role, lang)}</b>
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {sc.turns.slice(0, shown).map((turn, i) => (
            <motion.div key={`${sid}-${i}`} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex items-end gap-2 ${turn.who === 'me' ? 'justify-end' : ''}`}>
              {turn.who === 'them' && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={17} /></span>}
              <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-[16px] leading-snug ${turn.who === 'me' ? 'rounded-br-md bg-rose text-white shadow-soft' : 'glass-strong rounded-bl-md text-ink'}`}>
                {pick(turn.text, lang)}
              </div>
              {turn.who === 'me' && <Avatar size={34} />}
            </motion.div>
          ))}
          <AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={17} /></span>
                <div className="glass-strong flex gap-1 rounded-3xl rounded-bl-md px-4 py-4">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} className="h-2 w-2 rounded-full bg-ink-soft" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!done && next?.who === 'me' && !typing && (
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={() => say()} className="mt-5 w-full rounded-3xl border-2 border-dashed border-rose/50 bg-white/60 p-4 text-left">
            <span className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-rose-pressed"><Hand size={15} /> {t('rh_tap')}</span>
            <span className="text-[16px] leading-snug">{pick(next.text, lang)}</span>
          </motion.button>
        )}

        {live && !done && next?.who === 'me' && !typing && (
          <div className="mt-3 rounded-3xl bg-white/70 p-3">
            <label className="mb-1 block text-[13px] font-semibold text-rose-pressed" htmlFor="rh-own">{t('rh_own')}</label>
            <textarea id="rh-own" value={listener.listening ? listener.text : own} readOnly={listener.listening} onChange={(e) => setOwn(e.target.value)} maxLength={300} rows={2} placeholder={t('rh_ph')} className="w-full resize-none bg-transparent text-[16px] leading-snug outline-none placeholder:text-ink-soft" />
            <div className="mt-1 flex gap-2">
              {listener.supported && <button aria-label="Microphone" onClick={() => { if (listener.listening) setOwn(listener.stop()); else { listener.reset(); listener.start() } }} className={`grid h-12 w-12 place-items-center rounded-full ${listener.listening ? 'bg-rose text-white' : 'bg-white text-rose-pressed'}`}><Mic size={20} /></button>}
              <button onClick={() => say((listener.listening ? listener.stop() : own).trim())} disabled={!(listener.listening ? listener.text : own).trim()} className="btn-primary min-h-[48px] flex-1 disabled:opacity-50">{t('rh_say')}</button>
            </div>
          </div>
        )}

        {crisis && <div role="alert" className="mt-5 rounded-2xl bg-[#FBEDEF] p-4 text-[16px] font-medium text-[#8A1F42]" data-testid="rh-crisis">{crisis}</div>}

        {done && fb && (
          <div className="mt-5 rounded-[26px] bg-white p-5 shadow-card" data-testid="rh-feedback">
            <div className="text-[14px] font-semibold text-rose-pressed">{t('rh_fb')}</div>
            <ul className="mt-2 flex flex-col gap-1.5">
              {fb.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-[15.5px] leading-snug">
                  {c.pass ? <Check size={18} className="mt-0.5 shrink-0 text-[#2F6B4F]" /> : <X size={18} className="mt-0.5 shrink-0 text-[#8A1F42]" />}
                  <span className={c.pass ? '' : 'font-semibold'}>{t(`rh_ck_${c.id}` as StrKey)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-2xl bg-[#F6EFEA] p-3 text-[15px] leading-snug">{t(`rh_tip_${fb.tip}` as StrKey)}</p>
          </div>
        )}

        {done && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-5 rounded-[26px] p-5 text-white shadow-soft" style={{ background: 'linear-gradient(135deg, #5361C8, #6C7BD9)' }}>
            <div className="flex items-center gap-2 text-[14px] font-semibold"><Sparkles size={16} /> Sakhi</div>
            <p className="mt-1 text-[17px] font-medium leading-snug">{pick(sc.feedback, lang)}</p>
            <button onClick={() => { setShown(1); setMine([]); setFb(null); setCrisis(null) }} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/20 px-4 text-[15px] font-semibold"><RotateCcw size={16} /> {t('rh_again')}</button>
          </motion.div>
        )}
      </div>
    </Screen>
  )
}
