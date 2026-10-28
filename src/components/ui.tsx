import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGo } from './nav'
import { BatteryFull, ChevronLeft, Signal, Sparkles, Wifi } from 'lucide-react'
import { useI18n } from '../i18n'

// ------------------------------------------------------------------ shot mode
// Screenshots/recordings pass ?shot=1 so the fake status bar shows even at phone width.
const SHOT = (() => {
  try {
    if (/[?&]shot=1/.test(window.location.href)) sessionStorage.setItem('sakhi.shot', '1')
    return sessionStorage.getItem('sakhi.shot') === '1'
  } catch {
    return false
  }
})()
export const isShotMode = () => SHOT

// ------------------------------------------------------------------ toast
type ToastCtx = { show: (msg?: string) => void }
const ToastContext = createContext<ToastCtx>({ show: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children, fixed = false }: { children: ReactNode; fixed?: boolean }) {
  const { t } = useI18n()
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number>()
  const show = useCallback(
    (m?: string) => {
      setMsg(m ?? t('toast'))
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setMsg(null), 2600)
    },
    [t],
  )
  const value = useMemo(() => ({ show }), [show])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {msg && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12 }}
            className={`pointer-events-none ${fixed ? 'fixed bottom-8 left-1/2 w-[min(420px,90vw)] -translate-x-1/2' : 'absolute inset-x-5 bottom-28'} z-50 flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-[15px] leading-snug text-white shadow-soft`}
          >
            <Sparkles size={18} className="shrink-0 text-peach-light" />
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  )
}

// ------------------------------------------------------------------ status bar + prototype strip
export function StatusBar({ tone = 'dark', time = '9:41' }: { tone?: 'dark' | 'light'; time?: string }) {
  const c = tone === 'light' ? 'text-white' : 'text-ink'
  // On a real phone the OS draws its own status bar; only fake it inside the desktop frame / screenshots.
  if (!SHOT && window.innerWidth < 640) return <div style={{ height: 'max(12px, env(safe-area-inset-top))' }} />
  return (
    <div className={`status-bar flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[15px] font-semibold ${c}`}>
      <span>{time}</span>
      <span className="flex items-center gap-1.5">
        <Signal size={16} strokeWidth={2.6} />
        <Wifi size={16} strokeWidth={2.6} />
        <BatteryFull size={22} strokeWidth={2} />
      </span>
    </div>
  )
}

export function ProtoStrip({ tone = 'dark' }: { tone?: 'dark' | 'light' | 'night' }) {
  const { t } = useI18n()
  const cls =
    tone === 'light'
      ? 'bg-white/20 text-white'
      : tone === 'night'
        ? 'bg-white/5 text-[#B79AA8]'
        : 'bg-white/60 text-ink-soft'
  return (
    <div className="pointer-events-none flex justify-center">
      <span className={`rounded-full px-2.5 py-[2px] text-[10.5px] font-medium tracking-wide ${cls}`}>{t('proto')}</span>
    </div>
  )
}

// ------------------------------------------------------------------ screen shell
export type Bg = 'wash' | 'lilac' | 'ivory' | 'night' | 'rose' | 'plain'
const BG: Record<Bg, string> = {
  wash: 'wash',
  lilac: 'wash-lilac',
  ivory: 'bg-ivory',
  night: 'bg-plum-night',
  rose: 'bg-rose',
  plain: 'bg-[#F6EFEA]',
}

export function Screen({
  bg = 'wash',
  tone = 'dark',
  children,
  nav,
  header,
  className = '',
  scrollRef,
  backdrop,
}: {
  bg?: Bg
  tone?: 'dark' | 'light' | 'night'
  children: ReactNode
  nav?: ReactNode
  header?: ReactNode
  className?: string
  scrollRef?: React.Ref<HTMLDivElement>
  backdrop?: ReactNode
}) {
  return (
    <div className={`relative flex h-full w-full flex-col overflow-hidden ${BG[bg]}`}>
      {backdrop}
      <div className="relative z-20 shrink-0">
        <StatusBar tone={tone === 'dark' ? 'dark' : 'light'} />
        <ProtoStrip tone={tone} />
        {header}
      </div>
      <div ref={scrollRef} data-scroll className={`no-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto ${className}`}>
        {children}
      </div>
      {nav}
    </div>
  )
}

export function TopBar({ title, right, tone = 'dark', back = -1 }: { title?: ReactNode; right?: ReactNode; tone?: 'dark' | 'light'; back?: string | -1 }) {
  const go = useGo()
  const btn = tone === 'light' ? 'grid h-12 w-12 place-items-center rounded-full bg-white/20 text-white backdrop-blur' : 'icon-btn'
  return (
    <div className="flex items-center gap-3 px-5 pb-2 pt-2">
      <button aria-label="Back" className={btn} onClick={() => go(back)}>
        <ChevronLeft size={24} />
      </button>
      <div className={`min-w-0 flex-1 truncate text-center text-lg font-semibold ${tone === 'light' ? 'text-white' : 'text-ink'}`}>{title}</div>
      <div className="flex h-12 min-w-12 items-center justify-end">{right}</div>
    </div>
  )
}

