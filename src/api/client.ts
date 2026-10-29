/** Thin fetch wrapper for the Sakhi API. Same-origin in production (the API serves the app); proxied in dev. */
const API = (import.meta as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL ?? ''

let csrf = ''
export const setCsrf = (v: string) => { csrf = v }

export class ApiError extends Error {
  constructor(public status: number, public code: string, public body: unknown) { super(code) }
}

/** `null` means "no API here" (static hosting, offline): callers fall back to the built-in demo data. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    credentials: 'same-origin',
    headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-csrf-token': csrf } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  const isJson = (res.headers.get('content-type') ?? '').includes('json')
  if (!isJson) throw new ApiError(res.status, 'no_api', null)
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? 'error', data)
  return data as T
}

export interface Me { id: string; name: string | null; lang: 'hi' | 'mr' | 'gu' | 'en'; stage: string | null; city: string | null; discreet: boolean; onboarded: boolean; demoMode: boolean; csrf: string; age?: number; hasPin?: boolean; locked?: boolean }
export interface Health { ok: boolean; demoAuth: boolean; llm: string }
export type Purpose = 'core_logging' | 'family_signals' | 'doctor_brief' | 'employer_aggregate' | 'research_atlas' | 'store_audio'
export interface Consents { current: Record<Purpose, boolean>; history: { purpose: Purpose; granted: boolean; at: string }[] }
