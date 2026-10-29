import { useEffect, useState } from 'react'
import { useLive } from '../api/session'
import { useEmbedded } from '../components/nav'
import MissedCallLive from './MissedCallLive'
import { AnimatePresence, motion } from 'framer-motion'
import { Grid3x3, Mic, MicOff, Phone, PhoneIncoming, PhoneOff, Volume2, WifiOff } from 'lucide-react'
import { useI18n } from '../i18n'
import { Screen, TopBar, Waveform } from '../components/ui'
import { useParam } from '../components/nav'

type Stage = 'idle' | 'dialing' | 'missed' | 'incoming' | 'playing'

function FeaturePhone() {
  return (
    <svg viewBox="0 0 120 200" className="h-[190px] w-[114px]" aria-hidden>
      <rect x="10" y="4" width="100" height="192" rx="26" fill="#3B1F2B" />
      <rect x="20" y="20" width="80" height="66" rx="10" fill="#FFDFC3" />
      <path d="M44 56 C44 48 52 44 60 52 C68 44 76 48 76 56 C76 64 66 70 60 74 C54 70 44 64 44 56Z" fill="#D6336C" />
      {Array.from({ length: 12 }).map((_, i) => (
        <rect key={i} x={24 + (i % 3) * 26} y={100 + Math.floor(i / 3) * 22} width="20" height="14" rx="7" fill={i === 4 ? '#FEA38E' : '#6B4A57'} />
      ))}
    </svg>
  )
}

/** Live simulator when logged in (same handlers as the telephony webhooks); demo/screenshots/static hosting keep the scripted screen. */
export default function MissedCall() {
  const live = useLive()
  const embedded = useEmbedded()
  return live && !embedded ? <MissedCallLive /> : <MissedCallMock />
}

function MissedCallMock() {
  const { t } = useI18n()
  const q = useParam('stage') as Stage | null
  const [stage, setStage] = useState<Stage>(q ?? 'idle')
  const [secs, setSecs] = useState(q === 'playing' ? 12 : 0)

  useEffect(() => {
    if (q) return
    if (stage === 'dialing') { const id = setTimeout(() => setStage('missed'), 2200); return () => clearTimeout(id) }
    if (stage === 'missed') { const id = setTimeout(() => setStage('incoming'), 1600); return () => clearTimeout(id) }
  }, [stage, q])
  useEffect(() => {
    if (stage !== 'playing') return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [stage])

  if (stage === 'idle')
    return (
      <Screen bg="wash" header={<TopBar title={t('t_missed')} />}>
        <div className="flex flex-col items-center px-6 pb-10 text-center">
          <div className="relative mt-2 grid h-[250px] w-[250px] place-items-center rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,223,195,0.6) 55%, rgba(255,255,255,0) 72%)' }}>
            <div className="floaty"><FeaturePhone /></div>
            <span className="absolute right-6 top-10 grid h-12 w-12 place-items-center rounded-full bg-white shadow-card"><WifiOff size={20} className="text-ink-soft" /></span>
          </div>
          <h1 className="mt-2 text-[28px] font-bold">{t('mc_title')}</h1>
          <p className="mt-2 text-[17px] leading-relaxed text-ink-soft">{t('mc_sub')}</p>
          <div className="glass mt-5 w-full rounded-[24px] p-4 text-left">
            {[
              ['1', t('mc_give')],
              ['2', t('mc_incoming')],
              ['3', t('rightnow') + ' · ' + t('rn_sub')],
            ].map(([n, txt]) => (
              <div key={n} className="flex items-center gap-3 py-1.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-peach-light text-[14px] font-bold text-rose-pressed">{n}</span>
                <span className="text-[15px] leading-snug">{txt}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setStage('dialing')} className="btn-primary mt-6 w-full"><Phone size={19} /> {t('mc_give')}</button>
          <p className="mt-3 text-[14px] text-ink-soft">{t('mc_works')}</p>
        </div>
      </Screen>
    )

  const mm = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  return (
    <Screen bg="night" tone="light" backdrop={<div className="absolute inset-0" style={{ background: 'radial-gradient(500px 400px at 50% 25%, #7A2E52 0%, rgba(122,46,82,0) 70%), linear-gradient(180deg, #3B1F2B 0%, #241119 100%)' }} />} className="flex flex-col">
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <div className="relative grid h-28 w-28 place-items-center">
          {(stage === 'incoming' || stage === 'dialing') &&
            [0, 1].map((i) => (
              <motion.span key={i} className="absolute inset-0 rounded-full border-2 border-white/40" animate={{ scale: [1, 1.6], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.9 }} />
            ))}
          <span className="grid h-28 w-28 place-items-center rounded-full" style={{ background: 'radial-gradient(circle at 35% 30%, #FFF, #FCD6DC 55%, #F7B7C6)' }}>
            <img src="./favicon.svg" alt="" className="h-16 w-16" />
          </span>
        </div>
        <div className="mt-5 text-[28px] font-semibold text-white">{t('mc_title')}</div>
        <AnimatePresence mode="wait">
          <motion.div key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 text-[17px] text-[#F0D9E3]">
            {stage === 'dialing' && t('mc_dialing')}
            {stage === 'missed' && t('mc_missed')}
            {stage === 'incoming' && (
              <span className="inline-flex items-center gap-2"><PhoneIncoming size={18} /> {t('mc_incoming')}</span>
            )}
            {stage === 'playing' && <span className="tabular-nums">{mm} · {t('mc_playing')}</span>}
          </motion.div>
        </AnimatePresence>
      </div>

      {stage === 'playing' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-8 px-6">
          <Waveform bars={36} active height={54} color="#FBA2AB" />
          <p className="mt-6 text-center text-[22px] font-medium leading-snug text-white">“{t('mc_line')}”</p>
          <div className="mx-auto mt-6 w-fit rounded-full bg-white/10 px-4 py-2 text-[14px] text-[#F0D9E3]">{t('mc_keys')}</div>
        </motion.div>
      )}

      <div className="mt-auto px-10 pb-14">
        {stage === 'incoming' ? (
          <div className="flex justify-between">
            <div className="flex flex-col items-center gap-2">
              <button aria-label={t('mc_end')} onClick={() => setStage('idle')} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-rose text-white"><PhoneOff size={28} /></button>
              <span className="text-[15px] text-white">{t('mc_end')}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <motion.button aria-label={t('mc_answer')} onClick={() => setStage('playing')} animate={{ y: [0, -6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-[#2E8B5E] text-white"><Phone size={28} /></motion.button>
              <span className="text-[15px] text-white">{t('mc_answer')}</span>
            </div>
          </div>
        ) : (
          <>
            {stage === 'playing' && (
              <div className="mb-8 flex justify-between">
                {[MicOff, Grid3x3, Volume2].map((I, i) => (
                  <span key={i} className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-white"><I size={24} /></span>
                ))}
              </div>
            )}
            <div className="flex justify-center">
              <button aria-label={t('mc_end')} onClick={() => setStage('idle')} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-rose text-white"><PhoneOff size={28} /></button>
            </div>
          </>
        )}
        {stage === 'dialing' && <div className="mt-4 flex justify-center text-[#F0D9E3]"><Mic size={16} /></div>}
      </div>
    </Screen>
  )
}
