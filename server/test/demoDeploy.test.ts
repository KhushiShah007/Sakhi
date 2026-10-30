import { describe, expect, it } from 'vitest';
import { applyDemoDeploy } from '../src/demoDeploy.js';
import { assertSafeBoot } from '../src/config.js';

describe('DEMO_DEPLOY=true', () => {
  it('turns production off and demo sign-in, badge and demo data on, so the container boots', () => {
    const env = { NODE_ENV: 'production', DEMO_DEPLOY: 'true' } as NodeJS.ProcessEnv;
    const lines = applyDemoDeploy(env);
    expect(env).toMatchObject({ NODE_ENV: 'development', DEMO_AUTH: 'true', DEMO_MODE: 'true', SEED_DEMO: 'true' });
    expect(() => assertSafeBoot(env)).not.toThrow();
    expect(lines.some((l) => /admin console key/.test(l))).toBe(true);
    expect(env.ADMIN_KEY!.length).toBeGreaterThanOrEqual(16);
  });
  it('keeps an admin key that was set, and does not print it', () => {
    const env = { DEMO_DEPLOY: 'true', ADMIN_KEY: 'my-own-key' } as NodeJS.ProcessEnv;
    const lines = applyDemoDeploy(env);
    expect(env.ADMIN_KEY).toBe('my-own-key'); expect(lines.join(' ')).not.toContain('my-own-key');
  });
  it('does nothing unless it is exactly "true": production stays strict', () => {
    for (const v of [undefined, 'false', '1', 'TRUE']) {
      const env = { NODE_ENV: 'production', DEMO_DEPLOY: v } as NodeJS.ProcessEnv;
      expect(applyDemoDeploy(env)).toEqual([]); expect(env.NODE_ENV).toBe('production'); expect(env.DEMO_AUTH).toBeUndefined();
    }
  });
  it('without it, production with demo sign-in still refuses to start', () => {
    expect(() => assertSafeBoot({ NODE_ENV: 'production', DEMO_AUTH: 'true' } as NodeJS.ProcessEnv)).toThrow();
  });
});
