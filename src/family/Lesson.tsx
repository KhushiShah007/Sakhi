import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, Clock, MessageCircle, Sparkles, X } from 'lucide-react'
import { pick, useI18n } from '../i18n'
import { Screen } from '../components/ui'
import { useGo, useParam } from '../components/nav'
import { LessonArt } from '../illustrations/art'
import { lessonAdult, lessonTeen } from '../mock/content'

export default function Lesson() {
  const { t, lang } = useI18n()
  const go = useGo()
  const teen = useParam('teen') === '1'
  const qs = useParam('slide')
  const deck = teen ? lessonTeen : lessonAdult
  const [i, setI] = useState(qs ? +qs : 0)
  const [answer, setAnswer] = useState<boolean | null>(null)
  const quiz = i >= deck.length
  const s = deck[Math.min(i, deck.length - 1)]

  return (
    <Screen bg="wash" className="flex flex-col">
      <div className="flex items-center gap-3 px-5 pt-1">
        <button aria-label="Close" onClick={() => go('/family')} className="icon-btn"><X size={22} /></button>
        <div className="flex flex-1 gap-1.5">
          {[...deck, null].map((_, k) => (
            <div key={k} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/70">
              <motion.div className="h-full rounded-full bg-rose" initial={false} animate={{ width: k < i ? '100%' : k === i ? '50%' : '0%' }} />
            </div>
          ))}
        </div>
        <span className="flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[13px] font-semibold"><Clock size={14} /> {t('min2')}</span>
      </div>
      <div className="mt-3 px-5 text-[13px] font-bold uppercase tracking-[0.12em] text-rose-pressed">{teen ? t('fc_teen') : t('fc_learn')}</div>

      <AnimatePresence mode="wait">
        {!quiz ? (
          <motion.div key={i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} className="flex flex-1 flex-col px-5 pt-3">
            <div className="glass-strong grid h-[230px] place-items-center rounded-[32px] p-6">
              <LessonArt kind={s.art} className="h-full w-full" />
            </div>
            <div className="mt-5 text-[15px] font-semibold text-ink-soft">{i + 1} / {deck.length}</div>
            <h1 className="mt-1 text-[28px] font-bold leading-tight">{pick(s.title, lang)}</h1>
            <p className="mt-3 text-[19px] leading-relaxed">{pick(s.body, lang)}</p>
          </motion.div>
        ) : (
          <motion.div key="quiz" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} className="flex flex-1 flex-col px-5 pt-6">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-peach-light text-rose-pressed"><Sparkles size={26} /></span>
            <h1 className="mt-4 text-[26px] font-bold">{t('ls_done_title')}</h1>
            <p className="mt-2 text-[19px] leading-relaxed">{t('ls_q')}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[true, false].map((v) => (
                <button key={String(v)} onClick={() => setAnswer(v)} className={`min-h-[64px] rounded-2xl text-[18px] font-semibold transition ${answer === v ? (v ? 'bg-[#2F6B4F] text-white' : 'bg-rose-pressed text-white') : 'glass'}`}>
                  {v ? t('ls_true') : t('ls_false')}
                </button>
              ))}
            </div>
            {answer !== null && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-start gap-2 rounded-2xl bg-white/80 p-4 text-[16px] leading-snug">
                <Check size={20} className="mt-0.5 shrink-0 text-[#2F6B4F]" /> {t('ls_right')}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-auto flex gap-3 px-5 pb-8 pt-5">
        {i > 0 && !quiz && <button onClick={() => setI(i - 1)} aria-label="Previous" className="icon-btn h-[52px] w-[52px]"><ArrowLeft size={22} /></button>}
        {quiz ? (
          <button onClick={() => go('/family')} className="btn-primary flex-1"><MessageCircle size={19} /> {t('ls_back')}</button>
        ) : (
          <button onClick={() => setI(i + 1)} className="btn-primary flex-1">{t('next')}</button>
        )}
      </div>
    </Screen>
  )
}
