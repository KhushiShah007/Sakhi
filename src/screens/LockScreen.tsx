import { useEffect, useState, type ReactNode } from 'react'
import { Lock, NotebookPen } from 'lucide-react'
import { useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { ApiError } from '../api/client'
import { useSession } from '../api/session'

/** Looks like an ordinary notes app on purpose: shared phones should not announce what this is. */
export function LockScreen() {
  const { t } = useI18n()
  const { unlock, logout } = useSession()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<StrKey | null>(null)
  const [left, setLeft] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true); setErr(null)
    try { await unlock(pin) }
    catch (e) {
      setPin('')
      if (e instanceof ApiError && e.status === 429) { setErr('pv_pin_locked'); setLeft(null) }
      else if (e instanceof ApiError && e.status === 401) { setErr('pv_pin_wrong'); setLeft((e.body as { attemptsLeft?: number }).attemptsLeft ?? null) }
      else setErr('fl_error')
    } finally { setBusy(false) }
  }

  return (
    <div className="grid h-[100dvh] place-items-center bg-[#F4F1EA] px-6">
      <form className="flex w-full max-w-[340px] flex-col items-center text-center" onSubmit={(e) => { e.preventDefault(); if (pin.length >= 4) void submit() }}>
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white shadow-card"><NotebookPen size={30} className="text-[#5B6378]" /></span>
        <h1 className="mt-4 text-[22px] font-semibold text-[#2F3547]">Notes</h1>
        <p className="mt-1 flex items-center gap-1.5 text-[15px] text-[#5B6378]"><Lock size={14} /> {t('lk_sub')}</p>
        <label className="mt-6 block w-full text-left">
          <span className="mb-1.5 block text-[15px] font-semibold text-[#2F3547]">{t('lk_title')}</span>
          <input
            type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={6} value={pin} aria-label={t('lk_title')}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            className="h-14 w-full rounded-2xl border border-[#CFD3DE] bg-white px-4 text-center text-[24px] tracking-[0.5em] text-[#2F3547] outline-none focus:border-[#5B6378] focus:ring-2 focus:ring-[#5B6378]/30"
          />
        </label>
        {err && <p role="alert" className="mt-3 text-[15px] font-medium text-[#8A1F42]">{t(err)}{left !== null && ` (${left})`}</p>}
        <button type="submit" disabled={busy || pin.length < 4} className="mt-5 min-h-[52px] w-full rounded-full bg-[#2F3547] text-[16px] font-semibold text-white disabled:opacity-50">{t('lk_enter')}</button>
        <button type="button" onClick={() => void logout()} className="mt-3 min-h-[48px] text-[15px] font-medium text-[#5B6378] underline">{t('lk_out')}</button>
      </form>
    </div>
  )
}

/** Locks the whole app while a PIN is required, and blanks it when the tab goes to the background (best effort for app switchers). */
export function LockGate({ children }: { children: ReactNode }) {
  const { status, me } = useSession()
  const [covered, setCovered] = useState(false)
  const discreet = status === 'authed' && !!me?.discreet
  useEffect(() => {
    if (!discreet) return
    const hide = () => setCovered(document.visibilityState === 'hidden')
    const blur = () => setCovered(true)
    const focus = () => setCovered(false)
    document.addEventListener('visibilitychange', hide); window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus) }
  }, [discreet])

  if (status === 'authed' && me?.locked) return <LockScreen />
  return (
    <>
      {children}
      {covered && <div data-testid="privacy-cover" className="fixed inset-0 z-[100] bg-[#F4F1EA]" aria-hidden />}
    </>
  )
}
