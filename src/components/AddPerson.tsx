import { useState } from 'react'
import { LANGS, useI18n, type Lang } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { api, ApiError } from '../api/client'

export const ROLES: { id: string; t: StrKey }[] = [
  { id: 'husband', t: 'rel_husband' }, { id: 'son', t: 'role_son' }, { id: 'daughter', t: 'role_daughter' }, { id: 'teen', t: 'role_teen' },
  { id: 'sister', t: 'role_sister' }, { id: 'friend', t: 'rel_friend' }, { id: 'asha', t: 'role_asha' }, { id: 'other', t: 'role_other' },
]
export interface Added { id: string; name: string; link: string; contentOnly: boolean }

const field = 'h-14 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-4 text-[18px] text-ink outline-none focus:border-rose focus:ring-2 focus:ring-rose/30'
const chip = (on: boolean) => `min-h-[44px] rounded-full px-4 text-[15px] font-semibold transition ${on ? 'bg-rose text-white' : 'glass text-ink'}`

/** One form for adding family or a trusted person, used in onboarding and in the Family centre. */
export default function AddPerson({ herLabel, onAdded, onNoConsent }: { herLabel: string; onAdded: (a: Added) => void; onNoConsent?: () => void }) {
  const { t, lang } = useI18n()
  const [role, setRole] = useState('husband')
  const [who, setWho] = useState('')
  const [whoLang, setWhoLang] = useState<Lang>(lang)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(false)

  const add = async () => {
    if (!who.trim()) return
    setBusy(true); setErr(false)
    try {
      const r = await api<{ id: string; link: string; contentOnly: boolean }>('POST', '/api/people', {
        name: who.trim(), herLabel: herLabel.trim() || who.trim(), role, lang: whoLang,
        ...(phone.trim() && role !== 'teen' ? { phone: phone.replace(/[\s-]/g, '').replace(/^(\d{10})$/, '+91$1') } : {}),
      })
      onAdded({ id: r.id, name: who.trim(), link: r.link, contentOnly: r.contentOnly })
      setWho(''); setPhone('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) onNoConsent?.()
      else setErr(true)
    } finally { setBusy(false) }
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-2xl p-3.5">
      <div className="flex flex-wrap gap-2">
        {ROLES.map((r) => <button key={r.id} aria-pressed={role === r.id} onClick={() => setRole(r.id)} className={chip(role === r.id)}>{t(r.t)}</button>)}
      </div>
      {role === 'teen' && <p className="text-[13.5px] text-ink-soft">{t('ob_who_teen')}</p>}
      <input className={field} aria-label={t('ob_who_name')} placeholder={t('ob_who_name')} value={who} maxLength={60} onChange={(e) => setWho(e.target.value)} />
      <div>
        <div className="mb-1.5 text-[14px] font-semibold">{t('ob_who_lang')}</div>
        <div className="flex flex-wrap gap-2">{LANGS.map((l) => <button key={l.id} aria-pressed={whoLang === l.id} onClick={() => setWhoLang(l.id as Lang)} className={chip(whoLang === l.id)}>{l.native}</button>)}</div>
      </div>
      {role !== 'teen' && <input className={field} inputMode="tel" aria-label={t('ob_who_phone')} placeholder={t('ob_who_phone')} value={phone} onChange={(e) => setPhone(e.target.value)} />}
      {err && <p role="alert" className="rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15px] font-medium text-[#8A1F42]">{t('fl_error')}</p>}
      <button onClick={() => void add()} disabled={busy || !who.trim()} className="btn-primary disabled:opacity-50">{t('ob_who_add')}</button>
    </div>
  )
}
