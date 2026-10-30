import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, Heart, Pencil, Snowflake, Sparkles } from 'lucide-react'
import { LANGS, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Orb, Screen, TopBar, Waveform } from '../components/ui'
import { useEmbedded, useGo, useParam } from '../components/nav'
import { useLive, useSession } from '../api/session'
import VentLive from './VentLive'
import { detected, transcript, type Detected } from '../mock/vent'

export type VentStage = 'idle' | 'listening' | 'heard' | 'confirm' | 'reflect'

const SLOTS: Record<string, React.CSSProperties> = {
  sleep: { left: 14, top: 4 },
  hot: { right: 14, top: 34 },
  exhaust: { left: 4, top: 138 },
  joint: { right: 4, top: 152 },
  irrit: { left: 18, top: 262 },
  mood: { right: 18, top: 286 },
}
const LEVEL_DOT = ['', '#FFC56B', '#FEA38E', '#D6336C']
const LEVEL_KEY: StrKey[] = ['sev_mild', 'sev_mild', 'sev_moderate', 'sev_severe']

function SymptomChip({ d }: { d: Detected }) {
  const { t } = useI18n()
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: [0, -4, 0] }}
      transition={{ opacity: { duration: 0.3 }, scale: { type: 'spring', stiffness: 300, damping: 18 }, y: { duration: 3 + (d.angle % 5) / 3, repeat: Infinity, ease: 'easeInOut' } }}
      className="glass-strong absolute z-20 flex max-w-[172px] items-start gap-2 rounded-2xl px-3 py-2"
      style={SLOTS[d.id]}
    >
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: LEVEL_DOT[d.level] }} />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-tight">{t(d.label)}</span>
        <span className="block text-[12.5px] leading-tight text-ink-soft">{t(d.sev)} · {d.mrs}</span>
      </span>
    </motion.div>
  )
}

/** Live when logged in (real voice, rules, confirm-to-save). Demo, screenshots and static hosting keep the scripted version. */
export default function Vent(props: { stage?: VentStage }) {
  const live = useLive()
  const embedded = useEmbedded()
  const forced = useParam('stage')
  const { status } = useSession()
  if (embedded || props.stage || forced) return <VentMock {...props} />
  if (live) return <VentLive />
  // static hosting / no API: the real microphone and the same safety rules run in the browser, kept on this device
  if (status === 'offline' || status === 'netdown') return <VentLive local />
  return <VentMock {...props} />
}

function VentMock({ stage: stageProp }: { stage?: VentStage }) {
  const { t, lang } = useI18n()
  const go = useGo()
  const qStage = useParam('stage') as VentStage | null
  const qP = useParam('p')
  const [stage, setStage] = useState<VentStage>(stageProp ?? qStage ?? 'listening')
  const frozen = qP != null
  const [progress, setProgress] = useState(() => (qP ? +qP : stage === 'listening' || stage === 'idle' ? 0 : 1))
  const words = useMemo(() => transcript[lang].split(' '), [lang])

  useEffect(() => { if (stageProp) setStage(stageProp) }, [stageProp])

  useEffect(() => {
    if (stage !== 'listening' || frozen) return
    const id = window.setInterval(() => {
      setProgress((p) => {
        const np = Math.min(1, p + 1 / (words.length * 1.15))
        if (np >= 1) window.setTimeout(() => setStage((s) => (s === 'listening' ? 'heard' : s)), 300)
        return np
      })
    }, 230)
    return () => window.clearInterval(id)
  }, [stage, frozen, words.length])

  const shownWords = Math.floor(progress * words.length)
  const chips = detected.filter((d) => progress >= d.at)
  const live = stage === 'listening' && !(frozen && progress >= 1)
  const secs = Math.round(progress * 26)
  const langLabel = LANGS.find((l) => l.id === lang)!.native

  return (
    <Screen
      bg="wash"
      header={
        <TopBar
          title={t('vent')}
          right={<span className="rounded-full bg-white/75 px-3 py-1.5 text-[13px] font-semibold text-ink">{langLabel}</span>}
        />
      }
    >
      <div className="pointer-events-none absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-[#FBB3C0] opacity-40 blur-3xl" />
      <AnimatePresence mode="wait">
        {(stage === 'idle' || stage === 'listening' || stage === 'heard') && (
          <motion.div key="listen" exit={{ opacity: 0, y: -10 }} className="relative px-5 pb-8">
            <div className="relative h-[340px]">
              {chips.map((d) => (
                <SymptomChip key={d.id} d={d} />
              ))}
              <div className="absolute left-1/2 top-[170px] z-30 -translate-x-1/2 -translate-y-1/2">
                <Orb
                  size={124}
                  active={live}
                  label={stage === 'idle' ? t('tap_speak') : t('listening')}
                  sub={live ? `0:${String(secs).padStart(2, '0')}` : undefined}
                  onClick={() => (stage === 'idle' ? setStage('listening') : setStage('confirm'))}
                />
              </div>
            </div>

            <div className="glass rounded-[26px] p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[14px] font-semibold text-rose-pressed">{t('vent_heard')}</span>
                {live ? (
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-rose" /> {t('vent_listening')}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[13px] font-medium text-ink-soft"><Check size={14} /> 0:26</span>
                )}
              </div>
              <Waveform bars={40} active={live} height={30} className="mb-2" />
              <p className="min-h-[104px] text-[17px] leading-relaxed">
                {stage === 'idle' ? (
                  <span className="text-ink-soft">{t('vent_idle')}</span>
                ) : (
                  words.slice(0, shownWords).map((w, i) => (
                    <motion.span key={i} initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.35 }} className={i === shownWords - 1 && live ? 'rounded bg-blush/50' : ''}>
                      {w}{' '}
                    </motion.span>
                  ))
                )}
              </p>
            </div>
            {stage !== 'idle' && (
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={() => setStage('confirm')}
                className={`mt-4 w-full ${stage === 'heard' || (frozen && progress >= 1) ? 'btn-primary' : 'btn-ghost'}`}
              >
                <Check size={20} /> {t('vent_done')}
              </motion.button>
            )}
          </motion.div>
        )}

        {stage === 'confirm' && <Confirm key="confirm" onSave={() => setStage('reflect')} />}
        {stage === 'reflect' && <Reflect key="reflect" onSay={() => go('/translator')} onCool={() => go('/right-now')} onLater={() => go('/home')} />}
      </AnimatePresence>
    </Screen>
  )
}

