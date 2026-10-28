import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Pause, Play, Repeat, RotateCcw, RotateCw, Volume2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Screen, TopBar, Waveform } from '../components/ui'
import { HeroSwirls, Lotus, WaveEdge } from '../illustrations/art'

const TOTAL = 90
// 4s in, 2s hold, 6s out
function phaseAt(elapsed: number): { key: StrKey; scale: number } {
  const c = elapsed % 12
  if (c < 4) return { key: 'rn_in', scale: 1.08 }
  if (c < 6) return { key: 'rn_hold', scale: 1.08 }
  return { key: 'rn_out', scale: 0.82 }
}

export default function RightNow() {
  const { t } = useI18n()
  const [elapsed, setElapsed] = useState(24)
  const [playing, setPlaying] = useState(true)
  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => setElapsed((e) => (e >= TOTAL ? TOTAL : e + 1)), 1000)
    return () => window.clearInterval(id)
  }, [playing])
  const left = TOTAL - elapsed
  const ph = phaseAt(elapsed)
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  return (
    <Screen
      bg="ivory"
      tone="light"
      backdrop={
        <div className="absolute inset-x-0 top-0 h-[520px] waves">
          <HeroSwirls className="absolute inset-0 h-full w-full" />
          <WaveEdge className="absolute inset-x-0 bottom-0 h-10 w-full" />
        </div>
      }
    >
      <div className="relative">
        <TopBar tone="light" title={t('rightnow')} right={<button aria-label="Favourite" className="grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white"><Heart size={20} /></button>} />
        <div className="relative mx-auto mt-1 grid h-[270px] w-[270px] place-items-center">
          <motion.div
            className="absolute inset-0"
            animate={{ scale: playing ? ph.scale : 0.95, rotate: playing ? elapsed * 3 : 0 }}
            transition={{ duration: ph.key === 'rn_out' ? 6 : 4, ease: 'easeInOut' }}
          >
            <Lotus tone="light" className="h-full w-full" />
          </motion.div>
          <div className="relative text-center">
            <div className="grid h-[84px] w-[84px] place-items-center rounded-full bg-rose-pressed text-[26px] font-bold tabular-nums text-white shadow-soft ring-4 ring-white/40">{fmt(left)}</div>
          </div>
        </div>
        <div className="relative -mt-2 text-center">
          <AnimatePresence mode="wait">
            <motion.div key={ph.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="text-[22px] font-semibold text-white">
              {t(ph.key)}
            </motion.div>
          </AnimatePresence>
          <div className="text-[14px] text-white/90">{t('rn_voice')}</div>
        </div>
      </div>

      <div className="relative mt-[46px] px-6 pb-10">
        {/* progress */}
        <div className="flex items-center gap-3">
          <Volume2 size={18} className="text-ink-soft" />
          <div className="relative h-1.5 flex-1 rounded-full bg-[#F3D6DC]">
            <div className="absolute inset-y-0 left-0 rounded-full bg-rose" style={{ width: `${(elapsed / TOTAL) * 100}%` }} />
            <div className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-[3px] border-white bg-rose shadow" style={{ left: `calc(${(elapsed / TOTAL) * 100}% - 8px)` }} />
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between px-2">
          <button aria-label="Repeat" className="grid h-12 w-12 place-items-center text-ink-soft"><Repeat size={20} /></button>
          <button aria-label="Back 10 seconds" onClick={() => setElapsed((e) => Math.max(0, e - 10))} className="grid h-12 w-12 place-items-center text-ink"><RotateCcw size={22} /></button>
          <button aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)} className="grid h-[72px] w-[72px] place-items-center rounded-full bg-rose text-white shadow-soft">
            {playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" className="ml-1" />}
          </button>
          <button aria-label="Forward 10 seconds" onClick={() => setElapsed((e) => Math.min(TOTAL, e + 10))} className="grid h-12 w-12 place-items-center text-ink"><RotateCw size={22} /></button>
          <button aria-label="Favourite" className="grid h-12 w-12 place-items-center text-ink-soft"><Heart size={20} /></button>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-ink-soft">{fmt(elapsed)}</span>
          <Waveform bars={34} active={playing} height={34} className="flex-1" />
          <span className="text-[13px] tabular-nums text-ink-soft">{fmt(TOTAL)}</span>
        </div>
        <h1 className="mt-6 text-center text-[24px] font-bold">{t('rn_title')}</h1>
        <div className="text-center text-[15px] font-medium text-rose-pressed">{t('rn_sub')}</div>
        <p className="mt-2 text-center text-[16px] leading-relaxed text-ink-soft">{t('rn_desc')}</p>
      </div>
    </Screen>
  )
}
