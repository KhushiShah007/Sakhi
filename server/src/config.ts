export type Lang = 'hi' | 'mr' | 'gu' | 'en';
export const LANGS: Lang[] = ['hi', 'mr', 'gu', 'en'];

export interface Helpline { name: string; number: string }

/** Helplines are configuration, not code. Override with HELPLINES_JSON. Defaults: India. */
export function helplines(env: NodeJS.ProcessEnv = process.env): Helpline[] {
  if (env.HELPLINES_JSON) {
    try {
      const v = JSON.parse(env.HELPLINES_JSON);
      if (Array.isArray(v) && v.every((h) => typeof h?.name === 'string' && typeof h?.number === 'string')) return v;
    } catch { /* fall through to defaults */ }
  }
  return [
    { name: 'Emergency', number: '112' },
    { name: 'Tele-MANAS', number: '14416' },
  ];
}

/** Production must never run with the fixed demo OTP. */
export function assertSafeBoot(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV === 'production' && env.DEMO_AUTH === 'true') {
    throw new Error('Refusing to start: DEMO_AUTH=true is not allowed when NODE_ENV=production');
  }
}
