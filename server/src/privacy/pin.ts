import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PIN_RE = /^\d{4,6}$/;
export const MAX_PIN_FAILS = 5;
export const PIN_LOCK_MS = 5 * 60_000;

/** salt:hash, both base64. scrypt keeps a stolen database from being brute-forced cheaply (a 4-digit PIN is still small: see THREAT-MODEL). */
export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('base64')}:${scryptSync(pin, salt, 32).toString('base64')}`;
}

export function checkPin(pin: string, stored: string): boolean {
  const [s, h] = stored.split(':');
  if (!s || !h) return false;
  const want = Buffer.from(h, 'base64');
  const got = scryptSync(pin, Buffer.from(s, 'base64'), want.length);
  return want.length === got.length && timingSafeEqual(want, got);
}
