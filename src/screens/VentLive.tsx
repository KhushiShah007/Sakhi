import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Heart, Keyboard, Pencil, Phone, Snowflake, Sparkles, Volume2 } from 'lucide-react'
import { LANGS, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, ApiError } from '../api/client'
import { clearHandoff, setHandoff } from '../api/handoff'
import { Orb, Screen, TopBar, Waveform } from '../components/ui'
import { useGo } from '../components/nav'
import { SPEECH_LANG, speak, stopSpeaking } from '../voice/speech'
import { useVoiceInput } from '../voice/input'
import { useElapsed, useMicLevel } from '../voice/level'
import { localCall } from '../offline/localVent'
import VoiceNote from '../components/VoiceNote'

/** Live Vent Mode: voice (or typed) -> rules + extraction -> she confirms every entry -> saved -> warm reflection. */
type Stage = 'idle' | 'listen' | 'sending' | 'confirm' | 'reflect' | 'crisis' | 'refusal'
interface Sym { symptom: string; severity: number; mrsItem: string | null; time?: string; trigger?: string }
interface Proposal { id: string; symptom: string; severity: number; mrsItem: string | null; time: string; trigger: string }
interface Helpline { name: string; number: string }
interface Crisis { message: string; helplines: Helpline[] }

const MRS_NO: Record<string, number> = { hot_flushes: 1, heart_discomfort: 2, sleep: 3, depressive_mood: 4, irritability: 5, anxiety: 6, exhaustion: 7, sexual: 8, bladder: 9, vaginal_dryness: 10, joint_muscle: 11 }
const SLOTS: React.CSSProperties[] = [{ left: 14, top: 4 }, { right: 14, top: 34 }, { left: 4, top: 138 }, { right: 4, top: 152 }, { left: 18, top: 262 }, { right: 18, top: 286 }]
const LEVEL_DOT = ['#FFC56B', '#FFC56B', '#FEA38E', '#D6336C', '#B02458']
const LEVEL_KEY: StrKey[] = ['sev_mild', 'sev_mild', 'sev_moderate', 'sev_severe', 'sev_extreme']
const TRIGGERS = ['unspecified', 'stress', 'heat', 'food', 'sleep', 'family', 'work', 'none'] as const
const symKey = (s: string) => `sy_${s}` as StrKey
const trgKey = (s: string) => `trg_${s}` as StrKey
const mrsLabel = (item: string | null) => (item && MRS_NO[item] ? `MRS ${MRS_NO[item]}` : '')

const micKey = (e: string): StrKey =>
  e === 'not-allowed' || e === 'service-not-allowed' ? 'mic_denied' : e === 'no-speech' ? 'mic_none' : e === 'network' ? 'mic_net' : e === 'insecure' ? 'mic_insecure' : e === 'unsupported' ? 'mic_unsupported' : 'mic_other'

