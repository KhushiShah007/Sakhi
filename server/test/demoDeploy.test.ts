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
  it('tolerates spaces, quotes and capitals in the value', () => {
    for (const v of ['true', ' true ', 'TRUE', '"true"', "'true'", 'True', '1', 'yes']) {
      const env = { NODE_ENV: 'production', DEMO_DEPLOY: v } as NodeJS.ProcessEnv;
      expect(applyDemoDeploy(env).length, v).toBeGreaterThan(0); expect(env.NODE_ENV).toBe('development');
    }
  });
  it('on Render with no database and no real sign-in it runs as a demo instead of crashing', () => {
    const env = { RENDER: 'true', NODE_ENV: 'production' } as NodeJS.ProcessEnv;
    const lines = applyDemoDeploy(env);
    expect(env.NODE_ENV).toBe('development'); expect(env.DEMO_AUTH).toBe('true'); expect(lines[0]).toMatch(/no DATABASE_URL/);
  });
  it('but a real deployment on Render (database or SMS sign-in configured) is never turned into a demo', () => {
    for (const extra of [{ DATABASE_URL: 'postgres://x' }, { OTP_WEBHOOK_URL: 'https://sms.example' }]) {
      const env = { RENDER: 'true', NODE_ENV: 'production', ...extra } as NodeJS.ProcessEnv;
      expect(applyDemoDeploy(env)).toEqual([]); expect(env.NODE_ENV).toBe('production'); expect(env.DEMO_AUTH).toBeUndefined();
    }
  });
  it('does nothing for off values and outside Render: production stays strict', () => {
    for (const v of [undefined, 'false', '0', 'no', '']) {
      const env = { NODE_ENV: 'production', DEMO_DEPLOY: v } as NodeJS.ProcessEnv;
      expect(applyDemoDeploy(env)).toEqual([]); expect(env.NODE_ENV).toBe('production'); expect(env.DEMO_AUTH).toBeUndefined();
    }
  });
  it('without it, production with demo sign-in still refuses to start', () => {
    expect(() => assertSafeBoot({ NODE_ENV: 'production', DEMO_AUTH: 'true' } as NodeJS.ProcessEnv)).toThrow();
  });
});
