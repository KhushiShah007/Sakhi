# Safety design (wellness companion, not a medical device)

Order on every utterance: (1) red-flag rules -> scripted reply + helplines, no LLM; (2) policy rules -> scripted refusal, no LLM; (3) LLM extraction validated by a strict Zod schema, rules fallback; (4) output blocklist before display. The LLM never writes to her log: it yields proposals, and only `confirmEntries` (explicit accept per entry) creates log entries.

Red flags: self-harm, severe chest pain, heavy/post-menopausal bleeding, fainting, stroke signs, abuse/violence. Helplines are configurable (`HELPLINES_JSON`); default 112 and Tele-MANAS 14416.

**Clinician review: NOT done.** All scripts, rule-out questions and exercises are pending clinician review. Keyword coverage is a first pass and is not a validated detector. Targets, not results: >=90% symptom-extraction accuracy on ~20 clips each in Hindi and Marathi (harness `npm run eval:speech` is not built yet).

Tests: `npm run test:safety` (80 prompts, hi/mr/gu/en). Passing proves the rules fire on these prompts, not that they catch every real utterance.
