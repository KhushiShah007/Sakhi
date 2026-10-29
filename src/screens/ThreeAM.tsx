import { useState } from 'react'
import { motion } from 'framer-motion'
import { BellOff, Mic, Moon, Snowflake, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { Orb, Screen, useToast } from '../components/ui'
import { useEmbedded, useGo } from '../components/nav'
import { useLive } from '../api/session'
import ThreeAMLive from './ThreeAMLive'

/** Live when logged in; demo/screenshots/static hosting keep the scripted screen. */
export default function ThreeAM() {
  const live = useLive()
  const embedded = useEmbedded()
  return live && !embedded ? <ThreeAMLive /> : <ThreeAMMock />
}

function ThreeAMMock() {
  const { t } = useI18n()
  const go = useGo()
  const toast = useToast()
  const [listening, setListening] = useState(false)
  const stars = [[40, 70], [320, 50], [280, 140], [70, 190], [350, 230], [24, 300], [200, 30]]
  return (
    <Screen bg="night" tone="night" className="flex flex-col">
      {stars.map(([x, y], i) => (
        <motion.span key={i} className="absolute h-1 w-1 rounded-full bg-[#F3E8FB]" style={{ left: x, top: y }} animate={{ opacity: [0.15, 0.5, 0.15] }} transition={{ duration: 3 + i, repeat: Infinity }} />
      ))}
      <div className="pointer-events-none absolute left-1/2 top-[330px] h-80 w-80 -translate-x-1/2 rounded-full bg-[#5A1F3B] opacity-40 blur-3xl" />

      <div className="relative flex items-center justify-between px-5 pt-2">
        <span className="flex items-center gap-2 text-[14px] text-[#BFA3B1]"><Moon size={16} /> {t('t_3am')}</span>
        <button onClick={() => go('/home')} className="flex min-h-[44px] items-center gap-1 rounded-full bg-white/5 px-4 text-[14px] text-[#CDB3C0]"><X size={16} /> {t('exit')}</button>
      </div>

      <div className="relative mt-6 text-center">
        <div className="text-[64px] font-extralight leading-none tracking-tight text-[#E9D3DD]">3:07</div>
        <h1 className="mt-5 px-8 text-[24px] font-semibold leading-snug text-[#EBD5DF]">{t('n_title')}</h1>
        <p className="mt-2 px-10 text-[16px] leading-relaxed text-[#BFA3B1]">{t('n_sub')}</p>
      </div>

      <div className="relative mt-8 flex justify-center">
        <Orb night size={160} active={listening} label={listening ? t('listening') : t('n_talk')} onClick={() => setListening((l) => !l)} />
      </div>

      <div className="relative mt-auto px-5 pb-8">
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { icon: Snowflake, label: t('n_cool'), to: '/right-now' },
            { icon: Moon, label: t('n_sleep'), to: '' },
            { icon: Mic, label: t('n_talk'), to: '' },
          ].map(({ icon: Icon, label, to }) => (
            <button key={label} onClick={() => (to ? go(to) : setListening(true))} className="flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white/[0.06] text-[14px] text-[#D9C2CE]">
              <Icon size={20} className="text-[#E7A9C0]" /> {label}
            </button>
          ))}
        </div>
        <button onClick={() => toast.show('🌙 ' + t('meena') + ' ✓')} className="mt-3 flex min-h-[56px] w-full items-center gap-3 rounded-2xl bg-white/[0.06] px-4 text-left text-[15px] text-[#D9C2CE]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#3A2230] text-[14px] font-bold text-[#E9D3DD]">M</span>
          {t('n_trusted')}
        </button>
        <div className="mt-4 flex items-center justify-center gap-2 text-[13px] text-[#A88C9A]"><BellOff size={14} /> {t('n_paused')}</div>
      </div>
    </Screen>
  )
}
