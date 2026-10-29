import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, setCsrf, type Health, type Me } from './client'
import { setServerTts } from '../voice/speech'
import { flushQueue } from './queue'

/**
 * offline = no API behind this page (static hosting): screens run on built-in demo data.
 * anon    = API present, nobody logged in.
 * netdown = the API exists and she has an account here, but the network is down: only Right Now and 3 AM run, never demo data.
 * authed  = logged in: screens use live data.
 */
type Status = 'loading' | 'offline' | 'netdown' | 'anon' | 'authed'
interface Ctx { status: Status; me: Me | null; health: Health | null; refresh: () => Promise<void>; logout: () => Promise<void>; unlock: (pin: string) => Promise<void> }
const UNLOCKED = 'sakhi.unlocked'
const HIDDEN_AT = 'sakhi.hiddenAt'
const SEEN = 'sakhi.hasAccount'
const lsGet = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }
const sessionStorageGet = (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }
const sessionStorageSet = (k: string, v: string) => { try { sessionStorage.setItem(k, v) } catch { /* private mode */ } }
const NEUTRAL_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%23F4F1EA'/%3E%3Cpath d='M18 20h28M18 30h28M18 40h18' stroke='%235B6378' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E"
function setIcon(href: string) { let l = document.querySelector<HTMLLinkElement>('link[rel="icon"]'); if (!l) { l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l) } l.href = href }
const SessionCtx = createContext<Ctx>({ status: 'loading', me: null, health: null, refresh: async () => {}, logout: async () => {}, unlock: async () => {} })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [health, setHealth] = useState<Health | null>(null)

  const refresh = useCallback(async () => {
    try {
      const h = await api<Health>('GET', '/healthz')
      setServerTts(h.tts === 'server') // natural voice from the server when a key is configured, browser voice otherwise
      setHealth(h)
    } catch (e) {
      // a non-JSON answer means there is no API at all (static hosting); a network error means the connection is down
      setMe(null)
      setStatus(!(e instanceof ApiError) && lsGet(SEEN) === '1' ? 'netdown' : 'offline')
      return
    }
    try {
      const sess = await api<{ authenticated: boolean; me?: Me & { csrf: string } }>('GET', '/api/session')
      if (!sess.authenticated || !sess.me) { setMe(null); setStatus('anon'); return }
      let m = sess.me
      setCsrf(m.csrf)
      // Discreet Mode: a freshly opened page must be unlocked with the PIN, even though the cookie is still valid
      if (m.hasPin && !m.locked && !sessionStorageGet(UNLOCKED)) {
        await api('POST', '/api/lock')
        m = await api<Me & { csrf: string }>('GET', '/api/me')
      }
      setMe(m); setStatus('authed'); lsSet(SEEN, '1')
      void flushQueue() // send anything saved while she was offline
    } catch (e) {
      setMe(null)
      setStatus(e instanceof ApiError && e.status === 401 ? 'anon' : !(e instanceof ApiError) && lsGet(SEEN) === '1' ? 'netdown' : 'offline')
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  // idle re-lock: leave the tab for a minute and the PIN is asked again
  useEffect(() => {
    if (!me?.hasPin) return
    const on = async () => {
      if (document.visibilityState === 'hidden') { sessionStorageSet(HIDDEN_AT, String(Date.now())); return }
      const at = Number(sessionStorageGet(HIDDEN_AT) ?? 0)
      if (at && Date.now() - at > 60_000 && !me.locked) {
        sessionStorageSet(UNLOCKED, '')
        try { await api('POST', '/api/lock') } catch { /* already gone */ }
        await refresh()
      }
    }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [me?.hasPin, me?.locked, refresh])

  // Discreet Mode looks like an ordinary notes app: tab title, icon and the installed-app manifest
  useEffect(() => {
    if (me?.discreet || me?.locked) { document.title = 'Notes'; setIcon(NEUTRAL_ICON); document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.setAttribute('href', './manifest-neutral.webmanifest') }
  }, [me?.discreet, me?.locked])

  // coming back online: re-check the session (this restores the CSRF token), which then syncs what was saved on this phone
  useEffect(() => { const on = () => { void refresh() }; window.addEventListener('online', on); return () => window.removeEventListener('online', on) }, [refresh])

  const unlock = useCallback(async (pin: string) => {
    await api('POST', '/api/pin/verify', { pin })
    sessionStorageSet(UNLOCKED, '1')
    await refresh()
  }, [refresh])

  const logout = useCallback(async () => {
    try { await api('POST', '/api/auth/logout') } catch { /* already gone */ }
    sessionStorageSet(UNLOCKED, '')
    setCsrf(''); setMe(null); setStatus('anon')
  }, [])

  const value = useMemo(() => ({ status, me, health, refresh, logout, unlock }), [status, me, health, refresh, logout, unlock])
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

/** Call after setting a PIN on a page that is already unlocked, so it is not locked straight away. */
export const markUnlocked = () => sessionStorageSet(UNLOCKED, '1')
export const useSession = () => useContext(SessionCtx)
/** True when real data should be used. Demo/embedded screens never call this as true. */
export const useLive = () => useContext(SessionCtx).status === 'authed'
