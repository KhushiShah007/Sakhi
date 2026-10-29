import type { Lang } from '../config.js';
import { extract, reflect, type LlmProvider } from '../llm/provider.js';
import { crisisResponse, detectRedFlags, type CrisisResponse } from './redflags.js';
import { detectViolation, policyReply, type PolicyViolation } from './policy.js';
import { SYMPTOM_TO_MRS, type ConfirmedLog, type MrsItem, type Symptom } from './mrs.js';
import { sanitiseOutput, type Extraction } from './validate.js';

export interface ProposedEntry { id: string; symptom: Symptom; severity: number; time: string; trigger: string; mrsItem: MrsItem | null; status: 'proposed' }
export interface RefusalResponse { kind: 'refusal'; violation: PolicyViolation; message: string; llmUsed: false }
export interface NormalResponse { kind: 'reply'; message: string; proposals: ProposedEntry[]; extractionSource: 'llm' | 'rules'; outputBlocked: boolean; llmUsed: boolean }
export type UtteranceResult = CrisisResponse | RefusalResponse | NormalResponse;

/**
 * Order of operations for every utterance:
 *  1. deterministic red-flag rules  -> scripted reply + helplines, LLM bypassed
 *  2. deterministic policy rules    -> scripted refusal, LLM bypassed
 *  3. LLM extraction (Zod-validated, rules fallback) + reflection
 *  4. output blocklist on anything shown
 * Nothing here writes to her log: the result holds PROPOSALS only.
 */
export async function handleUtterance(text: string, lang: Lang, llm: LlmProvider | null, env: NodeJS.ProcessEnv = process.env): Promise<UtteranceResult> {
  const hits = detectRedFlags(text);
  if (hits.length) return crisisResponse(hits, lang, env);

  const violation = detectViolation(text);
  if (violation) return { kind: 'refusal', violation, message: policyReply(violation, lang), llmUsed: false };

  const { extraction, source } = await extract(text, llm, env);
  const proposals = toProposals(extraction);
  const reflection = await reflect(text, proposals.length, lang, llm, env);
  const safe = sanitiseOutput(reflection, lang);
  return { kind: 'reply', message: safe.text, proposals, extractionSource: source, outputBlocked: safe.blocked, llmUsed: !!llm };
}

function toProposals(e: Extraction): ProposedEntry[] {
  return e.symptoms.map((s, i) => ({ id: `p${i}`, symptom: s.symptom, severity: s.severity, time: s.time, trigger: s.trigger, mrsItem: SYMPTOM_TO_MRS[s.symptom], status: 'proposed' as const }));
}

export interface Confirmation { id: string; accept: boolean; severity?: number }

/**
 * The ONLY way a ConfirmedLog is created. Requires an explicit decision from her for every proposal;
 * a proposal with no decision is dropped, never saved by default.
 */
export function confirmEntries(proposals: ProposedEntry[], decisions: Confirmation[], at: Date = new Date()): ConfirmedLog[] {
  const byId = new Map(decisions.map((d) => [d.id, d]));
  const out: ConfirmedLog[] = [];
  for (const p of proposals) {
    const d = byId.get(p.id);
    if (!d || !d.accept) continue;
    const severity = Math.min(4, Math.max(0, Math.round(d.severity ?? p.severity)));
    out.push({ symptom: p.symptom, severity, at: at.toISOString() });
  }
  return out;
}
