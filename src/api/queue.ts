import { api, ApiError } from './client'

/**
 * Offline queue for the two one-tap, no-words writes (mood check-in, night waking). Everything else needs a connection.
 * Only a fixed allow-list can ever be queued, and it never holds anything she said.
 */
const KEY = 'sakhi.queue'
const ALLOWED = new Set(['/api/checkins', '/api/awakenings'])
interface Item { method: string; path: string; body?: unknown }

const read = (): Item[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Item[] } catch { return [] } }
const write = (q: Item[]) => { try { localStorage.setItem(KEY, JSON.stringify(q.slice(-50))) } catch { /* storage blocked: nothing to do */ } }
export const queued = () => read().length

/** Sends now; if the network is down, keeps it on this phone and returns queued=true. Real errors (403, 400) still throw. */
export async function apiQueued(method: string, path: string, body?: unknown): Promise<{ queued: boolean }> {
  try { await api(method, path, body); return { queued: false } }
  catch (e) {
    if (e instanceof TypeError && ALLOWED.has(path)) { write([...read(), { method, path, body }]); return { queued: true } }
    throw e
  }
}

/** Replays the queue in order. Stops at the first network failure; drops items the server rejects (they would never succeed). */
export async function flushQueue(): Promise<number> {
  const q = read(); let sent = 0
  for (const item of q) {
    if (!ALLOWED.has(item.path)) { sent++; continue }
    try { await api(item.method, item.path, item.body); sent++ }
    catch (e) {
      // 400/404/409/422: the server will never accept this item, so drop it. 401/403/423 (signed out, no CSRF yet, locked) and 429/5xx: keep it and try later.
      if (e instanceof ApiError && [400, 404, 409, 422].includes(e.status)) { sent++; continue }
      break
    }
  }
  write(q.slice(sent))
  return sent
}
