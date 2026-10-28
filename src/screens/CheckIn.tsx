import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, Sun } from 'lucide-react'
import { useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Orb, Screen, useToast } from '../components/ui'
import { useGo, useParam } from '../components/nav'
import { Avatar } from '../illustrations/Woman'
import { MoodBlob } from '../illustrations/Blob'
import { MOODS, type Mood } from '../mock/user'

export default function CheckIn({ initialMood }: { initialMood?: Mood }) {
  const { t } = useI18n()
  const go = useGo()
  const toast = useToast()
  const pm = useParam('mood') as Mood | null
  const [idx, setIdx] = useState(Math.max(0, MOODS.indexOf(initialMood ?? pm ?? 'hot')))
  const mood = MOODS[idx]
  const n = MOODS.length
  const move = (d: number) => setIdx((i) => (i + d + n) % n)

  return (
    <Screen bg="lilac" className="flex flex-col">
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-[#FBC6D0] opacity-50 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-72 h-72 w-72 rounded-full bg-[#D9CBF5] opacity-60 blur-3xl" />

      <div className="relative flex items-center justify-between px-5 pt-1">
        <button className="icon-btn" aria-label="Back" onClick={() => go(-1)}><ChevronLeft size={24} /></button>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3.5 py-1.5 text-[14px] font-medium shadow-card">
          <Sun size={16} className="text-peach" /> {t('ci_hello')}
        </span>
        <Avatar size={48} />
      </div>

      <div className="relative px-7 pt-5 text-center">
        <h1 className="text-[28px] font-bold leading-[1.2] tracking-tight">{t('ci_title')}</h1>
        <p className="mt-2 text-[16px] leading-snug text-ink-soft">{t('ci_sub')}</p>
      </div>

      {/* blob carousel */}
      <motion.div
        className="relative mt-2 h-[230px] w-full cursor-grab touch-pan-y active:cursor-grabbing"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.x < -40) move(1)
          else if (info.offset.x > 40) move(-1)
        }}
      >
        {MOODS.map((m, i) => {
          let off = i - idx
          if (off > n / 2) off -= n
          if (off < -n / 2) off += n
          const abs = Math.abs(off)
          if (abs > 2) return null
          const size = abs === 0 ? 172 : abs === 1 ? 86 : 54
          const x = off === 0 ? 0 : Math.sign(off) * (abs === 1 ? 128 : 180)
          return (
            <motion.button
              key={m}
              aria-label={t(`mood_${m}` as StrKey)}
              onClick={() => setIdx(i)}
              className="absolute left-1/2 top-1/2"
              initial={false}
              animate={{ x: x - size / 2, y: -size / 2 + (abs === 0 ? 0 : abs === 1 ? 10 : 24), opacity: abs === 2 ? 0.55 : 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              style={{ width: size, height: size, zIndex: 10 - abs }}
            >
              <motion.div
                animate={abs === 0 ? { rotate: [0, -3, 3, 0], scale: [1, 1.03, 1] } : { rotate: 0, scale: 1 }}
                transition={{ duration: 3, repeat: abs === 0 ? Infinity : 0, ease: 'easeInOut' }}
                style={{ filter: abs === 0 ? 'drop-shadow(0 16px 22px rgba(176,36,88,0.22))' : 'none' }}
              >
                <MoodBlob mood={m} size={size} />
              </motion.div>
            </motion.button>
          )
        })}
      </motion.div>

      <div className="relative -mt-1 flex flex-col items-center px-6 text-center">
        <AnimatePresence mode="wait">
          <motion.div key={mood} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
            <div className="inline-flex rounded-full bg-white/80 px-4 py-1.5 text-[17px] font-semibold shadow-card">{t(`mood_${mood}` as StrKey)}</div>
            <div className="mt-2 text-[16px] text-ink-soft">{t(`cap_${mood}` as StrKey)}</div>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 flex gap-1.5" aria-hidden>
          {MOODS.map((m, i) => (
            <span key={m} className={`h-2 rounded-full transition-all ${i === idx ? 'w-6 bg-rose' : 'w-2 bg-white'}`} />
          ))}
        </div>
      </div>

      <div className="relative mt-auto flex flex-col items-center pb-5 pt-4">
        <Orb size={142} label={t('listening')} sub={t('tap_speak')} onClick={() => go('/vent')} />
        <p className="mt-4 text-[14px] text-ink-soft">{t('ci_orb_hint')}</p>
        <button
          className="mt-1 min-h-[44px] px-4 text-[15px] font-semibold text-rose-pressed underline decoration-2 underline-offset-4"
          onClick={() => {
            toast.show(`${t(`mood_${mood}` as StrKey)} ✓`)
            setTimeout(() => go('/home'), 900)
          }}
        >
          {t('ci_save')}
        </button>
      </div>
    </Screen>
  )
}
