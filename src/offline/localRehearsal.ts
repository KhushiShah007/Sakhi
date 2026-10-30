import type { Lang } from '../i18n'
import { crisisResponse, detectRedFlags, detectViolation, evaluateRehearsal, MAX_TURNS, openingLine, policyReply, ruleReply, type Scenario } from './engine'

/** Rehearsal without a server: same safety checks and role-play rules, sessions kept on this device only. */
export interface Turn { idx: number; who: 'me' | 'them'; text: string }
export interface Feedback { checks: { id: string; pass: boolean }[]; tip: string; summary: { turns: number; passed: number; of: number } }
export interface SessionFull { id: string; scenario: Scenario; lang: Lang; createdAt: string; endedAt: string | null; feedback: Feedback | null; turns: Turn[] }
export interface SessionItem { id: string; scenario: Scenario; lang: Lang; createdAt: string; endedAt: string | null; turns: number }
export type TurnResult = { reply: string; done: boolean; source: 'rules' } | { crisis: { message: string; helplines: { name: string; number: string }[] } } | { refusal: { message: string } }

const KEY = 'sakhi.local.rehearsal'
const read = (): SessionFull[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') as SessionFull[] } catch { return [] } }
const write = (s: SessionFull[]) => { try { localStorage.setItem(KEY, JSON.stringify(s.slice(-50))) } catch { /* storage full or blocked: the session still works in memory */ } }
const id = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)

export const local = {
  async create(scenario: Scenario, lang: Lang): Promise<{ id: string; opening: string }> {
    const opening = openingLine(scenario, lang)
    const s: SessionFull = { id: id(), scenario, lang, createdAt: new Date().toISOString(), endedAt: null, feedback: null, turns: [{ idx: 0, who: 'them', text: opening }] }
    write([...read(), s])
    return { id: s.id, opening }
  },
  async turn(sid: string, text: string): Promise<TurnResult> {
    const all = read(); const s = all.find((x) => x.id === sid)
    if (!s || s.endedAt) throw new Error('session_not_found')
    const hits = detectRedFlags(text)
    if (hits.length) { const c = crisisResponse(hits, s.lang, {}); return { crisis: { message: c.message, helplines: c.helplines } } }
    const v = detectViolation(text)
    if (v) return { refusal: { message: policyReply(v, s.lang) } }
    const turn = s.turns.filter((t) => t.who === 'me').length + 1
    const r = ruleReply({ scenario: s.scenario, lang: s.lang, said: text, earlier: s.turns.filter((t) => t.who === 'them').map((t) => t.text), turn })
    s.turns.push({ idx: s.turns.length, who: 'me', text }, { idx: s.turns.length + 1, who: 'them', text: r.reply })
    write(all)
    return { reply: r.reply, done: r.done || turn >= MAX_TURNS, source: 'rules' }
  },
  async end(sid: string): Promise<Feedback> {
    const all = read(); const s = all.find((x) => x.id === sid)
    if (!s) throw new Error('session_not_found')
    const mine = s.turns.filter((t) => t.who === 'me').map((t) => t.text)
    if (!mine.length) throw new Error('no_turns')
    const fb = evaluateRehearsal(mine, s.lang)
    s.feedback = { checks: fb.checks, tip: fb.tip, summary: { turns: mine.length, passed: fb.checks.filter((c) => c.pass).length, of: fb.checks.length } }
    s.endedAt ??= new Date().toISOString()
    write(all)
    return s.feedback
  },
  async list(): Promise<SessionItem[]> {
    return read().slice().reverse().map((s) => ({ id: s.id, scenario: s.scenario, lang: s.lang, createdAt: s.createdAt, endedAt: s.endedAt, turns: s.turns.filter((t) => t.who === 'me').length }))
  },
  async get(sid: string): Promise<SessionFull> {
    const s = read().find((x) => x.id === sid)
    if (!s) throw new Error('session_not_found')
    return s
  },
  async remove(sid: string): Promise<void> { write(read().filter((x) => x.id !== sid)) },
}
