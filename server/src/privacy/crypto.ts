import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** AES-256-GCM for sensitive fields at rest. Key = 32 bytes, base64, from SAKHI_DATA_KEY. Format: v1.iv.tag.ciphertext (base64url). */
export function keyFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.SAKHI_DATA_KEY;
  if (!raw) {
    if (env.NODE_ENV === 'production') throw new Error('SAKHI_DATA_KEY is required in production');
    // Dev/test only: deterministic key so local data survives restarts. Never used in production.
    return createHash('sha256').update('sakhi-dev-only-key').digest();
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('SAKHI_DATA_KEY must be 32 bytes, base64 encoded');
  return key;
}

export function encrypt(plain: string, key: Buffer, aad = ''): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

/** `aad` binds the ciphertext to its owner/field so a value copied to another row fails to decrypt. */
export function decrypt(blob: string, key: Buffer, aad = ''): string {
  const [v, iv, tag, ct] = blob.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('bad ciphertext');
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}
