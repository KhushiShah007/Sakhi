import { useCallback, useEffect, useState } from 'react'
import { api } from './client'
import { useLive } from './session'
import type { Mood } from '../mock/user'

export interface HomeData {
  name: string | null
  city: string | null
  today: string
  weekday: number
  week: { date: string; day: number; kind: 'past' | 'today' | 'forecast' | 'future'; mood: Mood | null; load: number }[]
  month: (Mood | null)[]
  todayTop: { symptom: string; severity: number }[]
  loggedToday: boolean
  daysCheckedLast7: number
  weather: {
    level: 'low' | 'moderate' | 'high'; score: number; estimate: true; note: string; shared: boolean
    factors: { id: 'sleep' | 'hot_flash' | 'stress' | 'heat' | 'humidity' | 'aqi'; label: string; points: number }[]
    tomorrow: { tempC: number; humidityPct: number; aqi: number | null } | null
  }
  milestones: { firstWeek: boolean; firstSignal: boolean; firstBrief: boolean }
}

/** Live Home data. `data` stays null in demo/offline mode so screens fall back to the scripted version. */
export function useHome() {
  const live = useLive()
  const [data, setData] = useState<HomeData | null>(null)
  const [error, setError] = useState(false)
  const reload = useCallback(async () => {
    if (!live) return
    try { setData(await api<HomeData>('GET', '/api/home')); setError(false) } catch { setError(true) }
  }, [live])
  useEffect(() => { void reload() }, [reload])
  useEffect(() => {
    // coming back to the tab (e.g. after a vent) refreshes the numbers
    const on = () => { if (document.visibilityState === 'visible') void reload() }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [reload])
  return { live, data, error, reload }
}
