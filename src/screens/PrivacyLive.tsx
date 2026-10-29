import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Briefcase, ChevronDown, CloudSun, Download, Eye, EyeOff, GraduationCap, HeartHandshake, KeyRound, Link2, Lock, Pause, Play, Plus, Radio, ScrollText, ShieldCheck, Trash2, UserX } from 'lucide-react'
import { useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, ApiError, setCsrf, type Consents, type Purpose } from '../api/client'
import { markUnlocked, useSession } from '../api/session'
import AddPerson, { type Added } from '../components/AddPerson'
import { BottomNav } from '../components/Frame'
import { Screen, Switch } from '../components/ui'
import { useGo } from '../components/nav'
import { HeroSwirls } from '../illustrations/art'

interface Person { id: string; name: string; role: string; lang: Lang; contentOnly: boolean; paused: boolean; permissions: { signals: boolean; alerts: boolean; coaching: boolean }; lastSignal: { type: string; sentAt: string; status: 'new' | 'done' | 'needs_help' } | null }
interface Preview { cards: { id: string; type: string; text: string; status: string }[]; alert: string | null; lessons: { id: string; title: string }[]; contentOnly: boolean }
const ROLE_KEY: Record<string, StrKey> = { husband: 'rel_husband', son: 'role_son', daughter: 'role_daughter', teen: 'role_teen', sister: 'role_sister', friend: 'rel_friend', asha: 'role_asha', other: 'role_other' }
const PURPOSES: { id: Purpose; t: StrKey; s: StrKey }[] = [
  { id: 'core_logging', t: 'cs_core', s: 'cs_core_s' }, { id: 'family_signals', t: 'cs_family', s: 'cs_family_s' }, { id: 'doctor_brief', t: 'cs_brief', s: 'cs_brief_s' },
  { id: 'employer_aggregate', t: 'cs_employer', s: 'cs_employer_s' }, { id: 'research_atlas', t: 'cs_research', s: 'cs_research_s' }, { id: 'store_audio', t: 'cs_audio', s: 'cs_audio_s' },
]
const field = 'h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-4 text-[18px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose/30'
const PERMS = [['signals', Radio, 'perm_signals'], ['alerts', CloudSun, 'perm_weather'], ['coaching', GraduationCap, 'perm_learning']] as const

