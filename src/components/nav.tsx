import { createContext, useContext } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/** Inside /demo and /hero, screens are "embedded": taps advance the story instead of routing. */
type Embedded = { onGo: (to: string | -1) => void } | null
export const EmbeddedContext = createContext<Embedded>(null)
export const useEmbedded = () => useContext(EmbeddedContext)

export function useGo() {
  const nav = useNavigate()
  const emb = useContext(EmbeddedContext)
  return (to: string | -1) => {
    if (emb) return emb.onGo(to)
    if (to === -1) {
      if (window.history.length > 1) nav(-1)
      else nav('/home')
    } else nav(to)
  }
}

/** Read a query param, but only when the screen is routed (embedded screens are prop-driven). */
export function useParam(name: string): string | null {
  const [sp] = useSearchParams()
  const emb = useContext(EmbeddedContext)
  return emb ? null : sp.get(name)
}
