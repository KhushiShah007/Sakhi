import { motion } from 'framer-motion'
import { Footprints, Lock, MessageCircleHeart, Mic, Play, Share2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { Screen, TopBar, useToast } from '../components/ui'
import { Lotus } from '../illustrations/art'
import { letter } from '../mock/content'

export default function Letter() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const L = letter[lang]
  const hand = lang === 'gu' ? 'font-sans' : 'font-hand'
  return (
    <Screen bg="wash" header={<TopBar title={t('lt_title')} right={<button aria-label="Share" className="icon-btn" onClick={() => toast.show()}><Share2 size={18} /></button>} />}>
      <div className="px-5 pb-10">
        <div className="mb-4 flex flex-wrap justify-center gap-2">
          <span className="chip"><Mic size={15} className="text-rose" /> 19</span>
          <span className="chip"><Footprints size={15} className="text-peri-deep" /> 12</span>
          <span className="chip"><MessageCircleHeart size={15} className="text-rose" /> 2</span>
        </div>
        <motion.article
          initial={{ opacity: 0, y: 24, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -0.8 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[26px] px-6 pb-7 pt-9 shadow-soft"
          style={{ background: 'radial-gradient(120% 80% at 0% 0%, #FFFFFF 0%, #FFFAF3 60%, #FFF3E8 100%)' }}
        >
          {/* washi tape */}
          <span className="absolute -top-3 left-8 h-7 w-24 -rotate-6 rounded-sm bg-peach/60" />
          <span className="absolute -top-3 right-10 h-7 w-20 rotate-3 rounded-sm bg-lavender/80" />
          <Lotus className="absolute -right-5 -top-5 h-20 w-20 opacity-70" />
          <div className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-rose-pressed">{t('lt_month')}</div>
          <div className={`${hand} text-[26px] font-bold leading-[34px] text-ink`}>{L.greeting}</div>
          {L.paras.map((p, i) => (
            <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.25 }} className={`${hand} mt-3 text-[19px] leading-[31px] text-ink`}>
              {p}
            </motion.p>
          ))}
          <div className={`${hand} relative mt-2 text-right text-[20px] font-bold leading-[34px] text-rose-pressed`}>{L.sign}</div>
        </motion.article>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={() => toast.show()} className="btn-primary px-3"><Play size={18} fill="currentColor" /> {t('lt_listen')}</button>
          <button onClick={() => toast.show()} className="btn-ghost px-3"><Lock size={17} /> {t('lt_keep')}</button>
        </div>
      </div>
    </Screen>
  )
}
