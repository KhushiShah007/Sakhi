// The same safety pipeline the server runs, in the browser, for the static/offline build (no API, no keys, rules only).
// Red flags first, then policy refusals, then rule extraction. Nothing here is sent anywhere.
export { handleUtterance } from '../../server/src/safety/pipeline'
export { confirmEntries } from '../../server/src/safety/pipeline'
export type { ProposedEntry, UtteranceResult } from '../../server/src/safety/pipeline'
