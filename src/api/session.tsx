import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, setCsrf, type Health, type Me } from './client'

/**
 * offline = no API behind this page (static hosting): screens run on built-in demo data.
 * anon    = API present, nobody logged in.
 * authed  = logged in: screens use live data.
 */
type Status = 'loading' | 'offline' | 'anon' | 'authed'
interface Ctx { status: Status; me: Me | null; health: Health | null; refresh: () => Promise<void>; logout: () => Promise<void> }
const SessionCtx = createContext<Ctx>({ status: 'loading', me: null, health: null, refresh: async () => {}, logout: async () => {} })

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [health, setHealth] = useState<Health | null>(null)

  const refresh = useCallback(async () => {
    try {
      setHealth(await api<Health>('GET', '/healthz'))
    } catch { setStatus('offline'); setMe(null); return }
    try {
      const m = await api<Me & { csrf: string }>('GET', '/api/me')
      setCsrf(m.csrf); setMe(m); setStatus('authed')
    } catch (e) {
      setMe(null)
      setStatus(e instanceof ApiError && e.status === 401 ? 'anon' : 'offline')
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const logout = useCallback(async () => {
    try { await api('POST', '/api/auth/logout') } catch { /* already gone */ }
    setCsrf(''); setMe(null); setStatus('anon')
  }, [])

  const value = useMemo(() => ({ status, me, health, refresh, logout }), [status, me, health, refresh, logout])
  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export const useSession = () => useContext(SessionCtx)
/** True when real data should be used. Demo/embedded screens never call this as true. */
export const useLive = () => useContext(SessionCtx).status === 'authed'
