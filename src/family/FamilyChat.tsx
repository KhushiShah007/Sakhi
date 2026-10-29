import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, BadgeCheck, CheckCheck, Mic, MoreVertical, Paperclip, Phone, Smile, Video } from 'lucide-react'
import { useI18n } from '../i18n'
import { StatusBar, ProtoStrip } from '../components/ui'
import { useGo } from '../components/nav'
import { LessonCard, RepairCard, SayThisCard, SignalCard, WeatherAlertCard } from './cards'

const WA_GREEN = '#00695C'
const WA_TEXT = '#00695C'

/** Which messages are visible: used by the demo to stage arrivals. */
export type ChatUpto = 'intro' | 'signal' | 'replied' | 'weather' | 'all'
const ORDER: ChatUpto[] = ['intro', 'signal', 'replied', 'weather', 'all']

export function Bubble({ children, me = false, time = '7:52', card = false }: { children: ReactNode; me?: boolean; time?: string; card?: boolean }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className={`flex ${me ? 'justify-end' : ''}`}>
      <div className={`relative max-w-[86%] rounded-2xl ${me ? 'rounded-tr-sm bg-[#DCF8C6]' : 'rounded-tl-sm bg-white'} ${card ? 'w-[86%] p-1.5' : 'px-3 py-2'} shadow-[0_1px_1px_rgba(0,0,0,0.08)]`}>
        <div className={card ? '' : 'text-[16px] leading-snug text-[#111B21]'}>{children}</div>
        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[11px] text-[#5B6B73] ${card ? 'px-1.5 pb-0.5' : ''}`}>
          {time}
          {me && <CheckCheck size={15} className="text-[#2A7FBF]" />}
        </div>
      </div>
    </motion.div>
  )
}

export default function FamilyChat({ upto: uptoProp, banner = false }: { upto?: ChatUpto; banner?: boolean }) {
  const { t } = useI18n()
  const go = useGo()
  const [extra, setExtra] = useState<{ me: string; reply: string }[]>([])
  const upto = uptoProp ?? 'all'
  const lvl = ORDER.indexOf(upto)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // in the demo, keep the newest arrival in view
    if (uptoProp) scroller.current?.scrollTo({ top: 99999, behavior: 'smooth' })
  }, [uptoProp, lvl, extra.length])

  const reply = (me: string, r: string) => setExtra((e) => [...e, { me, reply: r }])
  const quick = (
    <div className="mt-1 grid grid-cols-1 divide-y divide-[#E9EDEF] border-t border-[#E9EDEF]">
      <button onClick={() => reply(t('fc_done'), t('fc_thanks'))} className="min-h-[44px] text-[15px] font-semibold" style={{ color: WA_TEXT }}>{t('fc_done')}</button>
      <button onClick={() => reply(t('fc_help'), t('fc_help_reply'))} className="min-h-[44px] text-[15px] font-semibold" style={{ color: WA_TEXT }}>{t('fc_help')}</button>
    </div>
  )

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#EFE7DE]">
      {/* header */}
      <div className="relative z-20 shrink-0 text-white" style={{ background: WA_GREEN }}>
        <StatusBar tone="light" time="7:52" />
        <ProtoStrip tone="light" />
        <div className="flex items-center gap-2 px-2 pb-2.5 pt-1">
          <button aria-label="Back" onClick={() => go(-1)} className="grid h-11 w-9 place-items-center"><ArrowLeft size={22} /></button>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white"><img src="./favicon.svg" alt="" className="h-8 w-8" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[17px] font-semibold leading-tight">Sakhi <BadgeCheck size={16} className="text-[#7FE0A6]" /></div>
            <div className="truncate text-[12.5px] text-white">{t('fc_verified')}</div>
          </div>
          <Video size={21} className="mx-2" />
          <Phone size={19} className="mx-2" />
          <MoreVertical size={20} className="mx-1" />
        </div>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.div initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -90, opacity: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }} className="absolute inset-x-3 top-12 z-40 flex items-center gap-3 rounded-2xl bg-white/95 p-3 shadow-soft backdrop-blur">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: WA_GREEN }}><img src="./favicon.svg" alt="" className="h-7 w-7" /></span>
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-[#111B21]">Sakhi · {t('fc_signal')}</div>
              <div className="truncate text-[14px] text-[#3B4A54]">{t('fc_signal_text')}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* chat wallpaper */}
      <div
        ref={scroller}
        data-scroll
        className="no-scrollbar relative flex-1 overflow-y-auto px-3 pb-4 pt-3"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23D9CBBE' stroke-width='1.6' opacity='.55'%3E%3Cpath d='M20 24c-4-4-10-2-10 3 0 4 6 8 10 11 4-3 10-7 10-11 0-5-6-7-10-3z'/%3E%3Ccircle cx='84' cy='30' r='8'/%3E%3Cpath d='M64 84l8-14 8 14z'/%3E%3Cpath d='M18 92c8-8 16 8 24 0'/%3E%3Cpath d='M98 98l6 6M104 98l-6 6'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        <div className="flex flex-col gap-2">
          <div className="mx-auto rounded-lg bg-white/90 px-3 py-1 text-[12.5px] font-medium text-[#54656F] shadow-sm">{t('today')}</div>
          <div className="mx-auto max-w-[90%] rounded-lg bg-[#FFF3C4] px-3 py-1.5 text-center text-[12px] leading-snug text-[#54656F]">🔒 {t('fp_hero_b')}</div>
          <Bubble time="7:30">{t('fc_intro')}</Bubble>

          {lvl >= 1 && (
            <Bubble card time="7:51">
              <SignalCard />
              {quick}
            </Bubble>
          )}
          {lvl >= 2 && (
            <>
              <Bubble me time="7:52">{t('fc_done')}</Bubble>
              <Bubble time="7:52">{t('fc_thanks')}</Bubble>
            </>
          )}
          {lvl >= 3 && (
            <Bubble card time="8:00">
              <WeatherAlertCard />
            </Bubble>
          )}
          {lvl >= 4 && (
            <>
              <Bubble card time="8:01"><SayThisCard /></Bubble>
              <Bubble card time="8:01"><RepairCard /></Bubble>
              <Bubble card time="8:02">
                <div className="flex flex-col gap-1.5">
                  <LessonCard onOpen={() => go('/family/lesson')} />
                  <LessonCard teen onOpen={() => go('/family/lesson?teen=1')} />
                </div>
              </Bubble>
            </>
          )}
          {extra.map((e, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Bubble me time="8:03">{e.me}</Bubble>
              <Bubble time="8:03">{e.reply}</Bubble>
            </div>
          ))}
        </div>
      </div>

      {/* quick replies + input */}
      <div className="relative z-10 shrink-0 bg-[#EFE7DE] px-2 pb-6 pt-1">
        <div className="no-scrollbar mb-2 flex gap-2 overflow-x-auto px-1">
          {[t('fc_done'), t('fc_help')].map((q, i) => (
            <button key={q} onClick={() => reply(q, i ? t('fc_help_reply') : t('fc_thanks'))} className="min-h-[40px] shrink-0 rounded-full border border-[#C9D6D3] bg-white px-4 text-[14px] font-semibold" style={{ color: WA_TEXT }}>
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-12 flex-1 items-center gap-3 rounded-full bg-white px-4 text-[#54656F]">
            <Smile size={22} />
            <span className="flex-1 text-[16px]">{t('fc_type')}</span>
            <Paperclip size={20} />
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: WA_GREEN }}><Mic size={22} /></span>
        </div>
      </div>
    </div>
  )
}