/** Live Family & Privacy centre: per-person permissions, exact preview, pause/revoke, consents with history, PIN, export, audit, deletion. */
export default function PrivacyLive() {
  const { t, lang } = useI18n()
  const go = useGo()
  const { me, refresh } = useSession()
  const [people, setPeople] = useState<Person[] | null>(null)
  const [consents, setConsents] = useState<Consents | null>(null)
  const [adding, setAdding] = useState(false)
  const [fresh, setFresh] = useState<{ id: string; title: string; link: string } | null>(null)
  const [preview, setPreview] = useState<{ id: string; data: Preview } | null>(null)
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [audit, setAudit] = useState<{ actor: string; action: string; resource: string; at: string }[] | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pin, setPin] = useState({ cur: '', next: '', open: false })
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; key: StrKey } | null>(null)
  const [err, setErr] = useState(false)
  const [wp, setWp] = useState<{ membership: { name: string; location: string } | null; code: string; found: { name: string; locations: string[] } | null; loc: string; msg: StrKey | null }>({ membership: null, code: '', found: null, loc: '', msg: null })

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([api<{ people: Person[] }>('GET', '/api/people'), api<Consents>('GET', '/api/consents')])
      setPeople(p.people); setConsents(c); setErr(false)
    } catch { setErr(true) }
  }, [])
  useEffect(() => { void load() }, [load])
  useEffect(() => { void api<{ membership: { name: string; location: string } | null }>('GET', '/api/employer/membership').then((r) => setWp((w) => ({ ...w, membership: r.membership }))).catch(() => {}) }, [])
  const findEmployer = async () => {
    setWp((w) => ({ ...w, msg: null, found: null }))
    try { const r = await api<{ name: string; locations: string[] }>('GET', `/api/employer/lookup?code=${encodeURIComponent(wp.code.trim())}`); setWp((w) => ({ ...w, found: r, loc: r.locations[0] ?? '' })) }
    catch { setWp((w) => ({ ...w, msg: 'wp_not_found' })) }
  }
  const joinEmployer = async () => {
    try { await api('POST', '/api/employer/join', { code: wp.code.trim(), location: wp.loc }); const m = await api<{ membership: { name: string; location: string } | null }>('GET', '/api/employer/membership'); setWp((w) => ({ ...w, membership: m.membership, found: null, code: '', msg: null })) }
    catch (e) { setWp((w) => ({ ...w, msg: e instanceof ApiError && e.status === 403 ? 'wp_need_consent' : 'wp_not_found' })) }
  }
  const leaveEmployer = async () => { await api('DELETE', '/api/employer/membership'); setWp((w) => ({ ...w, membership: null })) }

  const showPreview = async (id: string, keep = false) => {
    if (!keep && preview?.id === id) return setPreview(null)
    setPreview({ id, data: await api<Preview>('GET', `/api/people/${id}/preview`) })
  }
  const patch = async (id: string, body: Record<string, boolean>) => { await api('PATCH', `/api/people/${id}`, body); await load(); if (preview?.id === id) await showPreview(id, true) }
  const newLink = async (p: Person) => { const r = await api<{ link: string }>('POST', `/api/people/${p.id}/rotate-link`); setFresh({ id: p.id, title: t('pv_link_title', { name: p.name }), link: r.link }) }
  const revoke = async (id: string) => { await api('DELETE', `/api/people/${id}`); setConfirmRevoke(null); setPreview(null); await load() }
  const setConsent = async (purpose: Purpose, granted: boolean) => { await api('POST', '/api/consents', { purpose, granted }); await load() }
  const setDiscreet = async (v: boolean) => { await api('PATCH', '/api/me', { discreet: v }); await refresh() }

  const savePin = async () => {
    setPinMsg(null)
    try {
      await api('POST', '/api/pin', { pin: pin.next, ...(me?.hasPin ? { currentPin: pin.cur } : {}) })
      markUnlocked(); await refresh(); setPin({ cur: '', next: '', open: false }); setPinMsg({ ok: true, key: 'pv_pin_saved' })
    } catch (e) { setPinMsg({ ok: false, key: e instanceof ApiError && e.status === 429 ? 'pv_pin_locked' : e instanceof ApiError && e.status === 401 ? 'pv_pin_wrong' : 'fl_error' }) }
  }
  const removePin = async () => {
    setPinMsg(null)
    try { await api('DELETE', '/api/pin', { pin: pin.cur }); await refresh(); setPin({ cur: '', next: '', open: false }) }
    catch (e) { setPinMsg({ ok: false, key: e instanceof ApiError && e.status === 429 ? 'pv_pin_locked' : 'pv_pin_wrong' }) }
  }

  const download = async () => {
    const data = await api('GET', '/api/export')
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'sakhi-my-data.json'; a.click(); URL.revokeObjectURL(url)
  }
  const loadAudit = async () => setAudit(audit ? null : (await api<{ entries: NonNullable<typeof audit> }>('GET', '/api/audit')).entries)
  const del = async () => { await api('DELETE', '/api/me'); setCsrf(''); await refresh(); go('/') }

  const statusText = (p: Person) => p.lastSignal ? `${t(`tl_card_${p.lastSignal.type}` as StrKey)} · ${t(p.lastSignal.status === 'done' ? 'pv_st_done' : p.lastSignal.status === 'needs_help' ? 'pv_st_help' : 'pv_st_new')}` : t('pv_last_none')

  return (
    <Screen nav={<BottomNav active="family" />}>
      <div className="px-5 pb-36">
        <div className="flex items-center justify-between pb-4 pt-2">
          <h1 className="text-[27px] font-bold tracking-tight">{t('fp_title')}</h1>
          <span className="icon-btn"><ShieldCheck size={22} className="text-rose-pressed" /></span>
        </div>

        <div className="waves relative overflow-hidden rounded-[30px] p-5 text-white shadow-soft">
          <HeroSwirls className="absolute inset-0 h-full w-full" />
          <div className="relative">
            <Lock size={22} />
            <div className="mt-2 text-[24px] font-bold leading-tight">{t('fp_hero_a')}</div>
            <div className="mt-1 text-[16px] text-white">{t('fp_hero_b')}</div>
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-medium"><Lock size={13} className="mr-1 inline" />{t('tr_yours').split('·')[0]}</span>
              <ArrowRight size={16} />
              <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-rose-pressed"><Radio size={13} className="mr-1 inline" />{t('perm_signals')}</span>
            </div>
          </div>
        </div>

        {err && <p role="alert" className="mt-4 rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15.5px] font-medium text-[#8A1F42]">{t('fl_error')} <button className="underline" onClick={() => void load()}>{t('fl_retry')}</button></p>}

        <h2 className="h-section mb-3 mt-6">{t('fp_people')}</h2>
        <div className="flex flex-col gap-3">
          {people?.length === 0 && <p className="glass rounded-[24px] p-4 text-[15.5px] text-ink-soft">{t('pv_none')}</p>}
          {people?.map((p) => (
            <motion.div layout key={p.id} data-testid="person-card" className={`glass rounded-[24px] p-4 ${p.paused ? 'opacity-90' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-peach-light text-[18px] font-bold">{p.name.slice(0, 1).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold leading-tight">{p.name}</div>
                  <div className="text-[14px] text-ink-soft">{t(ROLE_KEY[p.role] ?? 'role_other')}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${p.paused ? 'bg-[#EFE6EA] text-ink-soft' : 'bg-[#E3F3EA] text-[#24563F]'}`}>{p.paused ? t('paused') : `● ${t('live')}`}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {PERMS.map(([k, Icon, label]) => {
                  const off = p.contentOnly && k !== 'coaching'
                  const on = p.permissions[k] && !p.paused && !off
                  return (
                    <button key={k} disabled={off} onClick={() => void patch(p.id, { [`perm_${k}`]: !p.permissions[k] })} aria-pressed={on} aria-label={`${p.name}: ${t(label)}`} className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 text-[14px] font-medium transition disabled:opacity-40 ${on ? 'bg-rose text-white' : 'bg-white/70 text-ink-soft'}`}>
                      <Icon size={15} /> {t(label)}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 text-[13.5px] text-ink-soft">{p.contentOnly ? t('ob_who_teen') : `${t('fp_last')}: ${statusText(p)}`}</div>
              <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-white/80 pt-2">
                <button onClick={() => void showPreview(p.id)} aria-expanded={preview?.id === p.id} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[14px] font-semibold text-rose-pressed"><Eye size={15} /> {t('pv_preview', { name: p.name })}</button>
                <button onClick={() => void patch(p.id, { paused: !p.paused })} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[14px] font-semibold text-rose-pressed">{p.paused ? <Play size={15} /> : <Pause size={15} />} {p.paused ? t('resume') : t('pause')}</button>
                <button onClick={() => void newLink(p)} className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-2.5 text-[14px] font-semibold text-rose-pressed"><Link2 size={15} /> {t('pv_new_link')}</button>
                <button onClick={() => setConfirmRevoke(p.id)} aria-label={`${t('revoke')} ${p.name}`} className="grid h-11 w-11 place-items-center rounded-full text-ink-soft"><Trash2 size={17} /></button>
              </div>
              {confirmRevoke === p.id && (
                <div role="alertdialog" className="mt-2 rounded-2xl bg-[#FBEDEF] p-3">
                  <p className="text-[15px] font-medium text-[#8A1F42]">{t('pv_revoke_q', { name: p.name })}</p>
                  <div className="mt-2 flex gap-2"><button onClick={() => void revoke(p.id)} className="btn-primary min-h-[48px] flex-1 px-3"><UserX size={17} /> {t('pv_revoke_yes')}</button><button onClick={() => setConfirmRevoke(null)} className="btn-ghost flex-1">{t('pv_cancel')}</button></div>
                </div>
              )}
              {fresh?.id === p.id && (
                <div className="mt-2 rounded-2xl bg-white/80 p-3"><div className="text-[13.5px] text-ink-soft">{fresh.title}</div><div className="mt-1 break-all text-[13px]" data-testid="new-link">{fresh.link}</div></div>
              )}
              {preview?.id === p.id && (
                <div className="mt-2 rounded-2xl bg-white/80 p-3" data-testid="preview">
                  <div className="text-[13.5px] font-semibold text-ink-soft">{t('pv_preview', { name: p.name })}</div>
                  {preview.data.cards.length + (preview.data.alert ? 1 : 0) === 0 && <div className="mt-1 text-[15px] text-ink-soft">{t('pv_preview_empty')}</div>}
                  {preview.data.cards.map((c) => <div key={c.id} className="mt-1.5 rounded-xl bg-[#FFF4EC] p-2.5 text-[15.5px] font-semibold">{c.text}</div>)}
                  {preview.data.alert && <div className="mt-1.5 rounded-xl bg-[#FDE3D5] p-2.5 text-[15px] font-semibold">{preview.data.alert}</div>}
                </div>
              )}
            </motion.div>
          ))}
        </div>

        {adding ? (
          <div className="mt-3">
            <AddPerson herLabel={me?.name ?? ''} onAdded={(a: Added) => { setFresh({ id: a.id, title: t('ob_who_link', { name: a.name }), link: a.link }); setAdding(false); void load() }} onNoConsent={() => { void setConsent('family_signals', true).then(() => setAdding(true)) }} />
          </div>
        ) : (
          <button onClick={() => setAdding(true)} className="btn-ghost mt-3 w-full"><Plus size={18} /> {t('add_person')}</button>
        )}
        {people?.some((p) => p.role === 'asha' || p.role === 'sister' || p.role === 'friend') && (
          <div className="mt-3 flex items-center gap-2 px-1 text-[13.5px] text-ink-soft"><HeartHandshake size={16} /> {t('trusted')}</div>
        )}

        <h2 className="h-section mb-3 mt-8">{t('pv_choices')}</h2>
        <div className="flex flex-col gap-2.5">
          {PURPOSES.map((c) => (
            <div key={c.id} className="glass flex items-center gap-3 rounded-2xl p-3.5">
              <div className="min-w-0 flex-1"><div className="text-[16px] font-semibold leading-snug">{t(c.t)}</div><div className="text-[13.5px] leading-snug text-ink-soft">{t(c.s)}</div></div>
              <Switch on={!!consents?.current[c.id]} label={t(c.t)} onChange={(v) => void setConsent(c.id, v)} />
            </div>
          ))}
        </div>
        <button onClick={() => setShowHistory((v) => !v)} aria-expanded={showHistory} className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-[14.5px] font-semibold text-rose-pressed"><ScrollText size={16} /> {t('pv_history')} ({consents?.history.length ?? 0}) <ChevronDown size={16} className={showHistory ? 'rotate-180' : ''} /></button>
        {showHistory && (
          <ul className="glass mt-1 flex flex-col gap-1.5 rounded-2xl p-3 text-[14px]" data-testid="consent-history">
            {[...(consents?.history ?? [])].reverse().map((h, i) => <li key={i} className="flex justify-between gap-2"><span>{t(PURPOSES.find((x) => x.id === h.purpose)!.t)}</span><span className="shrink-0 text-ink-soft">{t(h.granted ? 'pv_granted' : 'pv_withdrawn')} · {new Date(h.at).toLocaleDateString(`${lang}-IN`)}</span></li>)}
          </ul>
        )}

        <div className="glass mt-8 rounded-[24px] p-4" data-testid="workplace">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#DCE0F7]"><Briefcase size={20} className="text-ink" /></span><div className="min-w-0 flex-1"><div className="text-[17px] font-semibold leading-tight">{t('wp_title')}</div><div className="text-[14px] leading-snug text-ink-soft">{t('wp_sub')}</div></div></div>
          {wp.membership ? (
            <div className="mt-3"><p className="rounded-2xl bg-[#E3F3EA] px-4 py-3 text-[15px] font-medium text-[#24563F]">{t('wp_member', { name: wp.membership.name, loc: wp.membership.location })}</p><button onClick={() => void leaveEmployer()} className="btn-ghost mt-2 w-full">{t('wp_leave')}</button></div>
          ) : (
            <div className="mt-3 flex flex-col gap-2.5">
              <div className="flex gap-2"><input className={field + ' flex-1'} aria-label={t('wp_code')} placeholder={t('wp_code')} value={wp.code} onChange={(e) => setWp((w) => ({ ...w, code: e.target.value }))} /><button onClick={() => void findEmployer()} disabled={wp.code.trim().length < 3} className="btn-ghost min-w-[88px] disabled:opacity-50">{t('wp_find')}</button></div>
              {wp.found && (
                <>
                  <div className="text-[15px] font-semibold">{wp.found.name}</div>
                  <div className="text-[14px] font-semibold">{t('wp_pick')}</div>
                  <div className="flex flex-wrap gap-2">{wp.found.locations.map((l) => <button key={l} aria-pressed={wp.loc === l} onClick={() => setWp((w) => ({ ...w, loc: l }))} className={`min-h-[44px] rounded-full px-4 text-[14.5px] font-semibold ${wp.loc === l ? 'bg-rose text-white' : 'bg-white/70'}`}>{l}</button>)}</div>
                  <button onClick={() => void joinEmployer()} className="btn-primary">{t('wp_join')}</button>
                </>
              )}
              {wp.msg && <p role="alert" className="rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15px] font-medium text-[#8A1F42]">{t(wp.msg)}</p>}
            </div>
          )}
        </div>

        <div className="glass mt-4 rounded-[24px] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white"><EyeOff size={20} /></span>
            <div className="min-w-0 flex-1"><div className="text-[17px] font-semibold leading-tight">{t('discreet')}</div><div className="text-[14px] leading-snug text-ink-soft">{t('discreet_s')}</div></div>
            <Switch on={!!me?.discreet} onChange={(v) => void setDiscreet(v)} label={t('discreet')} />
          </div>
          {me?.discreet && (
            <div className="mt-3">
              <button onClick={() => setPin((p) => ({ ...p, open: !p.open }))} aria-expanded={pin.open} className="btn-ghost w-full"><KeyRound size={18} /> {t(me.hasPin ? 'pv_pin_change' : 'pv_pin_set')}</button>
              {pin.open && (
                <div className="mt-3 flex flex-col gap-3">
                  {me.hasPin && <input className={field} type="password" inputMode="numeric" maxLength={6} aria-label={t('pv_pin_current')} placeholder={t('pv_pin_current')} value={pin.cur} onChange={(e) => setPin((p) => ({ ...p, cur: e.target.value.replace(/\D/g, '') }))} />}
                  <input className={field} type="password" inputMode="numeric" maxLength={6} aria-label={t('pv_pin_new')} placeholder={t('pv_pin_new')} value={pin.next} onChange={(e) => setPin((p) => ({ ...p, next: e.target.value.replace(/\D/g, '') }))} />
                  <button onClick={() => void savePin()} disabled={pin.next.length < 4 || (!!me.hasPin && pin.cur.length < 4)} className="btn-primary disabled:opacity-50">{t('me_save')}</button>
                  {me.hasPin && <button onClick={() => void removePin()} disabled={pin.cur.length < 4} className="btn-ghost disabled:opacity-50">{t('pv_pin_remove')}</button>}
                </div>
              )}
              {pinMsg && <p role={pinMsg.ok ? 'status' : 'alert'} className={`mt-3 rounded-2xl px-4 py-3 text-[15px] font-medium ${pinMsg.ok ? 'bg-[#E3F3EA] text-[#24563F]' : 'bg-[#FBEDEF] text-[#8A1F42]'}`}>{t(pinMsg.key)}</p>}
            </div>
          )}
        </div>

        <h2 className="h-section mb-3 mt-8">{t('pv_data')}</h2>
        <div className="glass divide-y divide-white/80 rounded-[24px] px-3">
          <button onClick={() => void download()} className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left"><Download size={20} className="shrink-0 text-rose-pressed" /><span><span className="block text-[16px] font-semibold">{t('pv_export')}</span><span className="block text-[13.5px] text-ink-soft">{t('pv_export_s')}</span></span></button>
          <button onClick={() => void loadAudit()} aria-expanded={!!audit} className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left"><ScrollText size={20} className="shrink-0 text-rose-pressed" /><span><span className="block text-[16px] font-semibold">{t('pv_audit')}</span><span className="block text-[13.5px] text-ink-soft">{t('pv_audit_s')}</span></span></button>
          {audit && <ul className="flex flex-col gap-1 py-2 text-[13.5px]" data-testid="audit-list">{audit.slice(0, 30).map((a, i) => <li key={i} className="flex justify-between gap-2"><span>{a.action.replace(/_/g, ' ')} · {a.resource}</span><span className="shrink-0 text-ink-soft">{new Date(a.at).toLocaleString(`${lang}-IN`, { dateStyle: 'short', timeStyle: 'short' })}</span></li>)}</ul>}
          <button onClick={() => setConfirmDelete(true)} className="flex min-h-[64px] w-full items-center gap-3 py-2 text-left"><Trash2 size={20} className="shrink-0 text-[#8A1F42]" /><span><span className="block text-[16px] font-semibold text-[#8A1F42]">{t('pv_delete')}</span><span className="block text-[13.5px] text-ink-soft">{t('pv_delete_s')}</span></span></button>
        </div>
        {confirmDelete && (
          <div role="alertdialog" className="mt-3 rounded-2xl bg-[#FBEDEF] p-4">
            <p className="text-[15.5px] font-medium text-[#8A1F42]">{t('pv_delete_s')}</p>
            <div className="mt-3 flex gap-2"><button onClick={() => void del()} className="btn-primary min-h-[48px] flex-1 px-3">{t('pv_delete_yes')}</button><button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1">{t('pv_cancel')}</button></div>
          </div>
        )}
      </div>
    </Screen>
  )
}
