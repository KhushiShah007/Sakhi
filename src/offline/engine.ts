// The same safety pipeline and role-play engine the server runs, in the browser, for the static/offline build (no API, no keys, rules only).
// Red flags first, then policy refusals, then rules. Nothing here is sent anywhere.
export { handleUtterance, confirmEntries } from '../../server/src/safety/pipeline'
export type { ProposedEntry, UtteranceResult } from '../../server/src/safety/pipeline'
export { detectRedFlags, crisisResponse } from '../../server/src/safety/redflags'
export { detectViolation, policyReply } from '../../server/src/safety/policy'
export { openingLine, ruleReply, MAX_TURNS } from '../../server/src/rehearsal/engine'
export type { Scenario } from '../../server/src/rehearsal/engine'
export { evaluateRehearsal } from '../../server/src/rehearsal/feedback'
