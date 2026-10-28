import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { S, type Lang, type StrKey } from './strings'

export type { Lang, StrKey }
export { LANGS } from './strings'

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: StrKey, vars?: Record<string, string | number>) => string }
const I18nCtx = createContext<Ctx | null>(null)

const VALID: Lang[] = ['hi', 'mr', 'gu', 'en']

function initialLang(): Lang {
  // ?lang= can appear in the real query or inside the hash route (HashRouter)
  const m = window.location.href.match(/[?&]lang=(hi|mr|gu|en)/)
  if (m) return m[1] as Lang
  try {
    const saved = localStorage.getItem('sakhi.lang') as Lang | null
    if (saved && VALID.includes(saved)) return saved
  } catch { /* storage blocked */ }
  return 'hi'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)
  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('sakhi.lang', l) } catch { /* ignore */ }
  }, [])
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  const t = useCallback(
    (k: StrKey, vars?: Record<string, string | number>) => {
      let s: string = S[k]?.[lang] ?? S[k]?.en ?? k
      if (vars) for (const [vk, vv] of Object.entries(vars)) s = s.replace(`{${vk}}`, String(vv))
      return s
    },
    [lang],
  )
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export function useI18n() {
  const c = useContext(I18nCtx)
  if (!c) throw new Error('useI18n outside provider')
  return c
}

/** Pick a per-language value from a mock-data record. */
export function pick<T>(rec: Record<Lang, T>, lang: Lang): T {
  return rec[lang] ?? rec.en
}
