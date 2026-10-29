import { useEffect, useRef, useState } from 'react'
import { Phone, PhoneCall, PhoneOff } from 'lucide-react'
import { useI18n } from '../i18n'
import { api } from '../api/client'
import { Screen, TopBar } from '../components/ui'
import { speak, stopSpeaking, useListen } from '../voice/speech'

interface Say { text: string; pauseMs: number }
interface Resp { say: Say[]; gather?: { input: 'speech' }; hangup?: boolean }

/**
 * In-app simulator of the missed-call line. It calls the same handlers a telephony provider would
 * (Right Now script, then the safety pipeline on what she says). Nothing is saved on the call.
 */
export default function MissedCallLive() {
  const { t, lang } = useI18n()
  const [stage, setStage] = useState<'idle' | 'ringing' | 'playing' | 'listening' | 'ended'>('idle')
  const [lines, setLines] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState(false)
  const run = useRef(0)
  const listener = useListen(lang)

  useEffect(() => () => { run.current++; stopSpeaking() }, [])

  /** Speaks each line with its pause, like the phone line would. */
  const play = (r: Resp, then: () => void) => {
    const id = ++run.current
    const step = (i: number) => {
      if (id !== run.current) return
      if (i >= r.say.length) return then()
      const s = r.say[i]
      setLines((l) => [...l, s.text])
      speak(s.text, lang, () => window.setTimeout(() => step(i + 1), Math.min(s.pauseMs, 4000) / 2))
    }
    step(0)
  }

  const start = async () => {
    setErr(false); setLines([]); setStage('ringing')
    try {
      const r = await api<Resp>('POST', '/api/ivr/simulate/missed-call')
      await new Promise((ok) => window.setTimeout(ok, 800))
      setStage('playing')
      play(r, () => setStage('listening'))
    } catch { setErr(true); setStage('idle') }
  }
  const send = async () => {
    const said = (listener.listening ? listener.stop() : typed).trim()
    if (!said) return
    setStage('playing'); setTyped(''); listener.reset()
    try { const r = await api<Resp>('POST', '/api/ivr/simulate/speech', { transcript: said }); play(r, () => setStage('ended')) }
    catch { setErr(true); setStage('ended') }
  }
  const hangUp = () => { run.current++; stopSpeaking(); setStage('ended') }

  return (
    <Screen bg="wash" header={<TopBar title={t('t_missed')} />}>
      <div className="px-5 pb-10">
        <p className="text-center text-[15.5px] leading-relaxed text-ink-soft">{t('mc_sim_sub')}</p>
        <div className="mt-4 rounded-[28px] bg-ink p-5 text-white shadow-soft" data-testid="phone">
          <div className="flex items-center gap-3">
            <span className={`grid h-14 w-14 place-items-center rounded-full ${stage === 'ringing' ? 'animate-pulse bg-[#2F6B4F]' : 'bg-white/15'}`}><PhoneCall size={26} /></span>
            <div className="min-w-0">
              <div className="text-[18px] font-semibold">Sakhi</div>
              <div className="text-[14px] text-[#E9D3DD]" role="status">{stage === 'ringing' ? t('mc_ringing') : stage === 'listening' ? t('mc_listening') : stage === 'ended' ? t('mc_ended') : stage === 'playing' ? '…' : ''}</div>
            </div>
          </div>
          <ul className="mt-4 flex max-h-[260px] flex-col gap-1.5 overflow-y-auto text-[16px] leading-snug" data-testid="captions" aria-live="polite">
            {lines.map((l, i) => <li key={i} className="rounded-2xl bg-white/10 px-3 py-2">{l}</li>)}
          </ul>
        </div>

        {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}

        {(stage === 'idle' || stage === 'ended') && <button onClick={() => void start()} className="btn-primary mt-4 w-full"><Phone size={19} /> {stage === 'idle' ? t('mc_start') : t('mc_again')}</button>}
        {stage === 'listening' && (
          <div className="mt-4 flex flex-col gap-2">
            <textarea aria-label={t('mc_listening')} value={listener.listening ? listener.text : typed} readOnly={listener.listening} onChange={(e) => setTyped(e.target.value)} rows={3} maxLength={400} placeholder={t('rh_ph')} className="w-full resize-none rounded-2xl border border-[#E7CBD3] bg-white/90 p-3 text-[16px] outline-none focus:border-rose" />
            <div className="flex gap-2">
              {listener.supported && <button aria-label="Microphone" onClick={() => { if (listener.listening) setTyped(listener.stop()); else { listener.reset(); listener.start() } }} className={`grid h-12 w-12 place-items-center rounded-full ${listener.listening ? 'bg-rose text-white' : 'bg-white text-rose-pressed'}`}><Phone size={18} /></button>}
              <button onClick={() => void send()} disabled={!(listener.listening ? listener.text : typed).trim()} className="btn-primary min-h-[48px] flex-1 disabled:opacity-50">{t('rh_say')}</button>
            </div>
          </div>
        )}
        {(stage === 'playing' || stage === 'listening' || stage === 'ringing') && <button onClick={hangUp} className="btn-ghost mt-3 w-full"><PhoneOff size={18} /> {t('mc_hang')}</button>}
        <p className="mt-4 text-center text-[13.5px] leading-snug text-ink-soft">{t('mc_note')}</p>
      </div>
    </Screen>
  )
}
