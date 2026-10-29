import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, Check, Copy, Lock, Phone, Send, Sparkles, Square, Volume2 } from 'lucide-react'
import { useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, ApiError } from '../api/client'
import { clearHandoff, getHandoff } from '../api/handoff'
import { Screen, Segmented, TopBar } from '../components/ui'
import { useGo } from '../components/nav'
import { FlyAway } from '../family/cards'
import { speak, stopSpeaking } from '../voice/speech'

type Tone = 'gentle' | 'direct' | 'light'
type CardType = 'need_space' | 'overwhelmed' | 'rough_night' | 'take_over_dinner' | 'just_sit_with_me'
const CARDS: CardType[] = ['need_space', 'overwhelmed', 'rough_night', 'take_over_dinner', 'just_sit_with_me']
const TINT = ['#FFDFC3', '#E6D6F5', '#BFE3D2', '#FBD0D5', '#FFD58A']
interface Person { id: string; name: string; role: string; lang: Lang; contentOnly: boolean; paused: boolean; permissions: { signals: boolean } }
interface Sent { personId: string; signalId: string; status: string }
interface Crisis { message: string; helplines: { name: string; number: string }[] }

/**
 * Live "Say it for me". The calm sentence is for HER (play it aloud or copy it). The family channel only ever
 * carries an enumerated Signal Card, so her words cannot reach them even by accident.
 */