function Confirm({ onSave }: { onSave: () => void }) {
  const { t } = useI18n()
  const [levels, setLevels] = useState<Record<string, number>>(() => Object.fromEntries(detected.map((d) => [d.id, d.level])))
  const [off, setOff] = useState<Record<string, boolean>>({})
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative px-5 pb-8">
      <div className="mb-4 mt-1 flex items-center gap-3">
        <Orb size={64} />
        <div>
          <h1 className="text-[24px] font-bold leading-tight">{t('vent_confirm')}</h1>
          <p className="flex items-center gap-1.5 text-[15px] text-ink-soft"><Pencil size={14} /> {t('vent_confirm_s')}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        {detected.map((d, i) => {
          const lv = levels[d.id]
          const removed = off[d.id]
          return (
            <motion.div key={d.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }} className={`glass flex items-center gap-3 rounded-2xl p-3 ${removed ? 'opacity-50' : ''}`}>
              <button onClick={() => setOff((o) => ({ ...o, [d.id]: !o[d.id] }))} aria-label="Include" className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 ${removed ? 'border-[#D9B9C5]' : 'border-rose bg-rose text-white'}`}>
                {!removed && <Check size={15} strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className={`text-[16px] font-semibold leading-tight ${removed ? 'line-through' : ''}`}>{t(d.label)}</div>
                <div className="text-[12.5px] text-ink-soft">{d.mrs} · {d.domain}</div>
              </div>
              <button onClick={() => setLevels((l) => ({ ...l, [d.id]: (l[d.id] % 3) + 1 }))} className="flex min-h-[44px] items-center gap-2 rounded-full bg-white/80 px-3">
                <span className="flex gap-1">
                  {[1, 2, 3].map((n) => (
                    <span key={n} className="h-2.5 w-2.5 rounded-full" style={{ background: n <= lv ? LEVEL_DOT[lv] : '#EADCE2' }} />
                  ))}
                </span>
                <span className="w-[62px] text-left text-[14px] font-medium">{d.id === 'sleep' && lv === 3 ? t('sev_poor') : t(LEVEL_KEY[lv])}</span>
              </button>
            </motion.div>
          )
        })}
      </div>
      <button onClick={onSave} className="btn-primary mt-5 w-full"><Heart size={20} /> {t('vent_save')}</button>
    </motion.div>
  )
}

function Reflect({ onSay, onCool, onLater }: { onSay: () => void; onCool: () => void; onLater: () => void }) {
  const { t } = useI18n()
  const text = t('vent_reflect')
  const words = text.split(' ')
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = window.setInterval(() => setN((x) => (x >= words.length ? x : x + 1)), 70)
    return () => window.clearInterval(id)
  }, [text, words.length])
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative flex flex-col items-center px-5 pb-8">
      <div className="mt-2"><Orb size={112} label={<Sparkles size={26} className="text-rose-pressed" />} /></div>
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#E3F3EA] px-3 py-1.5 text-[14px] font-medium text-[#24563F]">
        <Check size={16} /> {t('vent_saved')}
      </motion.div>
      <div className="glass-strong relative mt-4 w-full rounded-[28px] p-5">
        <div className="mb-2 text-[14px] font-semibold text-rose-pressed">{t('vent_says')}</div>
        <p className="min-h-[150px] text-[18px] leading-relaxed">
          {words.slice(0, n).join(' ')}
          {n < words.length && <span className="ml-0.5 inline-block h-5 w-0.5 translate-y-1 animate-pulse bg-rose" />}
        </p>
      </div>
      <button onClick={onSay} className="btn-primary mt-5 w-full">{t('vent_yes_say')}</button>
      <div className="mt-3 grid w-full grid-cols-2 gap-3">
        <button onClick={onCool} className="btn-ghost"><Snowflake size={18} className="text-peri-deep" /> {t('rightnow')}</button>
        <button onClick={onLater} className="btn-ghost">{t('not_now')}</button>
      </div>
    </motion.div>
  )
}