// ------------------------------------------------------------------ small controls
export function Segmented<T extends string>({ options, value, onChange, dark = false }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; dark?: boolean }) {
  return (
    <div className={`relative inline-flex rounded-full p-1 ${dark ? 'bg-white/15' : 'bg-white/70'}`}>
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`relative z-10 min-h-[36px] rounded-full px-3.5 text-[14px] font-medium transition-colors ${active ? 'text-white' : dark ? 'text-white/85' : 'text-ink-soft'}`}
          >
            {active && <motion.span layoutId={`seg-${options.map((x) => x.id).join('')}`} className="absolute inset-0 -z-10 rounded-full bg-rose shadow-soft" />}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-rose' : 'bg-[#E3D3DA]'}`}
    >
      <motion.span layout className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow ${on ? 'right-1' : 'left-1'}`} />
    </button>
  )
}

export function Waveform({ bars = 32, active = true, color = '#D6336C', height = 40, className = '' }: { bars?: number; active?: boolean; color?: string; height?: number; className?: string }) {
  const seeds = useMemo(() => Array.from({ length: bars }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))), [bars])
  return (
    <div className={`flex items-center justify-center gap-[3px] ${className}`} style={{ height }} aria-hidden>
      {seeds.map((s, i) => (
        <span
          key={i}
          className={active ? 'wavebar' : ''}
          style={{
            width: 3.5,
            height: height * s,
            borderRadius: 4,
            background: color,
            opacity: 0.55 + s * 0.45,
            animationDuration: `${0.7 + ((i * 37) % 9) / 10}s`,
            animationDelay: `${-((i * 53) % 10) / 10}s`,
            transform: active ? undefined : `scaleY(${0.5 + s * 0.5})`,
          }}
        />
      ))}
    </div>
  )
}

/** The glowing "Listening to you" orb — the one mic control used across Sakhi. */
export function Orb({
  size = 150,
  active = false,
  label,
  sub,
  onClick,
  night = false,
}: {
  size?: number
  active?: boolean
  label?: ReactNode
  sub?: ReactNode
  onClick?: () => void
  night?: boolean
}) {
  return (
    <button
      onClick={onClick}
      aria-label={typeof label === 'string' ? label : 'Microphone'}
      className="group relative grid place-items-center rounded-full transition active:scale-95"
      style={{ width: size, height: size }}
    >
      {/* soft outer glow */}
      <motion.span
        className="absolute rounded-full"
        style={{
          inset: -size * 0.22,
          background: night
            ? 'radial-gradient(circle, rgba(214,51,108,0.28) 0%, rgba(214,51,108,0) 65%)'
            : 'radial-gradient(circle, rgba(251,162,171,0.75) 0%, rgba(254,163,142,0.35) 40%, rgba(255,255,255,0) 70%)',
        }}
        animate={{ scale: active ? [1, 1.12, 1] : [1, 1.05, 1], opacity: active ? [0.9, 1, 0.9] : [0.7, 0.9, 0.7] }}
        transition={{ duration: active ? 1.6 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* ripples */}
      {active &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className={`absolute inset-0 rounded-full border-2 ${night ? 'border-rose/40' : 'border-white/90'}`}
            initial={{ scale: 1, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}
      {/* iridescent ring */}
      <span
        className="spin-slow absolute inset-0 rounded-full blur-[6px]"
        style={{
          background: night
            ? 'conic-gradient(from 0deg, #5a2440, #8a3358, #3c2a55, #5a2440)'
            : 'conic-gradient(from 0deg, #FEA38E, #FBA2AB, #E6D6F5, #B4BEF0, #FFDFC3, #FEA38E)',
          opacity: night ? 0.7 : 1,
        }}
      />
      {/* core */}
      <span
        className="absolute rounded-full"
        style={{
          inset: size * 0.06,
          background: night
            ? 'radial-gradient(circle at 35% 30%, #4a2a3a 0%, #2a1722 70%)'
            : 'radial-gradient(circle at 35% 28%, #FFFFFF 0%, #FFF3F1 38%, #FCD6DC 72%, #F7B7C6 100%)',
          boxShadow: night ? 'inset 0 -6px 20px rgba(0,0,0,0.4)' : 'inset 0 -10px 24px rgba(214,51,108,0.18), inset 0 6px 14px rgba(255,255,255,0.9)',
        }}
      />
      <span className={`relative z-10 flex max-w-[78%] flex-col items-center text-center leading-tight ${night ? 'text-[#E9D3DD]' : 'text-ink'}`}>
        {label && <span className="text-[15px] font-semibold">{label}</span>}
        {sub && <span className={`mt-0.5 text-[12px] ${night ? 'text-[#BFA3B1]' : 'text-ink-soft'}`}>{sub}</span>}
      </span>
    </button>
  )
}

export function Stagger({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