export default function TranslatorLive() {
  const { t, lang } = useI18n()
  const go = useGo()
  const handoff = useMemo(() => getHandoff(), [])
  const [card, setCard] = useState<CardType>('need_space')
  const [tones, setTones] = useState<Record<Tone, string> | null>(null)
  const [tone, setTone] = useState<Tone>('gentle')
  const [people, setPeople] = useState<Person[] | null>(null)
  const [cardsText, setCardsText] = useState<Record<string, Record<Lang, string>>>({})
  const [to, setTo] = useState<Record<string, boolean>>({})
  const [stage, setStage] = useState<'compose' | 'sent'>('compose')
  const [sent, setSent] = useState<Sent[]>([])
  const [playing, setPlaying] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<StrKey | null>(null)
  const [crisis, setCrisis] = useState<Crisis | null>(null)

  const load = async (c?: CardType) => {
    try {
      const r = await api<{ kind: string; card: CardType; tones: Record<Tone, string>; message?: string; helplines?: Crisis['helplines'] }>('POST', '/api/translate', { text: handoff.text || undefined, symptoms: handoff.symptoms, lang, ...(c ? { card: c } : {}) })
      if (r.kind === 'crisis') return setCrisis({ message: r.message!, helplines: r.helplines! })
      setCard(r.card); setTones(r.tones)
    } catch { setErr('fl_error') }
  }

  useEffect(() => {
    void load()
    void api<{ people: Person[] }>('GET', '/api/people').then((r) => {
      const ok = r.people.filter((p) => !p.contentOnly && !p.paused && p.permissions.signals)
      setPeople(ok); setTo(Object.fromEntries(ok.map((p, i) => [p.id, i === 0])))
    }).catch(() => setErr('fl_error'))
    void api<{ cards: { type: string; text: Record<Lang, string> }[] }>('GET', '/api/cards').then((r) => setCardsText(Object.fromEntries(r.cards.map((c) => [c.type, c.text]))))
    return () => { stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickCard = (c: CardType) => { setCard(c); void load(c) }
  const sentence = tones?.[tone] ?? ''
  const words = sentence.split(' ').filter(Boolean)
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    const id = window.setInterval(() => setN((x) => (x >= words.length ? x : x + 1)), 80)
    return () => window.clearInterval(id)
  }, [sentence, words.length])

  const play = () => { if (playing) { stopSpeaking(); setPlaying(false) } else { setPlaying(true); speak(sentence, lang, () => setPlaying(false)) } }
  const copy = async () => { try { await navigator.clipboard.writeText(sentence); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } catch { /* the sentence is on screen to read out */ } }

  const chosen = (people ?? []).filter((p) => to[p.id])
  const send = async () => {
    setBusy(true); setErr(null)
    try {
      const r = await api<{ sent: Sent[] }>('POST', '/api/signals', { cardType: card, personIds: chosen.map((p) => p.id) })
      setSent(r.sent); setStage('sent'); clearHandoff()
    } catch (e) { setErr(e instanceof ApiError && e.code === 'consent_required' ? 'vl_consent' : 'fl_error') } finally { setBusy(false) }
  }

  if (crisis)
    return (
      <Screen bg="wash" header={<TopBar title={t('sayit')} />}>
        <div role="alert" className="px-5 pb-8">
          <h1 className="mt-4 text-[28px] font-bold">{t('cr_title')}</h1>
          <p className="mt-3 text-[20px] leading-relaxed">{crisis.message}</p>
          <div className="mt-6 flex flex-col gap-3">{crisis.helplines.map((h) => <a key={h.number} href={`tel:${h.number}`} className="btn-primary"><Phone size={20} /> {t('cr_call', { name: h.name, number: h.number })}</a>)}</div>
          <button onClick={() => go('/home')} className="btn-ghost mt-4 w-full">{t('cr_ok')}</button>
        </div>
      </Screen>
    )

  return (
    <Screen bg="wash" header={<TopBar title={t('sayit')} />}>
      {/* no AnimatePresence exit here: waiting on the tone selector's shared-layout pill could leave the sent screen stuck */}
      <>
        {stage === 'compose' ? (
          <motion.div key="c" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5 pb-8">
            {handoff.text && (
              <div className="rounded-[22px] border border-white/70 bg-white/45 p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-ink-soft"><Lock size={14} /> {t('tr_yours')}</div>
                <p className="line-clamp-3 text-[15px] leading-relaxed text-ink-soft">{handoff.text}</p>
              </div>
            )}
            <div className="my-2 flex items-center justify-center gap-2 text-[14px] font-medium text-rose-pressed"><ArrowDown size={18} /><Sparkles size={16} /> {t('tr_becomes')}</div>

            <motion.div layout className="relative overflow-hidden rounded-[28px] bg-white p-5 shadow-soft">
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-peach-light opacity-70 blur-2xl" />
              <p className="relative min-h-[96px] text-[21px] font-semibold leading-snug" data-testid="sentence" aria-live="polite">
                {tones ? <>{words.slice(0, n).join(' ')}{n < words.length && <span className="ml-0.5 inline-block h-6 w-0.5 translate-y-1 animate-pulse bg-rose" />}</> : <span className="text-ink-soft">{t('tl_thinking')}</span>}
              </p>
              <div className="relative mt-3"><Segmented value={tone} onChange={setTone} options={[{ id: 'gentle', label: t('tone_gentle') }, { id: 'direct', label: t('tone_direct') }, { id: 'light', label: t('tone_light') }]} /></div>
              <div className="relative mt-3 grid grid-cols-2 gap-2">
                <button onClick={play} disabled={!tones} className="btn-ghost min-h-[48px] disabled:opacity-50">{playing ? <><Square size={16} /> {t('tl_stop')}</> : <><Volume2 size={18} /> {t('tl_play')}</>}</button>
                <button onClick={() => void copy()} disabled={!tones} className="btn-ghost min-h-[48px] disabled:opacity-50">{copied ? <><Check size={17} /> {t('tl_copied')}</> : <><Copy size={17} /> {t('tl_copy')}</>}</button>
              </div>
            </motion.div>
            <p className="mt-2 text-[13.5px] leading-snug text-ink-soft">{t('tl_hint')}</p>

            <div className="mb-2 mt-5 text-[15px] font-semibold">{t('tl_card')}</div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('tl_card')}>
              {CARDS.map((c, i) => (
                <button key={c} role="radio" aria-checked={card === c} onClick={() => pickCard(c)} className={`min-h-[48px] rounded-full px-4 text-[15px] font-semibold transition ${card === c ? 'bg-white shadow-card ring-2 ring-rose' : 'bg-white/55'}`}>
                  <span className="mr-2 inline-block h-3 w-3 rounded-full align-middle" style={{ background: TINT[i] }} />{t(`tl_card_${c}` as StrKey)}
                </button>
              ))}
            </div>

            <div className="mb-2 mt-5 text-[15px] font-semibold">{t('tr_to')}</div>
            {people === null ? null : people.length === 0 ? (
              <div className="glass rounded-2xl p-4"><p className="text-[15px] leading-snug text-ink-soft">{t('tl_no_people')}</p><button onClick={() => go('/privacy')} className="btn-primary mt-3 w-full">{t('tl_add_people')}</button></div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {people.map((p) => {
                  const on = !!to[p.id]
                  return (
                    <button key={p.id} role="checkbox" aria-checked={on} onClick={() => setTo((s) => ({ ...s, [p.id]: !s[p.id] }))} className={`flex min-h-[52px] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 transition ${on ? 'bg-white shadow-card ring-2 ring-rose' : 'bg-white/55'}`}>
                      <span className="grid h-10 w-10 place-items-center rounded-full bg-peach-light text-[15px] font-bold text-ink">{p.name.slice(0, 1).toUpperCase()}</span>
                      <span className="text-left text-[15px] font-semibold leading-tight">{p.name}</span>
                      {on && <Check size={18} className="text-rose" />}
                    </button>
                  )
                })}
              </div>
            )}

            {chosen.length > 0 && cardsText[card] && (
              <div className="mt-5">
                <div className="mb-1.5 text-[14px] font-semibold text-ink-soft">{t('tl_they_see', { name: chosen[0].name })}</div>
                <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5" data-testid="card-preview">
                  <div className="text-[18px] font-bold leading-snug text-ink">{cardsText[card][chosen[0].lang]}</div>
                </div>
              </div>
            )}

            {err && <p role="alert" className="mt-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t(err)}</p>}
            <div className="mt-6 text-center text-[15px] text-ink-soft">{t('tr_approve')}</div>
            <button onClick={() => void send()} disabled={busy || chosen.length === 0} className="btn-primary mt-2 w-full disabled:opacity-50"><Send size={19} /> {t('tr_send')}</button>
            {people && people.length > 0 && chosen.length === 0 && <p className="mt-2 text-center text-[14px] text-ink-soft">{t('tl_pick_someone')}</p>}
          </motion.div>
        ) : (
          <motion.div key="s" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative px-5 pb-8">
            <FlyAway />
            <div className="flex flex-col items-center pt-4 text-center">
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 15, delay: 0.3 }} className="grid h-20 w-20 place-items-center rounded-full bg-rose text-white shadow-soft"><Check size={40} strokeWidth={3} /></motion.span>
              <h1 className="mt-4 px-4 text-[22px] font-bold leading-snug">{t('tl_sent_to')}</h1>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              {sent.map((s) => {
                const p = (people ?? []).find((x) => x.id === s.personId)
                if (!p) return null
                return (
                  <div key={s.signalId} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-black/5" data-testid="sent-card">
                    <div className="flex items-center justify-between text-[14px] font-semibold text-ink-soft"><span>{p.name}</span><span>{t(s.status === 'sent' ? 'tl_status_sent' : s.status === 'failed' ? 'tl_status_failed' : 'tl_status_link')}</span></div>
                    <div className="mt-1.5 text-[18px] font-bold leading-snug text-ink">{cardsText[card]?.[p.lang]}</div>
                  </div>
                )
              })}
            </div>
            <button onClick={() => go('/home')} className="btn-primary mt-6 w-full">{t('tl_done_home')}</button>
          </motion.div>
        )}
      </>
    </Screen>
  )
}
