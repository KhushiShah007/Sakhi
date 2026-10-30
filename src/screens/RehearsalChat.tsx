import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Check, HeartHandshake, Lightbulb, Mic, MicOff, Play, RotateCcw, Send, Stethoscope, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { pick, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Screen, Segmented, TopBar } from '../components/ui'
import VoiceNote from '../components/VoiceNote'
import { api } from '../api/client'
import { Avatar } from '../illustrations/Woman'
import { scenarios } from '../mock/content'
import { local, type Feedback, type SessionFull, type SessionItem, type TurnResult } from '../offline/localRehearsal'
import type { Scenario } from '../offline/engine'
import { speak, stopSpeaking, useListen } from '../voice/speech'

const ICON = { family: HeartHandshake, hr: Briefcase, doctor: Stethoscope }
interface Msg { who: 'me' | 'them'; text: string }
interface Crisis { message: string; helplines: { name: string; number: string }[] }

const online = {
  create: (scenario: Scenario, lang: string) => api<{ id: string; opening: string }>('POST', '/api/rehearsal/sessions', { scenario, lang }),
  turn: (id: string, text: string) => api<TurnResult>('POST', `/api/rehearsal/sessions/${id}/turn`, { text }),
  end: (id: string) => api<Feedback>('POST', `/api/rehearsal/sessions/${id}/end`),
  list: () => api<{ sessions: SessionItem[] }>('GET', '/api/rehearsal/sessions').then((r) => r.sessions),
  get: (id: string) => api<SessionFull>('GET', `/api/rehearsal/sessions/${id}`),
  remove: (id: string) => api('DELETE', `/api/rehearsal/sessions/${id}`).then(() => undefined),
}
const SC_KEY: Record<Scenario, StrKey> = { family: 'rh_family', hr: 'rh_hr', doctor: 'rh_doctor' }

