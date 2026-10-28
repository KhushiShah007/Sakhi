import { motion } from 'framer-motion'
import { BookOpen, Check, CloudSun, Heart, HeartHandshake, MessageCircleHeart, Sparkles, Utensils, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { SunCloud } from '../illustrations/art'

/** Signal Card as it appears inside the family's chat (and previewed on her side). */
export function SignalCard({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n()
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: 'linear-gradient(100deg, #D6336C, #C42A60)' }}>
        <Utensils size={16} />
        <span className="text-[14px] font-semibold">{t('fc_signal')}</span>
        <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">SAKHI</span>
      </div>
      <div className="px-3.5 py-3" style={{ background: 'linear-gradient(180deg, #FFF4EC, #FFFFFF)' }}>
        <div className="text-[18px] font-bold leading-snug text-ink">{t('fc_signal_text')}</div>
        {!compact && <div className="mt-1.5 rounded-xl bg-[#FBEBDD] px-3 py-2 text-[15px] italic leading-snug text-ink">“{t('tr_msg')}”</div>}
        <div className="mt-2 flex items-start gap-1.5 text-[14px] leading-snug text-ink-soft">
          <Heart size={15} className="mt-0.5 shrink-0 text-rose" /> {t('fc_signal_hint')}
        </div>
      </div>
    </div>
  )
}

export function WeatherAlertCard() {
  const { t } = useI18n()
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-3 px-3.5 py-3" style={{ background: 'linear-gradient(120deg, #FFDFC3, #FBD0CF)' }}>
        <SunCloud className="h-12 w-14 shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-rose-pressed"><CloudSun size={14} /> {t('fc_weather')}</div>
          <div className="text-[17px] font-bold leading-snug text-ink">{t('fc_weather_text')}</div>
        </div>
      </div>
      <div className="px-3.5 py-2.5 text-[15px] leading-snug text-ink">{t('fc_weather_tip')}</div>
      <div className="flex gap-2 px-3.5 pb-3">
        <span className="rounded-full bg-[#FBEBDD] px-2.5 py-1 text-[12.5px] font-medium text-ink">34°C</span>
        <span className="rounded-full bg-[#FBEBDD] px-2.5 py-1 text-[12.5px] font-medium text-ink">78%</span>
        <span className="rounded-full bg-[#FBEBDD] px-2.5 py-1 text-[12.5px] font-medium text-ink">AQI 162</span>
      </div>
    </div>
  )
}

export function SayThisCard() {
  const { t } = useI18n()
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: '#FDE3E6' }}>
        <MessageCircleHeart size={16} className="text-rose-pressed" />
        <span className="text-[14px] font-semibold text-ink">{t('fc_say')}</span>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2 rounded-xl bg-[#E8F5EE] px-3 py-2">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#2F6B4F] text-white"><Check size={13} strokeWidth={3} /></span>
          <span className="text-[15px] font-medium leading-snug text-ink">{t('fc_say_yes')}</span>
        </div>
        <div className="flex items-start gap-2 rounded-xl bg-[#FBEDEF] px-3 py-2">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-rose-pressed text-white"><X size={13} strokeWidth={3} /></span>
          <span className="text-[15px] leading-snug text-ink-soft line-through decoration-rose/50">{t('fc_say_no')}</span>
        </div>
      </div>
    </div>
  )
}

export function RepairCard() {
  const { t } = useI18n()
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ background: '#EFE4FA' }}>
        <HeartHandshake size={16} className="text-peri-deep" />
        <span className="text-[14px] font-semibold text-ink">{t('fc_repair')}</span>
      </div>
      <div className="px-3.5 py-3">
        <div className="text-[15px] leading-snug text-ink-soft">{t('fc_repair_text')}</div>
        <div className="mt-1.5 text-[16px] font-semibold leading-snug text-ink">{t('fc_repair_line')}</div>
      </div>
    </div>
  )
}

export function LessonCard({ teen = false, onOpen }: { teen?: boolean; onOpen: () => void }) {
  const { t } = useI18n()
  return (
    <button onClick={onOpen} className="flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/5">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl" style={{ background: teen ? 'linear-gradient(135deg,#E6D6F5,#B4BEF0)' : 'linear-gradient(135deg,#FFDFC3,#FBA2AB)' }}>
        {teen ? <Sparkles size={24} className="text-peri-deep" /> : <BookOpen size={24} className="text-rose-pressed" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-bold uppercase tracking-wide text-rose-pressed">{teen ? t('fc_teen') : t('fc_learn')}</span>
        <span className="block text-[16px] font-semibold leading-snug text-ink">{teen ? t('fc_teen_title') : t('fc_learn_title')}</span>
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-[#F1E4E8]"><span className="block h-full rounded-full bg-rose" style={{ width: teen ? '0%' : '25%' }} /></span>
          <span className="text-[12px] text-ink-soft">{t('min2')}</span>
        </span>
      </span>
    </button>
  )
}

/** Paper plane flying off — used when a signal is sent. */
export function FlyAway() {
  return (
    <motion.svg viewBox="0 0 48 48" width={56} height={56} initial={{ x: -40, y: 40, opacity: 0, rotate: -10 }} animate={{ x: 120, y: -90, opacity: [0, 1, 1, 0], rotate: 8 }} transition={{ duration: 1.4, ease: 'easeInOut' }} className="pointer-events-none absolute left-1/2 top-1/2">
      <path d="M4 22 L44 4 L34 44 L24 30 Z" fill="#D6336C" />
      <path d="M24 30 L44 4 L18 26 Z" fill="#B02458" />
    </motion.svg>
  )
}
