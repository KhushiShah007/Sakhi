import { randomBytes } from 'node:crypto';

/**
 * One switch for a public DEMO deployment: DEMO_DEPLOY=true.
 * It turns production mode off (the image sets NODE_ENV=production, which forbids demo sign-in and demands a database),
 * enables demo sign-in (any phone number, code 123456), the DEMO badge and the fictional demo data, and makes an admin key
 * if none was given. Fictional data only. NEVER set this for real users: use the production setup (DATABASE_URL, SAKHI_DATA_KEY, OTP_WEBHOOK_URL).
 * Returns a list of lines to log.
 */
export function applyDemoDeploy(env: NodeJS.ProcessEnv): string[] {
  if (env.DEMO_DEPLOY !== 'true') return [];
  env.NODE_ENV = 'development';
  env.DEMO_AUTH = 'true';
  env.DEMO_MODE = 'true';
  env.SEED_DEMO = 'true';
  env.RATE_LIMIT_PER_MIN ??= '300';
  const lines = ['DEMO DEPLOY: demo sign-in is on (any phone number, code 123456) with fictional data. Not for real users.'];
  if (!env.ADMIN_KEY) { env.ADMIN_KEY = randomBytes(9).toString('hex'); lines.push(`DEMO DEPLOY: admin console key for this run: ${env.ADMIN_KEY}`); }
  return lines;
}