/** A real role-play: Sakhi plays the other person, answers what she actually says, speaks the reply, and coaches her at the end. */
export default function RehearsalChat({ offline = false }: { offline?: boolean }) {
  const { t, lang } = useI18n()
  const rh = offline ? local : online
  const listener = useListen(lang)
  const [sid, setSid] = useState<Scenario>('family')
  const [view, setView] = useState<'start' | 'chat'>('start')
  const [session, setSession] = useState<{ id: string; scenario: Scenario; ended: boolean } | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [fb, setFb] = useState<Feedback | null>(null)
  const [crisis, setCrisis] = useState<Crisis | null>(null)
  const [refusal, setRefusal] = useState('')
  const [muted, setMuted] = useState(false)
  const [past, setPast] = useState<SessionItem[]>([])
  const [err, setErr] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const Icon = ICON[session?.scenario ?? sid]
  const myTurns = msgs.filter((m) => m.who === 'me').length

  const loadPast = () => { void rh.list().then((l) => setPast(l.filter((s) => s.turns > 0))).catch(() => setPast([])) }
  useEffect(loadPast, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { scroller.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, [msgs, sending, fb, crisis])
  useEffect(() => () => stopSpeaking(), [])

  const say = (line: string) => { if (!muted) speak(line, lang) }
  const reset = () => { stopSpeaking(); listener.reset(); setText(''); setMsgs([]); setDone(false); setFb(null); setCrisis(null); setRefusal(''); setErr(false); setSession(null) }

  const start = async () => {
    reset(); setErr(false)
    try {
      const s = await rh.create(sid, lang)
      setSession({ id: s.id, scenario: sid, ended: false }); setMsgs([{ who: 'them', text: s.opening }]); setView('chat'); say(s.opening)
    } catch { setErr(true) }
  }
  const resume = async (id: string) => {
    reset()
    try {
      const s = await rh.get(id)
      setSid(s.scenario); setSession({ id: s.id, scenario: s.scenario, ended: !!s.endedAt }); setFb(s.feedback)
      setMsgs(s.turns.map((x) => ({ who: x.who, text: x.text }))); setDone(!!s.endedAt); setView('chat')
    } catch { setErr(true) }
  }
  const remove = async (id: string) => { await rh.remove(id).catch(() => {}); loadPast(); if (session?.id === id) { reset(); setView('start') } }

  const send = async () => {
    if (!session || sending) return
    const said = (listener.listening ? await listener.finish() : text).trim()
    if (!said) return
    stopSpeaking(); setErr(false); setRefusal(''); setText(''); listener.reset()
    setMsgs((m) => [...m, { who: 'me', text: said }]); setSending(true)
    try {
      const r = await rh.turn(session.id, said)
      if ('crisis' in r) { setMsgs((m) => m.slice(0, -1)); setCrisis(r.crisis); speak(r.crisis.message, lang); return }
      if ('refusal' in r) { setMsgs((m) => m.slice(0, -1)); setRefusal(r.refusal.message); setText(said); return }
      await new Promise((ok) => window.setTimeout(ok, 500)) // a beat of "typing" so it feels like a person
      setMsgs((m) => [...m, { who: 'them', text: r.reply }]); say(r.reply)
      if (r.done) setDone(true)
    } catch { setMsgs((m) => m.slice(0, -1)); setText(said); setErr(true) }
    finally { setSending(false) }
  }
  const finishSession = async () => {
    if (!session) return
    stopSpeaking()
    try { const f = await rh.end(session.id); setFb(f); setSession({ ...session, ended: true }); setDone(true); loadPast() } catch { setErr(true) }
  }
  const mic = () => { if (listener.listening) { void listener.finish().then(setText); return } listener.reset(); setText(''); listener.start() }
  const hintLine = (() => { const mine = scenarios.find((s) => s.id === (session?.scenario ?? sid))!.turns.filter((x) => x.who === 'me'); return mine.length ? pick(mine[Math.min(myTurns, mine.length - 1)].text, lang) : '' })()
  const active = !!session && !session.ended

  return (
    <Screen bg="wash" scrollRef={scroller} header={<TopBar title={t('rh_title')} right={view === 'chat' ? <button aria-label={muted ? t('rh_unmute') : t('rh_mute')} aria-pressed={muted} onClick={() => { setMuted((m) => !m); stopSpeaking() }} className="grid h-12 w-12 place-items-center rounded-full bg-white/75 text-ink">{muted ? <VolumeX size={20} /> : <Volume2 size={20} />}</button> : undefined} />}>
      <div className="px-5 pb-10">
        {view === 'start' && (
          <>
            <p className="text-center text-[15px] leading-snug text-ink-soft">{t('rh_sub')}</p>
            <div className="mt-3 flex justify-center">
              <Segmented value={sid} onChange={setSid} options={(['family', 'hr', 'doctor'] as Scenario[]).map((id) => ({ id, label: t(SC_KEY[id]) }))} />
            </div>
            <p className="mt-4 text-center text-[15px] text-ink">{t('rh_playing')}: <b>{pick(scenarios.find((s) => s.id === sid)!.role, lang)}</b></p>
            <button onClick={() => void start()} className="btn-primary mt-4 w-full"><Play size={19} /> {t('rh_start')}</button>
            {offline && <p data-testid="local-note" className="mt-2 text-center text-[13.5px] text-ink-soft">{t('rh_local')}</p>}
            {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}

            <h2 className="h-section mb-2 mt-7">{t('rh_past')}</h2>
            {past.length === 0 ? <p className="text-[15px] text-ink-soft" data-testid="past-empty">{t('rh_past_none')}</p> : (
              <ul className="flex flex-col gap-2" data-testid="past-list">
                {past.map((p) => (
                  <li key={p.id} className="glass flex items-center gap-2 rounded-2xl p-3">
                    <button onClick={() => void resume(p.id)} className="min-h-[48px] min-w-0 flex-1 text-left" aria-label={`${p.endedAt ? t('rh_review') : t('rh_resume')}: ${t(SC_KEY[p.scenario])}`}>
                      <span className="block text-[16px] font-semibold">{t(SC_KEY[p.scenario])}</span>
                      <span className="block text-[13.5px] text-ink-soft">{new Date(p.createdAt).toLocaleDateString(`${lang}-IN`, { day: 'numeric', month: 'short' })} · {t('rh_turns', { n: p.turns })} · {p.endedAt ? t('rh_review') : t('rh_resume')}</span>
                    </button>
                    <button aria-label={`${t('rh_delete')}: ${t(SC_KEY[p.scenario])}`} onClick={() => void remove(p.id)} className="grid h-12 w-12 place-items-center rounded-full text-ink-soft"><Trash2 size={18} /></button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {view === 'chat' && session && (
          <>
            <div className="mt-1 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/75 py-1 pl-1 pr-3 text-[14px] font-medium shadow-card">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={16} /></span>
                {t('rh_playing')}: <b className="font-semibold">{pick(scenarios.find((s) => s.id === session.scenario)!.role, lang)}</b>
              </span>
            </div>
            {offline && <p data-testid="local-note" className="mt-2 text-center text-[13.5px] text-ink-soft">{t('rh_local')}</p>}
            <VoiceNote className="mt-3" />

            <div className="mt-4 flex flex-col gap-3" data-testid="chat" aria-live="polite">
              {msgs.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex items-end gap-2 ${m.who === 'me' ? 'justify-end' : ''}`}>
                  {m.who === 'them' && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={17} /></span>}
                  <div data-who={m.who} className={`max-w-[78%] rounded-3xl px-4 py-3 text-[16px] leading-snug ${m.who === 'me' ? 'rounded-br-md bg-rose text-white shadow-soft' : 'glass-strong rounded-bl-md text-ink'}`}>{m.text}</div>
                  {m.who === 'me' && <Avatar size={34} />}
                </motion.div>
              ))}
              <AnimatePresence>
                {sending && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-end gap-2" role="status" aria-label={t('rh_typing')} data-testid="typing">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={17} /></span>
                    <div className="glass-strong flex gap-1 rounded-3xl rounded-bl-md px-4 py-4">
                      {[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-ink-soft" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {crisis && (
              <div role="alert" data-testid="rh-crisis" className="mt-5 rounded-2xl bg-[#FBEDEF] p-4 text-[16px] font-medium leading-snug text-[#8A1F42]">
                <p>{crisis.message}</p>
                <ul className="mt-2 flex flex-col gap-1">{crisis.helplines.map((h) => <li key={h.number}>{h.name}: <a className="font-bold underline" href={`tel:${h.number}`}>{h.number}</a></li>)}</ul>
                <button onClick={() => setCrisis(null)} className="btn-ghost mt-3 w-full bg-white">{t('rh_crisis_ok')}</button>
              </div>
            )}
            {refusal && <p role="status" data-testid="rh-refusal" className="mt-4 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">{refusal}</p>}
            {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}

            {active && !crisis && (
              <div className="mt-4 rounded-3xl bg-white/70 p-3">
                {done && <p className="mb-2 text-[14.5px] font-medium text-[#2F6B4F]" data-testid="scene-done">{t('rh_scene_done')}</p>}
                <label className="mb-1 block text-[13px] font-semibold text-rose-pressed" htmlFor="rh-own">{t('rh_own')}</label>
                <textarea id="rh-own" value={listener.listening ? listener.text : text} readOnly={listener.listening} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }} maxLength={300} rows={2} placeholder={t('rh_ph')} className="w-full resize-none rounded-2xl border border-[#E7CBD3] bg-white/90 p-3 text-[16px] outline-none focus:border-rose" />
                {listener.error && !listener.listening && <p role="status" data-testid="mic-help" className="mt-1 text-[14px] text-ink-soft">{t(listener.error === 'not-allowed' ? 'mic_denied' : listener.error === 'no-speech' ? 'mic_none' : listener.error === 'insecure' ? 'mic_insecure' : listener.error === 'network' ? 'mic_net' : 'mic_other')}</p>}
                <div className="mt-2 flex gap-2">
                  {listener.supported && <button aria-label={listener.listening ? t('rh_mic_stop') : t('rh_mic')} aria-pressed={listener.listening} onClick={mic} className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${listener.listening ? 'bg-rose text-white' : 'bg-white text-rose-pressed'}`}>{listener.listening ? <MicOff size={19} /> : <Mic size={19} />}</button>}
                  <button onClick={() => void send()} disabled={sending || !(listener.listening ? listener.text : text).trim()} className="btn-primary min-h-[48px] flex-1 disabled:opacity-50"><Send size={18} /> {t('rh_say')}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button onClick={() => setText(hintLine)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-white/80 px-4 text-[14px] font-semibold text-ink"><Lightbulb size={16} /> {t('rh_hint')}</button>
                  {myTurns > 0 && <button onClick={() => void finishSession()} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-rose px-4 text-[14px] font-semibold text-white"><Check size={16} /> {t('rh_end')}</button>}
                </div>
              </div>
            )}

            {fb && (
              <div className="mt-5 rounded-[26px] bg-white p-5 shadow-card" data-testid="rh-feedback">
                <div className="text-[14px] font-semibold text-rose-pressed">{t('rh_fb')} · {t('rh_summary', { p: fb.summary.passed, n: fb.summary.of })}</div>
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

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => { void start() }} className="btn-ghost"><RotateCcw size={17} /> {t('rh_again')}</button>
              <button onClick={() => { reset(); setView('start'); loadPast() }} className="btn-ghost">{t('rh_back')}</button>
            </div>
          </>
        )}
      </div>
    </Screen>
  )
}
