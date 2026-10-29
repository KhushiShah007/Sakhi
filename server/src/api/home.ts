import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/index.js';
import type { WeatherForecast, WeatherProvider } from '../providers/weather.js';
import { moodForDay, type Mood } from '../safety/mood.js';
import type { Symptom } from '../safety/mrs.js';
import { symptomWeather, type RecentSignals, type SymptomWeather } from '../safety/weather.js';
import type { Ctx } from './family.js';

const IST_MS = 5.5 * 3600_000;
/** Calendar day in India (all users are in India for now). Deterministic and driven by the injected clock. */
export const istDay = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T00:00:00Z') + n * 86400_000).toISOString().slice(0, 10);

interface LogRow { symptom: Symptom; severity: number; at: string; trigger: string }

/** Her own recent signals for the Symptom Weather score: distinct days, so one bad night counts once. */
export function signalsFrom(rows: LogRow[], today: string): RecentSignals {
  const from = addDays(today, -6);
  const inWindow = rows.filter((r) => { const d = istDay(new Date(r.at)); return d >= from && d <= today; });
  const days = (pred: (r: LogRow) => boolean) => new Set(inWindow.filter(pred).map((r) => istDay(new Date(r.at)))).size;
  return {
    poorSleepNights: days((r) => r.symptom === 'poor_sleep' || r.symptom === 'night_waking'),
    hotFlashDays: days((r) => r.symptom === 'hot_flash' || r.symptom === 'night_sweats'),
    stressTriggerDays: days((r) => r.trigger === 'stress'),
    windowDays: 7,
  };
}

export const loadRecentLogs = (db: Db, userId: string, now: Date, days = 40) =>
  db.query<LogRow>('SELECT symptom, severity, at, trigger FROM logs WHERE user_id=$1 AND at >= $2 ORDER BY at', [userId, new Date(now.getTime() - days * 86400_000).toISOString()]);

export async function weatherFor(db: Db, userId: string, now: Date, provider: WeatherProvider, override?: Partial<WeatherForecast>) {
  const city = (await db.query<{ city: string | null }>('SELECT city FROM users WHERE id=$1', [userId]))[0]?.city;
  const forecast = override?.tempC !== undefined || override?.humidityPct !== undefined || override?.aqi !== undefined ? null : city ? await provider.tomorrow(city) : null;
  const rows = await loadRecentLogs(db, userId, now, 10);
  const w: SymptomWeather = symptomWeather(signalsFrom(rows, istDay(now)), {
    tempC: override?.tempC ?? forecast?.tempC, humidityPct: override?.humidityPct ?? forecast?.humidityPct, aqi: override?.aqi ?? forecast?.aqi ?? undefined,
  });
  return { ...w, tomorrow: forecast, city: city ?? null };
}

export function registerHome(app: FastifyInstance, c: Ctx & { weather: WeatherProvider }) {
  const { db, now } = c;

  app.get('/api/home', c.guarded, async (req) => {
    const userId = req.auth!.userId;
    const u = (await db.query<{ name: string | null; city: string | null; lang: string }>('SELECT name, city, lang FROM users WHERE id=$1', [userId]))[0];
    const clock = now();
    const today = istDay(clock);
    const rows = await loadRecentLogs(db, userId, clock, 40);

    const byDay = new Map<string, LogRow[]>();
    for (const r of rows) { const d = istDay(new Date(r.at)); byDay.set(d, [...(byDay.get(d) ?? []), r]); }
    const dayMood = (d: string) => moodForDay((byDay.get(d) ?? []).map((r) => ({ symptom: r.symptom, severity: r.severity })));

    const dow = new Date(Date.parse(today + 'T00:00:00Z')).getUTCDay(); // 0 = Sunday
    const week = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, i - dow);
      const kind = date < today ? 'past' : date === today ? 'today' : date === addDays(today, 1) ? 'forecast' : 'future';
      const m = kind === 'past' || kind === 'today' ? dayMood(date) : { mood: null as Mood | null, load: 0 };
      return { date, day: Number(date.slice(8)), kind, mood: m.mood, load: m.load };
    });
    const month = Array.from({ length: 30 }, (_, i) => dayMood(addDays(today, i - 29)).mood);
    const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
    const todays = (byDay.get(today) ?? []).sort((a, b) => b.severity - a.severity);
    const uniqueToday = todays.filter((r, i, a) => a.findIndex((x) => x.symptom === r.symptom) === i).slice(0, 3);

    const w = await weatherFor(db, userId, clock, c.weather);
    const shared = (await db.query('SELECT 1 FROM household_alerts WHERE user_id=$1 AND for_date=$2', [userId, addDays(today, 1)])).length > 0;
    const allDays = new Set(rows.map((r) => istDay(new Date(r.at))));
    const [signals, brief] = await Promise.all([
      db.query('SELECT 1 FROM signals WHERE user_id=$1 LIMIT 1', [userId]),
      db.query("SELECT 1 FROM audit_log WHERE user_id=$1 AND resource='brief' LIMIT 1", [userId]),
    ]);

    return {
      name: u.name, city: u.city, today, weekday: dow, week, month,
      todayTop: uniqueToday.map((r) => ({ symptom: r.symptom, severity: r.severity })),
      loggedToday: todays.length > 0,
      daysCheckedLast7: last7.filter((d) => byDay.has(d)).length,
      weather: { level: w.level, score: w.score, factors: w.factors, estimate: true as const, note: w.note, tomorrow: w.tomorrow, shared },
      milestones: { firstWeek: allDays.size >= 7, firstSignal: signals.length > 0, firstBrief: brief.length > 0 },
    };
  });
}