/** Live input level and a running timer, so she can see Sakhi is listening. */
function LevelMeter({ level, secs, label }: { level: number; secs: number; label: string }) {
  const bars = 28
  return (
    <div className="mb-2 flex items-center gap-3" data-testid="level-meter">
      <div className="flex h-[30px] flex-1 items-center justify-center gap-[3px]" aria-hidden>
        {Array.from({ length: bars }, (_, i) => {
          const shape = 0.45 + 0.55 * Math.abs(Math.sin(i * 1.3))
          return <span key={i} className="w-[3.5px] rounded-full bg-rose transition-[height] duration-100" style={{ height: 4 + 26 * Math.min(1, level * 1.4) * shape }} />
        })}
      </div>
      <span className="min-w-[44px] text-right text-[14px] font-semibold tabular-nums text-ink-soft" aria-label={label}>{Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</span>
    </div>
  )
}

export default function VentLive({ local = false }: { local?: boolean }) {
  const { t, lang } = useI18n()
  const go = useGo()
  const listener = useVoiceInput(lang)
  // without a server the same rules run in the browser and entries are kept on this device
  const call = local ? localCall : api
  const [stage, setStage] = useState<Stage>('idle')
  const [typing, setTyping] = useState(!listener.supported)
  const [preview, setPreview] = useState<Sym[]>([])
  const [crisis, setCrisis] = useState<Crisis | null>(null)
  const [refusal, setRefusal] = useState('')
  const [setId, setSetId] = useState('')
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [reflection, setReflection] = useState('')
  const [err, setErr] = useState<StrKey | null>(null)
  const [noneFound, setNoneFound] = useState(false)
  const reqId = useRef(0)
  const text = listener.text
  const live = stage === 'listen' && listener.listening
  const meter = useMicLevel(live && listener.mode === 'browser')
  const level = Math.max(meter, listener.level, live && listener.hearing ? 0.55 : 0)
  const recording = listener.mode === 'record'
  const busy = listener.phase === 'transcribing'
  const secs = useElapsed(live)

  const showCrisis = (c: Crisis) => { listener.stop(); setCrisis(c); setStage('crisis'); speak(c.message, lang) }

  // live chips: rules-only preview while she speaks or types. A crisis phrase interrupts immediately.
  useEffect(() => {
    if (stage !== 'idle' && stage !== 'listen') return
    if (text.trim().length < 3) { setPreview([]); return }
    const id = ++reqId.current
    const h = window.setTimeout(async () => {
      try {
        const r = await call<{ kind: string; symptoms?: Sym[]; message?: string; helplines?: Helpline[] }>('POST', '/api/utterance/preview', { text, lang })
        if (id !== reqId.current) return
        if (r.kind === 'crisis') return showCrisis({ message: r.message!, helplines: r.helplines! })
        setPreview(r.kind === 'reply' ? (r.symptoms ?? []).filter((s, i, a) => a.findIndex((x) => x.symptom === s.symptom) === i).slice(0, 6) : [])
      } catch { /* preview is best-effort; the final submit is authoritative */ }
    }, 650)
    return () => window.clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, stage, lang])

  useEffect(() => () => { stopSpeaking() }, [])

  const onOrb = () => {
    if (listener.listening) { void listener.finish(); return }
    if (!listener.supported) { setTyping(true); return }
    setErr(null); setStage('listen'); listener.start()
  }

  const submit = async () => {
    // after recording, the words are written out first and she checks them before they are sent
    if (recording && listener.listening) { await listener.finish(); setStage('listen'); return }
    const said = (listener.listening ? await listener.finish() : text).trim()
    if (!said) return
    setErr(null); setNoneFound(false); setStage('sending')
    try {
      const r = await call<{ kind: string; message: string; helplines?: Helpline[]; proposals?: Proposal[]; setId?: string }>('POST', '/api/utterance', { text: said, lang })
      if (r.kind === 'crisis') return showCrisis({ message: r.message, helplines: r.helplines! })
      if (r.kind === 'refusal') { setRefusal(r.message); setStage('refusal'); speak(r.message, lang); return }
      setReflection(r.message); setSetId(r.setId!); setProposals(r.proposals!)
      setSelection(Object.fromEntries(r.proposals!.map((p) => [p.id, { on: true, level: Math.max(1, p.severity), trigger: p.trigger }])))
      if (!r.proposals!.length) { setNoneFound(true); setStage('listen'); return }
      setHandoff({ text: said, symptoms: r.proposals!.map((p) => p.symptom) })
      setStage('confirm')
    } catch (e) {
      setErr(e instanceof ApiError && e.code === 'consent_required' ? 'vl_consent' : 'fl_error')
      setStage('listen')
    }
  }

  const [selection, setSelection] = useState<Record<string, { on: boolean; level: number; trigger: string }>>({})
  const save = async () => {
    try {
      await call('POST', '/api/logs/confirm', {
        setId,
        decisions: proposals.map((p) => ({ id: p.id, accept: selection[p.id]?.on ?? false, severity: selection[p.id]?.level ?? p.severity, trigger: selection[p.id]?.trigger ?? p.trigger })),
      })
      setStage('reflect'); speak(reflection, lang)
    } catch { setErr('fl_error') }
  }

  const reset = () => { listener.reset(); setPreview([]); setProposals([]); setCrisis(null); setNoneFound(false); setErr(null); setStage('idle'); stopSpeaking() }
  const langLabel = LANGS.find((l) => l.id === lang)!.native

  return (
    <Screen bg="wash" header={<TopBar title={t('vent')} right={<span className="rounded-full bg-white/75 px-3 py-1.5 text-[13px] font-semibold text-ink">{langLabel}</span>} />}>
      <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-[#FBB3C0] opacity-40 blur-3xl" />
      <AnimatePresence mode="wait">
        {(stage === 'idle' || stage === 'listen' || stage === 'sending') && (
          <motion.div key="listen" exit={{ opacity: 0, y: -10 }} className="relative px-5 pb-8">
            <div className="relative h-[340px]">
              {preview.map((s, i) => (
                <motion.div key={s.symptom} initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }} transition={{ opacity: { duration: 0.3 }, scale: { type: 'spring', stiffness: 300, damping: 18 }, y: { duration: 3 + (i % 5) / 3, repeat: Infinity, ease: 'easeInOut' } }} className="glass-strong absolute z-20 flex max-w-[172px] items-start gap-2 rounded-2xl px-3 py-2" style={SLOTS[i]}>
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LEVEL_DOT[Math.max(1, s.severity)] }} />
                  <span className="min-w-0">
                    <span className="block text-[15px] font-semibold leading-tight">{t(symKey(s.symptom))}</span>
                    <span className="block text-[12.5px] leading-tight text-ink-soft">{t(LEVEL_KEY[Math.max(1, s.severity)])}{mrsLabel(s.mrsItem) && ` · ${mrsLabel(s.mrsItem)}`}</span>
                  </span>
                </motion.div>
              ))}
              <div className="absolute left-1/2 top-[170px] z-30 -translate-x-1/2 -translate-y-1/2">
                <Orb size={124} active={live} label={stage === 'idle' ? t('tap_speak') : stage === 'sending' ? t('vl_sending') : t('listening')} sub={undefined} onClick={onOrb} />
              </div>
            </div>

            <div className="glass rounded-[26px] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-rose-pressed">{t('vent_heard')}</span>
                {live ? <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft"><span className="h-2 w-2 animate-pulse rounded-full bg-rose" /> {t('vent_listening')}</span>
                  : listener.supported && <button onClick={() => setTyping((v) => !v)} className="flex min-h-[40px] items-center gap-1.5 rounded-full px-2 text-[13.5px] font-medium text-ink-soft"><Keyboard size={16} /> {t('vl_type')}</button>}
              </div>
              {live ? <LevelMeter level={level} secs={secs} label={t('vl_listening_for')} /> : <Waveform bars={40} active={false} height={30} className="mb-2" />}
              <textarea
                aria-label={t('vent_heard')}
                value={text}
                readOnly={live || busy || stage === 'sending'}
                onChange={(e) => listener.setText(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder={live && recording ? t('vl_rec') : busy ? t('vl_writing') : stage === 'idle' && !typing ? t('vent_idle') : t('vl_ph')}
                className="min-h-[120px] w-full resize-none bg-transparent text-[17px] leading-relaxed text-ink outline-none placeholder:text-ink-soft"
              />
            </div>
            {recording && listener.switched && stage === 'idle' && !live && <p role="status" data-testid="stt-switched" className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">{t('vl_switched')}</p>}
            {busy && <p role="status" data-testid="stt-busy" className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-[15px] leading-snug text-ink">{listener.progress?.phase === 'download' ? (listener.progress.pct != null ? t('vl_getting_pct', { p: listener.progress.pct }) : t('vl_getting')) : t('vl_writing')}</p>}
            {listener.sttError && !busy && <p role="alert" data-testid="stt-fail" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('vl_stt_fail')}</p>}
            {recording && !live && !busy && text.trim() && stage === 'listen' && <p className="mt-3 text-[14.5px] text-ink-soft" data-testid="check-words">{t('vl_check_text')}</p>}
            {live && recording && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => void listener.finish()} data-testid="stop-recording" className="btn-primary mt-4 w-full"><Check size={20} /> {t('vent_done')}</motion.button>
            )}
            {live && listener.hint && (
              <div role="status" data-testid="mic-hint" className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">
                <p>{t(listener.hint === 'no_audio' ? 'mic_no_audio' : 'mic_no_words')}</p>
                <button onClick={() => { void listener.finish(); setTyping(true) }} className="mt-2 min-h-[44px] rounded-full bg-white/80 px-4 text-[14.5px] font-semibold text-ink">{t('vl_type_now')}</button>
              </div>
            )}
            {local && <p data-testid="local-note" className="mt-3 text-center text-[13.5px] text-ink-soft">{t('vl_local')}</p>}
            {!listener.supported && <p role="status" data-testid="mic-help" className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">{t('mic_unsupported')}</p>}
            {listener.usedLang !== SPEECH_LANG[lang] && <p role="status" data-testid="lang-fallback" className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">{t('mic_langfb', { l: listener.usedLang === SPEECH_LANG.en ? 'English' : 'हिन्दी' })}</p>}
            {noneFound && <p role="status" className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">{t('vl_none')}</p>}
            {listener.error && !live && <p role="status" data-testid="mic-help" className="mt-3 rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F]">{t(micKey(listener.error))}</p>}
            {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t(err)}</p>}
            {text.trim() && stage !== 'sending' && !busy && !(live && recording) && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => void submit()} className={`mt-4 w-full ${live ? 'btn-ghost' : 'btn-primary'}`}>
                <Check size={20} /> {t('vent_done')}
              </motion.button>
            )}
            {noneFound && <button onClick={reset} className="btn-ghost mt-3 w-full">{t('vl_nosave')}</button>}
          </motion.div>
        )}

        {stage === 'confirm' && (
          <motion.div key="confirm" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative px-5 pb-8">
            <div className="mb-4 mt-1 flex items-center gap-3">
              <Orb size={64} />
              <div>
                <h1 className="text-[24px] font-bold leading-tight">{t('vent_confirm')}</h1>
                <p className="flex items-center gap-1.5 text-[15px] text-ink-soft"><Pencil size={14} /> {t('vent_confirm_s')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              {proposals.map((p, i) => {
                const sel = selection[p.id]
                if (!sel) return null
                const lv = sel.level
                return (
                  <motion.div key={p.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }} className={`glass rounded-2xl p-3 ${sel.on ? '' : 'opacity-50'}`}>
                    <div className="flex items-center gap-3">
                      <button role="checkbox" aria-checked={sel.on} aria-label={`${t('vl_include')}: ${t(symKey(p.symptom))}`} onClick={() => setSelection((s) => ({ ...s, [p.id]: { ...s[p.id], on: !s[p.id].on } }))} className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 ${sel.on ? 'border-rose bg-rose text-white' : 'border-[#D9B9C5]'}`}>
                        {sel.on && <Check size={17} strokeWidth={3} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[16px] font-semibold leading-tight ${sel.on ? '' : 'line-through'}`}>{t(symKey(p.symptom))}</div>
                        <div className="text-[12.5px] text-ink-soft">{mrsLabel(p.mrsItem)}{p.time !== 'unspecified' && ` · ${t(`tm_${p.time}` as StrKey)}`}</div>
                      </div>
                      <button aria-label={`${t(symKey(p.symptom))}: ${t(LEVEL_KEY[lv])}`} onClick={() => setSelection((s) => ({ ...s, [p.id]: { ...s[p.id], level: (s[p.id].level % 4) + 1 } }))} className="flex min-h-[48px] items-center gap-2 rounded-full bg-white/80 px-3">
                        <span className="flex gap-1">{[1, 2, 3, 4].map((n) => <span key={n} className="h-2.5 w-2.5 rounded-full" style={{ background: n <= lv ? LEVEL_DOT[lv] : '#EADCE2' }} />)}</span>
                        <span className="w-[66px] text-left text-[14px] font-medium">{t(LEVEL_KEY[lv])}</span>
                      </button>
                    </div>
                    <button aria-label={t('vl_trigger')} onClick={() => setSelection((s) => ({ ...s, [p.id]: { ...s[p.id], trigger: TRIGGERS[(TRIGGERS.indexOf(s[p.id].trigger as (typeof TRIGGERS)[number]) + 1) % TRIGGERS.length] } }))} className="mt-2 ml-12 min-h-[40px] rounded-full bg-white/70 px-3 text-[13.5px] font-medium text-ink-soft">
                      {t('vl_trigger')}: {t(trgKey(sel.trigger))}
                    </button>
                  </motion.div>
                )
              })}
            </div>
            {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t(err)}</p>}
            <button onClick={() => void save()} className="btn-primary mt-5 w-full"><Heart size={20} /> {t('vent_save')}</button>
            <button onClick={() => { setStage('listen') }} className="btn-ghost mt-3 w-full">{t('vl_edit')}</button>
          </motion.div>
        )}

        {stage === 'reflect' && (
          <motion.div key="reflect" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative flex flex-col items-center px-5 pb-8">
            <div className="mt-2"><Orb size={112} label={<Sparkles size={26} className="text-rose-pressed" />} /></div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#E3F3EA] px-3 py-1.5 text-[14px] font-medium text-[#24563F]"><Check size={16} /> {t('vl_saved')}</motion.div>
            <div className="glass-strong relative mt-4 w-full rounded-[28px] p-5">
              <div className="mb-2 flex items-center justify-between"><span className="text-[14px] font-semibold text-rose-pressed">{t('vent_says')}</span>
                <button aria-label={t('vl_speak')} onClick={() => speak(reflection, lang)} className="grid h-10 w-10 place-items-center rounded-full bg-white/80"><Volume2 size={18} /></button></div>
              <p className="min-h-[110px] text-[18px] leading-relaxed" data-testid="reflection">{reflection}</p>
              <VoiceNote className="mt-2" />
            </div>
            <button onClick={() => go('/translator')} className="btn-primary mt-5 w-full">{t('vent_yes_say')}</button>
            <div className="mt-3 grid w-full grid-cols-2 gap-3">
              <button onClick={() => go('/right-now')} className="btn-ghost"><Snowflake size={18} className="text-peri-deep" /> {t('rightnow')}</button>
              <button onClick={() => { clearHandoff(); go('/home') }} className="btn-ghost">{t('not_now')}</button>
            </div>
          </motion.div>
        )}

        {stage === 'refusal' && (
          <motion.div key="refusal" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-col items-center px-5 pb-8">
            <div className="mt-2"><Orb size={96} /></div>
            <div className="glass-strong mt-5 w-full rounded-[28px] p-5">
              <div className="mb-2 text-[14px] font-semibold text-rose-pressed">{t('vl_ref_title')}</div>
              <p className="text-[18px] leading-relaxed" data-testid="refusal">{refusal}</p>
            </div>
            <button onClick={reset} className="btn-primary mt-5 w-full">{t('continue')}</button>
          </motion.div>
        )}

        {stage === 'crisis' && crisis && (
          <motion.div key="crisis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} role="alert" className="relative flex flex-col px-5 pb-8">
            <h1 className="mt-4 text-[28px] font-bold leading-tight">{t('cr_title')}</h1>
            <p className="mt-3 text-[20px] leading-relaxed" data-testid="crisis-message">{crisis.message}</p>
            <div className="mt-6 flex flex-col gap-3">
              {crisis.helplines.map((h) => (
                <a key={h.number} href={`tel:${h.number}`} className="btn-primary w-full"><Phone size={20} /> {t('cr_call', { name: h.name, number: h.number })}</a>
              ))}
            </div>
            <p className="mt-5 text-[14.5px] text-ink-soft">{t('cr_note')}</p>
            <button onClick={reset} className="btn-ghost mt-4 w-full">{t('cr_ok')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  )
}
