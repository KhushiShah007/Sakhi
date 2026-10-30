import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { BellOff, Moon, Snowflake, Volume2, X } from 'lucide-react'
import { useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { apiQueued } from '../api/queue'
import { Orb, Screen } from '../components/ui'
import { useGo } from '../components/nav'
import VoiceNote from '../components/VoiceNote'
import { speak, stopSpeaking } from '../voice/speech'

const WIND: StrKey[] = ['rx_1', 'rx_2', 'rx_3', 'rx_6']
const stars = [[40, 70], [320, 50], [280, 140], [70, 190], [350, 230], [24, 300], [200, 30]]

/**
 * Live 3 AM Mode: dim and quiet. Counts how long she has been awake; when she says she is going back to sleep
 * she can save that as a night waking (her tap is the confirmation). No notifications, no sounds unless she asks.
 */
export default function ThreeAMLive() {
  const { t, lang } = useI18n()
  const go = useGo()
  const started = useRef(Date.now())
  const [now, setNow] = useState(new Date())
  const [guiding, setGuiding] = useState(false)
  const [caption, setCaption] = useState('')
  const [stage, setStage] = useState<'awake' | 'ask' | 'saved'>('awake')
  const [minutes, setMinutes] = useState(1)
  const [err, setErr] = useState(false)
  const run = useRef(0)

  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 15_000); return () => { window.clearInterval(id); run.current++; stopSpeaking() } }, [])

  const guide = (i = 0) => {
    const id = ++run.current
    setGuiding(true); setCaption(t(WIND[i]))
    speak(t(WIND[i]), lang, () => {
      if (id !== run.current) return
      if (i + 1 < WIND.length) window.setTimeout(() => id === run.current && guide(i + 1), 3000)
      else { setGuiding(false); setCaption('') } // plays once, then stops
    })
  }
  const stopGuide = () => { run.current++; stopSpeaking(); setGuiding(false); setCaption('') }
  const goBackToSleep = () => { stopGuide(); setMinutes(Math.max(1, Math.round((Date.now() - started.current) / 60_000))); setStage('ask') }
  const save = async () => { try { await apiQueued('POST', '/api/awakenings', { minutes }); setStage('saved') } catch { setErr(true) } }
  const awake = Math.max(1, Math.round((now.getTime() - started.current) / 60_000))
  const clock = now.toLocaleTimeString(`${lang}-IN`, { hour: 'numeric', minute: '2-digit' })

  return (
    <Screen bg="night" tone="night" className="flex flex-col">
      {stars.map(([x, y], i) => <motion.span key={i} className="absolute h-1 w-1 rounded-full bg-[#F3E8FB]" style={{ left: x, top: y }} animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ duration: 3 + i, repeat: Infinity }} />)}
      <div className="pointer-events-none absolute left-1/2 top-[330px] h-80 w-80 -translate-x-1/2 rounded-full bg-[#5A1F3B] opacity-40 blur-3xl" />
      <div className="relative flex items-center justify-between px-5 pt-2">
        <span className="flex items-center gap-2 text-[14px] text-[#BFA3B1]"><Moon size={16} /> {t('t_3am')}</span>
        <button onClick={() => { stopGuide(); go('/home') }} className="flex min-h-[44px] items-center gap-1 rounded-full bg-white/5 px-4 text-[14px] text-[#CDB3C0]"><X size={16} /> {t('exit')}</button>
      </div>

      <div className="relative mt-6 text-center">
        <div className="text-[64px] font-extralight leading-none tracking-tight text-[#E9D3DD]" data-testid="clock">{clock}</div>
        <h1 className="mt-5 px-8 text-[24px] font-semibold leading-snug text-[#EBD5DF]">{t('n_title')}</h1>
        <p className="mt-2 px-10 text-[16px] leading-relaxed text-[#BFA3B1]">{t('n_sub')}</p>
        {stage === 'awake' && <p className="mt-3 text-[14.5px] text-[#A88C9A]" data-testid="awake-for">{t('n_awake', { m: awake })}</p>}
      </div>

      {stage === 'awake' && (
        <>
          <div className="relative mt-6 flex justify-center"><Orb night size={150} active={guiding} label={guiding ? t('n_stop') : t('n_wind')} onClick={() => (guiding ? stopGuide() : guide())} /></div>
          {guiding && <p aria-live="polite" data-testid="guide-caption" className="relative mx-8 mt-4 text-center text-[18px] leading-relaxed text-[#E2CDD8]">{caption}</p>}
          {guiding && <VoiceNote className="relative mx-6 mt-3 opacity-90" />}
          <div className="relative mt-auto px-5 pb-8">
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={() => { stopGuide(); go('/right-now') }} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.08] text-[14px] text-[#E2CDD8]"><Snowflake size={20} className="text-[#E7A9C0]" /> {t('n_cool')}</button>
              <button onClick={() => (guiding ? stopGuide() : guide())} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.08] text-[14px] text-[#E2CDD8]"><Volume2 size={20} className="text-[#E7A9C0]" /> {guiding ? t('n_stop') : t('n_wind')}</button>
            </div>
            <button onClick={goBackToSleep} className="mt-3 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[#E7A9C0] px-4 text-[16px] font-semibold text-[#2A1020]">{t('n_back')}</button>
            <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[#A88C9A]"><BellOff size={14} /> {t('n_paused')}</div>
          </div>
        </>
      )}

      {stage === 'ask' && (
        <div className="relative mt-auto px-5 pb-10" role="dialog" aria-label={t('n_save_q', { m: minutes })}>
          <p className="text-center text-[19px] leading-snug text-[#EBD5DF]">{t('n_save_q', { m: minutes })}</p>
          {err && <p role="alert" className="mt-3 text-center text-[15px] text-[#F3B5A0]">{t('fl_error')}</p>}
          <button onClick={() => void save()} className="mt-5 flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[#E7A9C0] text-[16px] font-semibold text-[#2A1020]">{t('n_save')}</button>
          <button onClick={() => setStage('saved')} className="mt-3 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-white/[0.08] text-[15px] text-[#E2CDD8]">{t('n_skip')}</button>
        </div>
      )}
      {stage === 'saved' && (
        <div className="relative mt-auto px-5 pb-10 text-center"><p role="status" className="text-[19px] text-[#EBD5DF]">{t('n_saved')}</p><button onClick={() => go('/home')} className="mt-5 flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-white/[0.08] text-[15px] text-[#E2CDD8]">{t('tl_done_home')}</button></div>
      )}
    </Screen>
  )
}
