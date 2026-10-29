import { createHash, createHmac, randomUUID } from 'node:crypto';
import { generateLetter, prevMonth, monthOf } from './api/letters.js';
import { istDay } from './api/home.js';
import { dbFromEnv, migrate, type Db } from './db/index.js';
import { encrypt, keyFromEnv } from './privacy/crypto.js';
import type { Symptom } from './safety/mrs.js';

/**
 * Demo data. EVERY person, number and employer here is fictional. Safe to run twice.
 *   npm run seed   ->  Sunita (48, Pune), her family, and "Navrang Textiles" with 300+ synthetic employees.
 * Demo sign-in: phone 9999900001, code 123456 (needs DEMO_AUTH=true; never enable that in production).
 */
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const DEMO_PHONE = '+919999900001';
export const HR_CODE = 'NAVRANG-HR-DEMO';
export const INVITE_CODE = 'NAVRANG';

export async function seed(db: Db, env: NodeJS.ProcessEnv = process.env, now = new Date()) {
  const key = keyFromEnv(env);
  const phoneHash = (p: string) => createHmac('sha256', key).update(p).digest('hex');
  const rand = rng(20261029);
  const out = { sunita: false, employees: 0 };

  // ---------- Sunita and her household
  let sunita = (await db.query<{ id: string }>('SELECT id FROM users WHERE phone_hash=$1', [phoneHash(DEMO_PHONE)]))[0]?.id;
  if (!sunita) {
    sunita = randomUUID();
    await db.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang, name, stage, city, onboarded) VALUES ($1,$2,$3,$4,'hi','Sunita','perimenopause','Pune',TRUE)", [sunita, phoneHash(DEMO_PHONE), encrypt(DEMO_PHONE, key, `phone:${sunita}`), now.getFullYear() - 48]);
    for (const p of ['core_logging', 'family_signals', 'doctor_brief', 'employer_aggregate']) await db.query('INSERT INTO consents(user_id, purpose, granted) VALUES ($1,$2,TRUE)', [sunita, p]);
    // four weeks of CONFIRMED logs (symptom, severity, time, trigger: never words)
    const plan: [Symptom, string, string][] = [['hot_flash', 'afternoon', 'heat'], ['night_sweats', 'night', 'unspecified'], ['poor_sleep', 'night', 'stress'], ['night_waking', 'night', 'unspecified'], ['fatigue', 'morning', 'unspecified'], ['irritability', 'evening', 'family'], ['joint_pain', 'morning', 'unspecified'], ['low_mood', 'evening', 'stress'], ['anxiety', 'evening', 'work'], ['brain_fog', 'afternoon', 'unspecified'], ['bladder_urgency', 'evening', 'unspecified']];
    for (let d = 27; d >= 0; d--) {
      if (rand() < 0.2) continue; // not every day
      const at = new Date(now.getTime() - d * 86400_000 - 3 * 3600_000);
      const picks = new Set<number>(); const k = 2 + Math.floor(rand() * 3);
      while (picks.size < k) picks.add(Math.floor(rand() * plan.length));
      for (const i of picks) { const [sym, time, trig] = plan[i]; await db.query('INSERT INTO logs(id, user_id, symptom, severity, at, time_of_day, trigger) VALUES ($1,$2,$3,$4,$5,$6,$7)', [randomUUID(), sunita, sym, 1 + Math.floor(rand() * 4), at.toISOString(), time, trig]); }
    }
    await db.query("INSERT INTO checkins(user_id, day, mood) VALUES ($1,$2,'tired') ON CONFLICT DO NOTHING", [sunita, istDay(now)]);
    const person = async (name: string, role: string, lang: string, contentOnly = false, phone?: string) => {
      const id = randomUUID(); const token = `demo-${role}-${id.slice(0, 8)}`;
      await db.query('INSERT INTO people(id, user_id, name_enc, her_label, role, lang, phone_enc, link_token_hash, content_only) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, sunita, encrypt(name, key, `person:${id}:name`), 'Sunita', role, lang, phone ? encrypt(phone, key, `person:${id}:phone`) : null, sha(token), contentOnly]);
      return id;
    };
    const rajesh = await person('Rajesh', 'husband', 'hi'); await person('Anaya', 'teen', 'en', true); await person('Meena Tai', 'friend', 'mr');
    const sig = async (card: string, daysAgo: number, done: boolean, helped: boolean) => {
      await db.query('INSERT INTO signals(id, user_id, person_id, card_type, sent_at, delivery_status, done_at, helped_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [randomUUID(), sunita, rajesh, card, new Date(now.getTime() - daysAgo * 86400_000).toISOString(), 'link_only', done ? new Date(now.getTime() - daysAgo * 86400_000 + 600_000).toISOString() : null, helped ? new Date(now.getTime() - daysAgo * 86400_000 + 7200_000).toISOString() : null]);
    };
    await sig('take_over_dinner', 12, true, true); await sig('need_space', 8, true, true); await sig('rough_night', 5, true, false); await sig('overwhelmed', 2, false, false);
    await db.query('INSERT INTO household_alerts(user_id, for_date, level) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [sunita, istDay(new Date(now.getTime() + 86400_000)), 'moderate']);
    // last month's letter (the monthly job would write it on the 1st); this month's is one tap away
    await generateLetter(db, key, sunita, prevMonth(monthOf(istDay(now))), 'hi', now);
    await generateLetter(db, key, sunita, monthOf(istDay(now)), 'hi', now);
    out.sunita = true;
  }

  // ---------- Navrang Textiles: 308 synthetic employees across five sites, two of them too small to show
  const exists = (await db.query('SELECT 1 FROM employers WHERE invite_code=$1', [INVITE_CODE])).length > 0;
  if (!exists) {
    const sites: [string, number][] = [['Pune HQ', 142], ['Mumbai office', 96], ['Nashik plant', 58], ['Ahmedabad branch', 7], ['Surat warehouse', 5]];
    await db.query('INSERT INTO employers(id, name, invite_code, hr_code_hash, eligible, locations, flexi_supported, resources) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)', [
      'navrang', 'Navrang Textiles (fictional)', INVITE_CODE, sha(HR_CODE), 1140, sites.map(([n]) => n), 41,
      JSON.stringify([{ title: 'Menopause-aware leave & flexi policy', status: 'Live' }, { title: 'Cooling stations on plant floors', status: 'Rolling out' }, { title: 'Manager training: 30-minute module', status: '68% done' }, { title: 'Confidential tele-consults (2 per year)', status: 'Live' }])]);
    const syms: Symptom[] = ['hot_flash', 'poor_sleep', 'fatigue', 'brain_fog', 'joint_pain', 'low_mood', 'anxiety', 'night_waking', 'irritability'];
    const weight: Record<string, number> = { poor_sleep: 0.64, fatigue: 0.58, hot_flash: 0.51, brain_fog: 0.37, joint_pain: 0.33, low_mood: 0.29, anxiety: 0.2, night_waking: 0.3, irritability: 0.25 };
    for (const [site, count] of sites) {
      for (let i = 0; i < count; i++) {
        const id = randomUUID(); const phone = `+9170${String(Math.floor(rand() * 1e8)).padStart(8, '0')}`;
        const stages = ['perimenopause', 'perimenopause', 'menopause', 'surgical_early'];
        const signedUp = new Date(now.getTime() - (29 + Math.floor(rand() * 6)) * 86400_000);
        await db.query("INSERT INTO users(id, phone_hash, phone_enc, birth_year, lang, stage, onboarded, created_at, first_consult_at) VALUES ($1,$2,'synthetic',$3,'en',$4,TRUE,$5,$6) ON CONFLICT DO NOTHING", [id, phoneHash(phone + id), 1968 + Math.floor(rand() * 20), stages[Math.floor(rand() * stages.length)], signedUp.toISOString(), rand() < 0.3 ? istDay(new Date(signedUp.getTime() + (10 + Math.floor(rand() * 18)) * 86400_000)) : null]);
        if (rand() < 0.6) await db.query("INSERT INTO consents(user_id, purpose, granted) VALUES ($1,'research_atlas',TRUE)", [id]);
        const optIn = rand() < 0.93; // some never consent: they must never be counted
        if (optIn) await db.query("INSERT INTO consents(user_id, purpose, granted) VALUES ($1,'employer_aggregate',TRUE)", [id]);
        await db.query('INSERT INTO employer_members(user_id, employer_id, location) VALUES ($1,$2,$3)', [id, 'navrang', site]);
        if (!optIn || rand() < 0.1) continue;
        const days = 3 + Math.floor(rand() * 14);
        for (let d = 0; d < days; d++) {
          const at = new Date(now.getTime() - Math.floor(rand() * 28) * 86400_000).toISOString();
          for (const s of syms) if (rand() < weight[s] * 0.12) await db.query('INSERT INTO logs(id, user_id, symptom, severity, at) VALUES ($1,$2,$3,$4,$5)', [randomUUID(), id, s, 1 + Math.floor(rand() * 4), at]);
        }
        out.employees++;
      }
    }
  }
  return { ...out, sunitaPhone: DEMO_PHONE, hrCode: HR_CODE, invite: INVITE_CODE };
}

// `npm run seed`
if (process.argv[1] && /seed\.(ts|js)$/.test(process.argv[1])) {
  const db = await dbFromEnv();
  await migrate(db);
  const r = await seed(db);
  console.log(`Seeded (fictional data). Sunita: sign in with ${r.sunitaPhone} and code 123456 (DEMO_AUTH=true). HR dashboard code: ${r.hrCode}. Employer invite code: ${r.invite}.`);
  await db.close();
}
