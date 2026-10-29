import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'
import { api } from '../api/client'
import { Switch } from './ui'

interface Reminders { checkinOn: boolean; checkinTime: string; weatherOn: boolean; devices: number; window: { from: string; until: string }; available: boolean }

const b64 = (s: string) => {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}
const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** Gentle reminders, opt-in. A lock-screen message never mentions her health. Nothing is sent between 21:00 and 08:00. */
export default function ReminderSettings() {
  const { t } = useI18n()
  const [r, setR] = useState<Reminders | null>(null)
  const [msg, setMsg] = useState<'denied' | 'failed' | null>(null)

  useEffect(() => { api<Reminders>('GET', '/api/reminders').then(setR).catch(() => setR(null)) }, [])
  if (!r) return null
  if (!r.available || !pushSupported()) return <p className="glass rounded-[24px] p-4 text-[14.5px] leading-snug text-ink-soft" data-testid="reminders-unavailable">{t('rm_unavailable')}</p>

  const save = async (n: Partial<Reminders>) => {
    const next = { checkinOn: r.checkinOn, checkinTime: r.checkinTime, weatherOn: r.weatherOn, ...n }
    setR(await api<Reminders>('PUT', '/api/reminders', next))
  }
  /** Asks the browser for permission only when she switches a reminder on, then registers this device. */
  const ensureDevice = async (): Promise<boolean> => {
    if (r.devices > 0 && Notification.permission === 'granted') return true
    if ((await Notification.requestPermission()) !== 'granted') { setMsg('denied'); return false }
    try {
      const cfg = await api<{ enabled: boolean; publicKey: string | null }>('GET', '/api/push/config')
      if (!cfg.publicKey) { setMsg('failed'); return false }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(cfg.publicKey) }))
      await api('POST', '/api/push/subscribe', { subscription: sub.toJSON() })
      return true
    } catch { setMsg('failed'); return false }
  }
  const toggle = async (key: 'checkinOn' | 'weatherOn', on: boolean) => {
    setMsg(null)
    if (on && !(await ensureDevice())) return
    await save({ [key]: on })
  }

  return (
    <div className="glass flex flex-col gap-3 rounded-[24px] p-4" data-testid="reminders">
      <div className="flex items-center justify-between gap-3">
        <span><span className="block text-[16px] font-semibold">{t('rm_checkin')}</span><span className="block text-[13.5px] text-ink-soft">{t('rm_checkin_s')}</span></span>
        <Switch on={r.checkinOn} onChange={(v) => void toggle('checkinOn', v)} label={t('rm_checkin')} />
      </div>
      {r.checkinOn && (
        <label className="block"><span className="mb-1 block text-[14px] font-semibold">{t('rm_time')}</span>
          <input type="time" min={r.window.from} max="20:59" value={r.checkinTime} onChange={(e) => e.target.value && void save({ checkinTime: e.target.value })} className="h-12 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-3 text-[17px]" />
        </label>
      )}
      <div className="flex items-center justify-between gap-3">
        <span><span className="block text-[16px] font-semibold">{t('rm_weather')}</span><span className="block text-[13.5px] text-ink-soft">{t('rm_weather_s')}</span></span>
        <Switch on={r.weatherOn} onChange={(v) => void toggle('weatherOn', v)} label={t('rm_weather')} />
      </div>
      <p className="text-[13px] leading-snug text-ink-soft">{t('rm_quiet')}</p>
      {msg && <p role="alert" className="rounded-2xl bg-[#FBEDEF] px-4 py-3 text-[15px] font-medium text-[#8A1F42]">{t(msg === 'denied' ? 'rm_denied' : 'rm_failed')}</p>}
    </div>
  )
}
