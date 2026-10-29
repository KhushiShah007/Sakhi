# Safety design (wellness companion, not a medical device)

Order on every utterance: (1) red-flag rules -> scripted reply + helplines, no LLM; (2) policy rules -> scripted refusal, no LLM; (3) LLM extraction validated by a strict Zod schema, rules fallback; (4) output blocklist before display. The LLM never writes to her log: it yields proposals, and only `confirmEntries` (explicit accept per entry) creates log entries.

Red flags: self-harm, severe chest pain, heavy/post-menopausal bleeding, fainting, stroke signs, abuse/violence. Helplines are configurable (`HELPLINES_JSON`); default 112 and Tele-MANAS 14416.

**Clinician review: NOT done.** All scripts, rule-out questions and exercises are pending clinician review. Keyword coverage is a first pass and is not a validated detector. Targets, not results: >=90% symptom-extraction accuracy on ~20 clips each in Hindi and Marathi (harness `npm run eval:speech` is not built yet).

Tests: `npm run test:safety` (80 prompts, hi/mr/gu/en). Passing proves the rules fire on these prompts, not that they catch every real utterance.

## Validation plan (nothing below has been done yet)
1. **Clinician review.** Every wording in the content register (crisis scripts, rule-out questions, signal cards, lessons, Right Now) starts "pending clinician review". The admin console records a review only with a named clinician and a date; do not mark anything reviewed until it happened.
2. **Speech and extraction accuracy.** Target (a hypothesis): >= 90% symptom-extraction F1 on ~20 real clips each in Hindi and Marathi. Run your recogniser over the clips, save `{reference, asr, expected}` JSON per clip in `eval/speech/<lang>/`, then `npm run eval:speech`. The harness reports precision, recall, F1 and word error rate, and prints **"NOT A RESULT"** until there are ~20 real (non-fixture) items per language. Today it has only 7 demo fixtures.
3. **Red-flag coverage.** The 80-prompt suite (`npm run test:safety`) proves the rules fire on those prompts. Before a pilot: have clinicians and native speakers add real phrasings (including misspellings, code-switching and ASR errors), and measure recall on that set. The rules over-trigger by design (negations still trigger).
4. **Ethics approval and a named clinical advisor** before any pilot with real users.
5. **Honest framing in the product**: forecasts and the wellbeing index are labelled estimates; rule-out questions open a conversation and never diagnose; in the MENOS 2 trial (n=140) CBT reduced how much symptoms *bothered* women, not how often they happened.
