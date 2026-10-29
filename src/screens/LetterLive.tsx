import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Footprints, Lock, MessageCircleHeart, Mic, Pencil, Share2, Volume2 } from 'lucide-react'
import { useI18n } from '../i18n'
import { api, ApiError } from '../api/client'
import { Screen, TopBar } from '../components/ui'
import { Lotus } from '../illustrations/art'
import { speak, stopSpeaking } from '../voice/speech'

interface Letter { id: string; month: string; greeting: string; paragraphs: string[]; sign: string; stats: { checkInDays: number; signalsSent: number } }

/** Live Letter to Myself: built from her confirmed logs, in her language, private until she shares it. */
export default function LetterLive() {
  const { t, lang } = useI18n()
  const [letters, setLetters] = useState<{ month: string }[] | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [l, setL] = useState<Letter | null>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState<{ id: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [reading, setReading] = useState(false)
  const [err, setErr] = useState(false)
  const hand = lang === 'gu' ? 'font-sans' : 'font-hand'

  const loadList = useCallback(async () => {
    try { const r = await api<{ letters: { month: string }[] }>('GET', '/api/letters'); setLetters(r.letters); setMonth((m) => m ?? r.letters[0]?.month ?? null) } catch { setErr(true) }
  }, [])
  useEffect(() => { void loadList(); return () => stopSpeaking() }, [loadList])
  useEffect(() => { if (month) { setLink(null); void api<Letter>('GET', `/api/letters/${month}`).then(setL).catch(() => setErr(true)) } }, [month])

  const write = async () => {
    setBusy(true); setErr(false)
    try { const r = await api<Letter>('POST', '/api/letters/generate', { lang }); setMonth(r.month); setL(r); await loadList() }
    catch (e) { setErr(!(e instanceof ApiError) || e.status !== 403) } finally { setBusy(false) }
  }
  const read = () => { if (reading) { stopSpeaking(); setReading(false); return } if (!l) return; setReading(true); speak([l.greeting, ...l.paragraphs, l.sign].join(' '), lang, () => setReading(false)) }
  const share = async () => { if (!month) return; try { const r = await api<{ id: string; link: string }>('POST', `/api/letters/${month}/share`); setLink(r) } catch { setErr(true) } }
  const stop = async () => { if (!link) return; await api('DELETE', `/api/letters/shares/${link.id}`); setLink(null) }
  const copy = async () => { if (!link) return; try { await navigator.clipboard.writeText(link.link); setCopied(true); window.setTimeout(() => setCopied(false), 1500) } catch { /* shown on screen */ } }
  const label = (m: string) => new Intl.DateTimeFormat(`${lang}-IN`, { month: 'long', year: 'numeric' }).format(new Date(`${m}-15T00:00:00Z`))

  return (
    <Screen bg="wash" header={<TopBar title={t('lt_title')} />}>
      <div className="px-5 pb-10">
        {err && <p role="alert" className="mb-3 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}
        {letters && letters.length === 0 && !l && (
          <div className="glass rounded-[24px] p-5 text-center"><p className="text-[16px] leading-relaxed text-ink-soft">{t('lt_none')}</p><button onClick={() => void write()} disabled={busy} className="btn-primary mt-4 w-full disabled:opacity-60"><Pencil size={18} /> {t('lt_write')}</button></div>
        )}
        {letters && letters.length > 1 && (
          <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">{letters.map((x) => <button key={x.month} aria-pressed={month === x.month} onClick={() => setMonth(x.month)} className={`min-h-[44px] shrink-0 rounded-full px-4 text-[14px] font-semibold ${month === x.month ? 'bg-rose text-white' : 'glass'}`}>{label(x.month)}</button>)}</div>
        )}
        {l && (
          <>
            <div className="mb-4 flex flex-wrap justify-center gap-2">
              <span className="chip"><Mic size={15} className="text-rose" /> {t('lt_checkins')}: {l.stats.checkInDays}</span>
              <span className="chip"><Footprints size={15} className="text-peri-deep" /> {label(l.month)}</span>
              {l.stats.signalsSent > 0 && <span className="chip"><MessageCircleHeart size={15} className="text-rose" /> {t('lt_signals')}: {l.stats.signalsSent}</span>}
            </div>
            <motion.article initial={{ opacity: 0, y: 24, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: -0.8 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }} className="relative rounded-[26px] px-6 pb-7 pt-9 shadow-soft" style={{ background: 'radial-gradient(120% 80% at 0% 0%, #FFFFFF 0%, #FFFAF3 60%, #FFF3E8 100%)' }} data-testid="letter">
              <span className="absolute -top-3 left-8 h-7 w-24 -rotate-6 rounded-sm bg-peach/60" /><span className="absolute -top-3 right-10 h-7 w-20 rotate-3 rounded-sm bg-lavender/80" />
              <Lotus className="absolute -right-5 -top-5 h-20 w-20 opacity-70" />
              <div className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-rose-pressed">{label(l.month)}</div>
              <div className={`${hand} text-[26px] font-bold leading-[34px] text-ink`}>{l.greeting}</div>
              {l.paragraphs.map((p, i) => <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.2 }} className={`${hand} mt-3 text-[19px] leading-[31px] text-ink`}>{p}</motion.p>)}
              <div className={`${hand} relative mt-2 text-right text-[20px] font-bold leading-[34px] text-rose-pressed`}>{l.sign}</div>
            </motion.article>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[13.5px] text-ink-soft"><Lock size={14} /> {t('lt_private_note')}</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={read} className="btn-primary px-3"><Volume2 size={18} /> {reading ? t('n_stop') : t('lt_read')}</button>
              <button onClick={() => void share()} className="btn-ghost px-3"><Share2 size={17} /> {t('lt_share')}</button>
            </div>
            <button onClick={() => void write()} disabled={busy} className="btn-ghost mt-3 w-full disabled:opacity-60"><Pencil size={17} /> {t('lt_rewrite')}</button>
            {link && (
              <div className="mt-3 rounded-2xl bg-white p-4 shadow-card" data-testid="letter-share">
                <p className="text-[14px] leading-snug text-ink-soft">{t('lt_link')}</p>
                <div className="mt-2 break-all rounded-xl bg-[#F6EFEA] px-3 py-2 text-[13px]" data-testid="letter-link">{link.link}</div>
                <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => void copy()} className="btn-ghost min-h-[48px] bg-white">{copied ? <><Check size={16} /> {t('ob_who_copied')}</> : <><Copy size={16} /> {t('bl_copy')}</>}</button><button onClick={() => void stop()} className="btn-ghost min-h-[48px] bg-white">{t('bl_stop')}</button></div>
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  )
}
