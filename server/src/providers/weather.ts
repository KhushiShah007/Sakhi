export interface WeatherForecast { tempC: number; humidityPct: number; aqi: number | null; source: string }
export interface WeatherProvider { name: string; tomorrow(city: string): Promise<WeatherForecast | null> }

/** Used when weather is unavailable or switched off. Symptom Weather then runs on her own logs only. */
export const noWeather: WeatherProvider = { name: 'none', tomorrow: async () => null };

const TTL_MS = 3 * 3600_000;
const get = async (f: typeof fetch, url: string) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  try { const r = await f(url, { signal: ctl.signal }); return r.ok ? await r.json() : null; } catch { return null; } finally { clearTimeout(t); }
};

/** Open-Meteo forecast + air quality. Free, no key. Any failure returns null (never throws, never blocks Home). */
export class OpenMeteoProvider implements WeatherProvider {
  name = 'open-meteo';
  private cache = new Map<string, { exp: number; v: WeatherForecast | null }>();
  constructor(private fetchImpl: typeof fetch = fetch, private now: () => number = Date.now) {}

  async tomorrow(city: string): Promise<WeatherForecast | null> {
    const key = city.trim().toLowerCase();
    if (!key) return null;
    const hit = this.cache.get(key);
    if (hit && hit.exp > this.now()) return hit.v;
    const v = await this.fetchFresh(city.trim());
    this.cache.set(key, { exp: this.now() + (v ? TTL_MS : 5 * 60_000), v }); // retry failures sooner
    return v;
  }

  private async fetchFresh(city: string): Promise<WeatherForecast | null> {
    const geo = await get(this.fetchImpl, `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const place = geo?.results?.[0];
    if (!place) return null;
    const { latitude, longitude } = place as { latitude: number; longitude: number };
    const [fc, aq] = await Promise.all([
      get(this.fetchImpl, `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max&hourly=relative_humidity_2m&forecast_days=2&timezone=auto`),
      get(this.fetchImpl, `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=us_aqi&forecast_days=2&timezone=auto`),
    ]);
    const temp = fc?.daily?.temperature_2m_max?.[1];
    if (typeof temp !== 'number') return null;
    const hum: unknown[] = fc?.hourly?.relative_humidity_2m ?? [];
    const afternoon = hum[24 + 14]; // tomorrow, 14:00 local
    const aqiHours = ((aq?.hourly?.us_aqi as (number | null)[] | undefined) ?? []).slice(24, 48).filter((x): x is number => typeof x === 'number');
    return {
      tempC: Math.round(temp),
      humidityPct: typeof afternoon === 'number' ? Math.round(afternoon) : 0,
      aqi: aqiHours.length ? Math.round(Math.max(...aqiHours)) : null,
      source: 'open-meteo',
    };
  }
}

export function weatherFromEnv(env: NodeJS.ProcessEnv = process.env): WeatherProvider {
  return env.WEATHER_PROVIDER === 'none' ? noWeather : new OpenMeteoProvider();
}
