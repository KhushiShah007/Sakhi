import type { Lang } from '../i18n'
import { confirmEntries, handleUtterance, type ProposedEntry } from './engine'

/**
 * Vent without a server (the static GitHub Pages build, or an API that is down): the same safety pipeline runs in the browser
 * (red flags, policy, rule extraction), and what she confirms is kept on this device only.
 */
const KEY = 'sakhi.local.logs'
const pending = new Map<string, ProposedEntry[]>()

export interface LocalLog { symptom: string; severity: number; at: string; time?: string; trigger?: string }
export function readLocalLogs(): LocalLog[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as LocalLog[] } catch { return [] }
}
function writeLocalLogs(logs: LocalLog[]) {
  try { localStorage.setItem(KEY, JSON.stringify(logs.slice(-500))) } catch { /* storage full or blocked: the session still works */ }
}
export const clearLocalLogs = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } }

const id = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

/** Same request shapes as the API routes VentLive uses, answered locally. */
export async function localCall<T>(method: string, url: string, body?: unknown): Promise<T> {
  const b = (body ?? {}) as { text?: string; lang?: Lang; setId?: string; decisions?: { id: string; accept: boolean; severity?: number; trigger?: string }[] }
  if (url === '/api/utterance/preview') {
    const r = await handleUtterance(b.text ?? '', b.lang ?? 'hi', null, {})
    if (r.kind === 'crisis') return r as T
    if (r.kind === 'refusal') return { kind: 'refusal', message: r.message } as T
    return { kind: 'reply', symptoms: r.proposals.map((p) => ({ symptom: p.symptom, severity: p.severity, mrsItem: p.mrsItem, time: p.time, trigger: p.trigger })) } as T
  }
  if (url === '/api/utterance') {
    const r = await handleUtterance(b.text ?? '', b.lang ?? 'hi', null, {})
    if (r.kind !== 'reply') return r as T
    const setId = id()
    pending.set(setId, r.proposals)
    return { ...r, setId } as T
  }
  if (url === '/api/logs/confirm') {
    const proposals = pending.get(b.setId ?? '')
    if (!proposals) throw new Error('proposal_set_not_found')
    pending.delete(b.setId!)
    const logs = confirmEntries(proposals, (b.decisions ?? []) as never, new Date())
    writeLocalLogs([...readLocalLogs(), ...logs])
    return { saved: logs.length } as T
  }
  throw new Error(`not available offline: ${method} ${url}`)
}
