import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Check, Lock, RefreshCw, Send, Smartphone, Sparkles } from 'lucide-react'
import { useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Screen, Segmented, TopBar } from '../components/ui'
import { useEmbedded, useGo, useParam } from '../components/nav'
import { useLive } from '../api/session'
import TranslatorLive from './TranslatorLive'
import { SignalCard, FlyAway } from '../family/cards'
import { transcript } from '../mock/vent'

type Tone = 'gentle' | 'direct' | 'light'
const TONE_MSG: Record<Tone, StrKey> = { gentle: 'tr_msg', direct: 'tr_msg_direct', light: 'tr_msg_light' }

export type TranslatorStage = 'compose' | 'sent'

/** Live when logged in; demo, screenshots and static hosting keep the scripted version. */
export default function Translator(props: { stage?: TranslatorStage }) {
  const live = useLive()
  const embedded = useEmbedded()
  const forced = useParam('stage')
  return live && !embedded && !props.stage && !forced ? <TranslatorLive /> : <TranslatorMock {...props} />
}

function TranslatorMock({ stage: stageProp }: { stage?: TranslatorStage }) {
  const { t, lang } = useI18n()
  const go = useGo()
  const q = useParam('stage') as TranslatorStage | null
  const [stage, setStage] = useState<TranslatorStage>(stageProp ?? q ?? 'compose')
  const [tone, setTone] = useState<Tone>('gentle')
  const [to, setTo] = useState<Record<string, boolean>>({ rajesh: true })
  useEffect(() => { if (stageProp) setStage(stageProp) }, [stageProp])

  const msg = t(TONE_MSG[tone])
  const words = msg.split(' ')
  const [n, setN] = useState(words.length)
  useEffect(() => {
    setN(0)
    const id = window.setInterval(() => setN((x) => (x >= words.length ? x : x + 1)), 90)
    return () => window.clearInterval(id)
  }, [msg, words.length])

  return (
    <Screen bg="wash" header={<TopBar title={t('sayit')} />}>
      <AnimatePresence mode="wait">
        {stage === 'compose' ? (
          <motion.div key="c" exit={{ opacity: 0, y: -10 }} className="px-5 pb-8">
            {/* her raw words, kept private */}
            <div className="rounded-[22px] border border-white/70 bg-white/45 p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><Lock size={14} /> {t('tr_yours')}</div>
              <p className="line-clamp-3 text-[15px] leading-relaxed text-ink-soft">{transcript[lang]}</p>
            </div>

            <div className="my-2 flex items-center justify-center gap-2 text-[14px] font-medium text-rose-pressed">
              <motion.span animate={{ y: [0, 4, 0] }} transition={{ duration: 1.6, repeat: Infinity }}><ArrowDown size={18} /></motion.span>
              <Sparkles size={16} /> {t('tr_becomes')}
            </div>

            {/* the calm sentence */}
            <motion.div layout className="relative overflow-hidden rounded-[28px] bg-white p-5 shadow-soft">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-peach-light opacity-70 blur-2xl" />
              <p className="relative min-h-[96px] text-[21px] font-semibold leading-snug">
                {words.slice(0, n).join(' ')}
                {n < words.length && <span className="ml-0.5 inline-block h-6 w-0.5 translate-y-1 animate-pulse bg-rose" />}
              </p>
              <div className="relative mt-3 flex items-center justify-between gap-2">
                <Segmented value={tone} onChange={setTone} options={[{ id: 'gentle', label: t('tone_gentle') }, { id: 'direct', label: t('tone_direct') }, { id: 'light', label: t('tone_light') }]} />
                <button aria-label={t('tr_rephrase')} onClick={() => setTone((x) => (x === 'gentle' ? 'direct' : x === 'direct' ? 'light' : 'gentle'))} className="icon-btn shrink-0"><RefreshCw size={18} /></button>
              </div>
            </motion.div>

            <div className="mb-2 mt-5 text-[15px] font-semibold">{t('tr_to')}</div>
            <div className="flex flex-wrap gap-2">
              {([['rajesh', 'R', '#FFDFC3', 'rel_husband'], ['anaya', 'A', '#E6D6F5', 'rel_daughter']] as const).map(([id, init, tint, rel]) => {
                const on = !!to[id]
                return (
                  <button key={id} onClick={() => setTo((s) => ({ ...s, [id]: !s[id] }))} className={`flex min-h-[52px] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 transition ${on ? 'bg-white shadow-card ring-2 ring-rose' : 'bg-white/55'}`}>
                    <span className="grid h-10 w-10 place-items-center rounded-full text-[15px] font-bold text-ink" style={{ background: tint }}>{init}</span>
                    <span className="text-left leading-tight">
                      <span className="block text-[15px] font-semibold">{t(id)}</span>
                      <span className="block text-[12.5px] text-ink-soft">{t(rel)}</span>
                    </span>
                    {on && <Check size={18} className="text-rose" />}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 text-center text-[15px] text-ink-soft">{t('tr_approve')}</div>
            <button onClick={() => setStage('sent')} className="btn-primary mt-2 w-full"><Send size={19} /> {t('tr_send')}</button>
          </motion.div>
        ) : (
          <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative px-5 pb-8">
            <FlyAway />
            <div className="flex flex-col items-center pt-4 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.3 }} className="grid h-20 w-20 place-items-center rounded-full bg-rose text-white shadow-soft">
                <Check size={40} strokeWidth={3} />
              </motion.span>
              <h1 className="mt-4 px-4 text-[22px] font-bold leading-snug">{t('tr_sent')}</h1>
            </div>
            <div className="mb-2 mt-6 text-[15px] font-semibold">{t('tr_preview')}</div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <SignalCard />
            </motion.div>
            <button onClick={() => go('/family')} className="btn-primary mt-6 w-full"><Smartphone size={19} /> {t('tr_see')}</button>
            <button onClick={() => go('/home')} className="btn-ghost mt-3 w-full">{t('nav_home')}</button>
          </motion.div>
        )}
      </AnimatePresence>
    </Screen>
  )
}
