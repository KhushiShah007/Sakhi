import { useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { ArrowRight, Heart, Lock, Mic, Radio } from 'lucide-react'
import { LANGS, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Screen, Waveform } from '../components/ui'
import { useGo, useParam } from '../components/nav'
import { useSession } from '../api/session'
import { SKIN, Woman } from '../illustrations/Woman'

const SLIDES: { a: StrKey; b: StrKey; skin: string; kurta: string; dupatta: string; arch: string; extra: 'none' | 'voice' | 'signal'; pose: 'chai' | 'calm' }[] = [
  { a: 'w1a', b: 'w1b', skin: SKIN.warm, kurta: '#D6336C', dupatta: '#FEA38E', arch: 'linear-gradient(180deg,#FBA2AB 0%,#FFDFC3 100%)', extra: 'none', pose: 'chai' },
  { a: 'w2a', b: 'w2b', skin: SKIN.dusk, kurta: '#6C7BD9', dupatta: '#FBA2AB', arch: 'linear-gradient(180deg,#E6D6F5 0%,#FFDFC3 100%)', extra: 'voice', pose: 'calm' },
  { a: 'w3a', b: 'w3b', skin: SKIN.light, kurta: '#F3B5A0', dupatta: '#D6336C', arch: 'linear-gradient(180deg,#FEA38E 0%,#FBEBDD 100%)', extra: 'signal', pose: 'chai' },
]

function SwipePill({ label, onDone }: { label: string; onDone: () => void }) {
  const x = useMotionValue(0)
  const max = 300 - 64 - 8
  const textOpacity = useTransform(x, [0, max * 0.6], [1, 0])
  return (
    <div className="relative h-[68px] w-[300px] rounded-full bg-ink p-1 shadow-soft">
      <motion.span style={{ opacity: textOpacity }} className="pointer-events-none absolute inset-0 flex items-center justify-center pl-12 text-[16px] font-semibold text-white">
        {label}
        <motion.span animate={{ x: [0, 6, 0] }} transition={{ duration: 1.4, repeat: Infinity }} className="ml-2 inline-flex"><ArrowRight size={18} /></motion.span>
      </motion.span>
      <motion.button
        aria-label={label}
        drag="x"
        dragConstraints={{ left: 0, right: max }}
        dragElastic={0.05}
        dragMomentum={false}
        style={{ x }}
        onClick={onDone}
        onDragEnd={() => {
          if (x.get() > max * 0.6) animate(x, max, { duration: 0.15 }).then(() => { onDone(); x.set(0) })
          else animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
        }}
        className="relative z-10 grid h-[60px] w-[60px] cursor-grab place-items-center rounded-full bg-peach text-ink shadow-card active:cursor-grabbing"
      >
        <ArrowRight size={24} />
      </motion.button>
    </div>
  )
}

export default function Welcome() {
  const { t, lang, setLang } = useI18n()
  const go = useGo()
  const { status } = useSession()
  const q = useParam('slide')
  const [i, setI] = useState(q ? +q : 0)
  const s = SLIDES[i]
  const next = () => (i < SLIDES.length - 1 ? setI(i + 1) : go(status === 'authed' ? '/home' : status === 'offline' ? '/onboarding' : '/login'))

  return (
    <Screen bg="wash" className="flex flex-col">
      <div className="flex items-center justify-between px-6 pt-1">
        <span className="flex items-center gap-2 text-[18px] font-bold tracking-tight"><img src="./favicon.svg" alt="" className="h-8 w-8" /> Sakhi</span>
        <div className="flex gap-1 rounded-full bg-white/60 p-1">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => setLang(l.id)} aria-label={l.label} className={`min-h-[34px] rounded-full px-2.5 text-[12.5px] font-semibold ${lang === l.id ? 'bg-rose text-white' : 'text-ink'}`}>
              {l.native.slice(0, l.id === 'en' ? 2 : 3)}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-5 mt-4 flex flex-1 flex-col items-center rounded-[40px] bg-white/55 px-5 pb-6 pt-6 shadow-card backdrop-blur-md">
        <motion.div
          className="relative h-[330px] w-[280px] cursor-grab active:cursor-grabbing"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.2}
          onDragEnd={(_, info) => {
            if (info.offset.x < -50) next()
            else if (info.offset.x > 50 && i > 0) setI(i - 1)
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.35 }} className="absolute inset-0 overflow-hidden rounded-t-full" style={{ background: s.arch }}>
              <div className="absolute left-1/2 top-10 h-24 w-24 -translate-x-1/2 rounded-full bg-white/40" />
              <Woman skin={s.skin} kurta={s.kurta} dupatta={s.dupatta} pose={s.pose} className="absolute bottom-0 left-1/2 h-[300px] w-[270px] -translate-x-1/2" />
              {s.extra === 'voice' && (
                <div className="absolute left-3 top-[120px] flex items-center gap-2 rounded-2xl bg-white/90 px-3 py-2 shadow-card">
                  <Mic size={16} className="text-rose" />
                  <Waveform bars={10} height={20} />
                </div>
              )}
              {s.extra === 'signal' && (
                <>
                  <div className="absolute left-2 top-[110px] flex items-center gap-1.5 rounded-2xl bg-white/90 px-3 py-2 text-[13px] font-semibold shadow-card"><Lock size={14} className="text-ink-soft" /> “…”</div>
                  <div className="absolute right-2 top-[150px] flex items-center gap-1.5 rounded-2xl bg-rose px-3 py-2 text-[13px] font-semibold text-white shadow-card"><Radio size={14} /> <Heart size={14} fill="currentColor" /></div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="mt-6 text-center">
            <h1 className="text-[29px] font-bold leading-[1.18] tracking-tight">{t(s.a)}</h1>
            <h2 className="mt-1 text-[22px] font-semibold leading-snug text-rose-pressed">{t(s.b)}</h2>
          </motion.div>
        </AnimatePresence>

        <div className="mt-5 flex gap-2">
          {SLIDES.map((_, k) => (
            <button key={k} aria-label={`Slide ${k + 1}`} onClick={() => setI(k)} className={`h-2.5 rounded-full transition-all ${k === i ? 'w-8 bg-rose' : 'w-2.5 bg-[#E9CED6]'}`} />
          ))}
        </div>

        <div className="mt-auto pt-6">
          <SwipePill label={t('swipe')} onDone={next} />
        </div>
        <p className="mt-3 text-[14px] text-ink-soft">{t('w_foot')}</p>
      </div>
      <div className="h-6" />
    </Screen>
  )
}
