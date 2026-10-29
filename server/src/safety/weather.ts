export interface WeatherInput { tempC?: number; humidityPct?: number; aqi?: number }
export interface RecentSignals { poorSleepNights: number; hotFlashDays: number; stressTriggerDays: number; windowDays: number }
export interface RiskFactor { id: 'sleep' | 'hot_flash' | 'stress' | 'heat' | 'humidity' | 'aqi'; label: string; points: number }
export interface SymptomWeather { score: number; level: 'low' | 'moderate' | 'high'; factors: RiskFactor[]; estimate: true; note: string }

/**
 * Transparent, additive, rules-based. Max 100. Every point is listed in `factors` so the user can see why.
 * It is an ESTIMATE from her own recent logs and today's weather; it is not a prediction or a medical measurement.
 */
export function symptomWeather(s: RecentSignals, w: WeatherInput): SymptomWeather {
  const f: RiskFactor[] = [];
  const frac = (n: number) => Math.min(1, n / Math.max(1, s.windowDays));
  const add = (id: RiskFactor['id'], label: string, points: number) => { if (points > 0) f.push({ id, label, points: Math.round(points) }); };

  add('sleep', 'Poor sleep in recent nights', frac(s.poorSleepNights) * 30);
  add('hot_flash', 'Hot flashes in recent days', frac(s.hotFlashDays) * 30);
  add('stress', 'Stress triggers in recent days', frac(s.stressTriggerDays) * 10);
  if (w.tempC !== undefined) add('heat', 'Warm weather', w.tempC >= 38 ? 15 : w.tempC >= 33 ? 10 : w.tempC >= 30 ? 5 : 0);
  if (w.humidityPct !== undefined) add('humidity', 'High humidity', w.humidityPct >= 75 ? 10 : w.humidityPct >= 60 ? 5 : 0);
  if (w.aqi !== undefined) add('aqi', 'Poor air quality', w.aqi >= 150 ? 5 : w.aqi >= 100 ? 3 : 0);

  const score = Math.min(100, f.reduce((a, x) => a + x.points, 0));
  const level = score >= 60 ? 'high' : score >= 30 ? 'moderate' : 'low';
  return { score, level, factors: f, estimate: true, note: 'An estimate from your own recent logs and today\'s weather. It is not a medical prediction.' };
}
