/**
 * In-memory handoff between screens (Vent -> Say it for me). Never persisted: her words live only in this tab's
 * memory until she sends or leaves, and are cleared by `clearHandoff`.
 */
export interface Handoff { text: string; symptoms: string[] }
let current: Handoff = { text: '', symptoms: [] }
export const setHandoff = (h: Handoff) => { current = h }
export const getHandoff = (): Handoff => current
export const clearHandoff = () => { current = { text: '', symptoms: [] } }
