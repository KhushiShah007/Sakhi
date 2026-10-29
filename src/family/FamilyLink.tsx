import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BadgeCheck, BookOpen, ChevronDown, CloudSun, Heart, HeartHandshake, MessageCircleHeart, Moon, Sparkles, Users, Utensils, Wind } from 'lucide-react'
import { useI18n, type Lang } from '../i18n'
import { Bubble } from './FamilyChat'

/** Live family page: the no-install WhatsApp-style view behind a magic link. Shows enumerated signals only. */
interface Card { id: string; type: string; text: string; sentAt: string; status: 'new' | 'done' | 'needs_help' }
interface Lesson { id: string; kind: string; title: string; points: string[]; clinicianReviewed: boolean }
interface View { herLabel: string; lang: Lang; contentOnly: boolean; cards: Card[]; alert: string | null; lessons: Lesson[] }
type State = { s: 'loading' } | { s: 'inactive' } | { s: 'error' } | { s: 'ready'; view: View }

const API = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ?? ''
const WA_GREEN = '#00695C'
const ICONS: Record<string, typeof Utensils> = { need_space: Wind, overwhelmed: Heart, rough_night: Moon, take_over_dinner: Utensils, just_sit_with_me: Users }
const lessonIcon = (k: string) => (k === 'say_this' ? MessageCircleHeart : k === 'repair' ? HeartHandshake : k === 'teen_module' ? Sparkles : BookOpen)
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function FamilyLink() {
  const { token = '' } = useParams()
  const { t, setLang } = useI18n()
  const [state, setState] = useState<State>({ s: 'loading' })
  const [replied, setReplied] = useState<Record<string, 'done' | 'help'>>({})
  const [open, setOpen] = useState<string | null>(null)
  const langSet = useRef(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/f/${encodeURIComponent(token)}`)
      if (r.status === 410) return setState({ s: 'inactive' })
      if (!r.ok) return setState({ s: 'error' })
      const view = (await r.json()) as View
      if (!langSet.current) { langSet.current = true; setLang(view.lang) }
      setState({ s: 'ready', view })
    } catch { setState({ s: 'error' }) }
  }, [token, setLang])

  useEffect(() => {
    // a different link in the same tab (or a re-used component) must not inherit the previous person's state or language
    langSet.current = false
    setState({ s: 'loading' }); setReplied({}); setOpen(null)
    void load()
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 60_000) // new cards arrive without a refresh
    return () => window.clearInterval(id)
  }, [load])

  const reply = async (cardId: string, kind: 'done' | 'help') => {
    setReplied((r) => ({ ...r, [cardId]: kind }))
    try {
      const r = await fetch(`${API}/f/${encodeURIComponent(token)}/cards/${cardId}/reply`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reply: kind }) })
      if (!r.ok) throw new Error('reply failed')
    } catch {
      setReplied((r) => { const n = { ...r }; delete n[cardId]; return n }) // undo so they can tap again
    }
  }

  const shell = (children: React.ReactNode, name = 'Sakhi') => (
    <div className="flex h-[100dvh] w-full justify-center bg-[#E4DAD0]">
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-[#EFE7DE] md:my-4 md:h-[calc(100dvh-2rem)] md:rounded-3xl md:shadow-phone">
        <header className="flex shrink-0 items-center gap-3 px-4 py-3 text-white" style={{ background: WA_GREEN }}>
          <span className="grid h-10 w-10 place-items-center rounded-full bg-white"><img src="./favicon.svg" alt="" className="h-8 w-8" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-[17px] font-semibold leading-tight">Sakhi <BadgeCheck size={16} className="text-[#7FE0A6]" aria-hidden /></div>
            <div className="truncate text-[12.5px]">{name}</div>
          </div>
        </header>
        {children}
      </div>
    </div>
  )

  if (state.s === 'loading') return shell(<div role="status" className="grid flex-1 place-items-center text-[16px] text-[#3B4A54]">{t('fl_loading')}</div>)
  if (state.s === 'inactive')
    return shell(
      <div role="alert" className="grid flex-1 place-items-center px-8 text-center">
        <div><div className="text-[20px] font-bold text-ink">{t('fl_inactive_title')}</div><p className="mt-2 text-[16px] leading-relaxed text-ink-soft">{t('fl_inactive_body')}</p></div>
      </div>,
    )
  if (state.s === 'error')
    return shell(
      <div role="alert" className="grid flex-1 place-items-center px-8 text-center">
        <div><p className="text-[16px] leading-relaxed text-ink">{t('fl_error')}</p>
          <button onClick={() => { setState({ s: 'loading' }); void load() }} className="mt-4 min-h-[48px] rounded-full px-6 text-[16px] font-semibold text-white" style={{ background: WA_GREEN }}>{t('fl_retry')}</button></div>
      </div>,
    )

  const { view } = state
  const name = view.herLabel
  const cards = [...view.cards].reverse() // oldest first, like a chat
  return shell(
    <>
      <main aria-live="polite" className="no-scrollbar flex-1 overflow-y-auto px-3 pb-6 pt-3">
        <div className="flex flex-col gap-2">
          <div className="mx-auto max-w-[92%] rounded-lg bg-[#FFF3C4] px-3 py-1.5 text-center text-[12.5px] leading-snug text-[#54656F]">🔒 {t('fl_private')}</div>
          <Bubble time="">{t(view.contentOnly ? 'fl_intro_teen' : 'fl_intro', { name })}</Bubble>

          {cards.map((c) => {
            const Icon = ICONS[c.type] ?? Heart
            const kind = replied[c.id] ?? (c.status === 'done' ? 'done' : c.status === 'needs_help' ? 'help' : null)
            return (
              <div key={c.id} className="flex flex-col gap-2">
                <Bubble card time={clock(c.sentAt)}>
                  <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                    <div className="flex items-center gap-2 px-3.5 py-2.5 text-white" style={{ background: 'linear-gradient(100deg, #D6336C, #B02458)' }}>
                      <Icon size={16} aria-hidden /><span className="text-[14px] font-semibold">{t('fl_signal_from', { name })}</span>
                      <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-semibold">SAKHI</span>
                    </div>
                    <div className="px-3.5 py-3" style={{ background: 'linear-gradient(180deg, #FFF4EC, #FFFFFF)' }}>
                      <div className="text-[18px] font-bold leading-snug text-ink">{c.text}</div>
                    </div>
                    {!kind && (
                      <div className="grid grid-cols-1 divide-y divide-[#E9EDEF] border-t border-[#E9EDEF]">
                        <button onClick={() => void reply(c.id, 'done')} className="min-h-[48px] text-[16px] font-semibold" style={{ color: WA_GREEN }}>{t('fc_done')}</button>
                        <button onClick={() => void reply(c.id, 'help')} className="min-h-[48px] text-[16px] font-semibold" style={{ color: WA_GREEN }}>{t('fc_help')}</button>
                      </div>
                    )}
                  </div>
                </Bubble>
                {kind && (
                  <>
                    <Bubble me time="">{kind === 'done' ? t('fc_done') : t('fc_help')}</Bubble>
                    <Bubble time="">{kind === 'done' ? t('fl_thanks', { name }) : t('fc_help_reply')}</Bubble>
                  </>
                )}
              </div>
            )
          })}

          {view.alert && (
            <Bubble card time="">
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                <div className="flex items-center gap-3 px-3.5 py-3" style={{ background: 'linear-gradient(120deg, #FFDFC3, #FBD0CF)' }}>
                  <CloudSun size={32} className="shrink-0 text-rose-pressed" aria-hidden />
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold uppercase tracking-wide text-rose-pressed">{t('fl_estimate')}</div>
                    <div className="text-[17px] font-bold leading-snug text-ink">{view.alert}</div>
                  </div>
                </div>
              </div>
            </Bubble>
          )}

          {view.lessons.length > 0 && (
            <Bubble card time="">
              <div className="flex flex-col gap-1.5">
                <div className="px-1.5 pt-1 text-[12px] font-bold uppercase tracking-wide text-rose-pressed">{t('fl_lessons')}</div>
                {view.lessons.map((l) => {
                  const Icon = lessonIcon(l.kind)
                  const isOpen = open === l.id
                  return (
                    <div key={l.id} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
                      <button aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : l.id)} className="flex min-h-[56px] w-full items-center gap-3 p-3 text-left">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FBEBDD]"><Icon size={20} className="text-rose-pressed" aria-hidden /></span>
                        <span className="min-w-0 flex-1 text-[16px] font-semibold leading-snug text-ink">{l.title}</span>
                        <ChevronDown size={20} className={`shrink-0 text-ink-soft transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden />
                      </button>
                      {isOpen && (
                        <div className="border-t border-[#F1E4E8] px-3.5 pb-3 pt-2">
                          <ul className="flex flex-col gap-2">{l.points.map((p, i) => <li key={i} className="text-[16px] leading-snug text-ink">{p}</li>)}</ul>
                          {!l.clinicianReviewed && <div className="mt-3 inline-block rounded-full bg-[#FFF3C4] px-2.5 py-1 text-[12.5px] font-medium text-[#54656F]">{t('fl_pending')}</div>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </Bubble>
          )}
          <p className="mx-auto mt-2 max-w-[90%] text-center text-[12.5px] leading-snug text-[#54656F]">{t('fl_disclaimer')}</p>
        </div>
      </main>
    </>,
    name,
  )
}
