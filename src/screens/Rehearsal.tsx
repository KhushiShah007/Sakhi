import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Briefcase, Hand, HeartHandshake, RotateCcw, Sparkles, Stethoscope } from 'lucide-react'
import { pick, useI18n } from '../i18n'
import { Screen, Segmented, TopBar } from '../components/ui'
import { useParam } from '../components/nav'
import { Avatar } from '../illustrations/Woman'
import { scenarios, type ScenarioId } from '../mock/content'

const ICON = { family: HeartHandshake, hr: Briefcase, doctor: Stethoscope }

export default function Rehearsal() {
  const { t, lang } = useI18n()
  const qs = useParam('s') as ScenarioId | null
  const all = useParam('all') === '1'
  const [sid, setSid] = useState<ScenarioId>(qs ?? 'doctor')
  const sc = scenarios.find((s) => s.id === sid)!
  // number of turns revealed; the next turn is "me" → shown as a suggestion
  const [shown, setShown] = useState(all ? sc.turns.length : 1)
  const [typing, setTyping] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => { setShown(all ? sc.turns.length : 1); setTyping(false) }, [sid, all, sc.turns.length])
  useEffect(() => { scroller.current?.scrollTo({ top: 99999, behavior: 'smooth' }) }, [shown, typing])

  const next = sc.turns[shown]
  const done = shown >= sc.turns.length
  const Icon = ICON[sid]

  const say = () => {
    setShown((s) => s + 1)
    if (sc.turns[shown + 1]?.who === 'them') {
      setTyping(true)
      window.setTimeout(() => { setTyping(false); setShown((s) => s + 1) }, 1300)
    }
  }

  return (
    <Screen bg="wash" scrollRef={scroller} header={<TopBar title={t('rh_title')} />}>
      <div className="px-5 pb-10">
        <p className="text-center text-[15px] leading-snug text-ink-soft">{t('rh_sub')}</p>
        <div className="mt-3 flex justify-center">
          <Segmented value={sid} onChange={setSid} options={[{ id: 'family', label: t('rh_family') }, { id: 'hr', label: t('rh_hr') }, { id: 'doctor', label: t('rh_doctor') }]} />
        </div>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/75 py-1 pl-1 pr-3 text-[14px] font-medium shadow-card">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={16} /></span>
            {t('rh_playing')}: <b className="font-semibold">{pick(sc.role, lang)}</b>
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {sc.turns.slice(0, shown).map((turn, i) => (
            <motion.div key={`${sid}-${i}`} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex items-end gap-2 ${turn.who === 'me' ? 'justify-end' : ''}`}>
              {turn.who === 'them' && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={17} /></span>}
              <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-[16px] leading-snug ${turn.who === 'me' ? 'rounded-br-md bg-rose text-white shadow-soft' : 'glass-strong rounded-bl-md text-ink'}`}>
                {pick(turn.text, lang)}
              </div>
              {turn.who === 'me' && <Avatar size={34} />}
            </motion.div>
          ))}
          <AnimatePresence>
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-end gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-lavender text-peri-deep"><Icon size={17} /></span>
                <div className="glass-strong flex gap-1 rounded-3xl rounded-bl-md px-4 py-4">
                  {[0, 1, 2].map((d) => (
                    <motion.span key={d} className="h-2 w-2 rounded-full bg-ink-soft" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: d * 0.2 }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {!done && next?.who === 'me' && !typing && (
          <motion.button initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={say} className="mt-5 w-full rounded-3xl border-2 border-dashed border-rose/50 bg-white/60 p-4 text-left">
            <span className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-rose-pressed"><Hand size={15} /> {t('rh_tap')}</span>
            <span className="text-[16px] leading-snug">{pick(next.text, lang)}</span>
          </motion.button>
        )}

        {done && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-5 rounded-[26px] p-5 text-white shadow-soft" style={{ background: 'linear-gradient(135deg, #5361C8, #6C7BD9)' }}>
            <div className="flex items-center gap-2 text-[14px] font-semibold"><Sparkles size={16} /> Sakhi</div>
            <p className="mt-1 text-[17px] font-medium leading-snug">{pick(sc.feedback, lang)}</p>
            <button onClick={() => setShown(1)} className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white/20 px-4 text-[15px] font-semibold"><RotateCcw size={16} /> {t('rh_again')}</button>
          </motion.div>
        )}
      </div>
    </Screen>
  )
}
