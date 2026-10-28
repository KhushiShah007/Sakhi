import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookHeart, House, UsersRound, UserRound } from 'lucide-react'
import { motion } from 'framer-motion'
import { LANGS, useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { ToastProvider } from './ui'
import { useGo } from './nav'

export function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight })
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return vp
}

export const PHONE_W = 390
export const PHONE_H = 844

/** A device bezel around a 390×844 screen. */
export function Device({ children, scale = 1, className = '', label }: { children: ReactNode; scale?: number; className?: string; label?: ReactNode }) {
  const outerW = PHONE_W + 24
  const outerH = PHONE_H + 24
  return (
    <div className={className} style={{ width: outerW * scale, height: outerH * scale + (label ? 40 : 0) }}>
      <div style={{ width: outerW, height: outerH, transform: `scale(${scale})`, transformOrigin: 'top left' }} className="relative rounded-[60px] bg-[#2B1621] p-3 shadow-phone">
        <div className="pointer-events-none absolute left-1/2 top-[22px] z-[60] h-[30px] w-[118px] -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full w-full overflow-hidden rounded-[48px] bg-ivory">
          <ToastProvider>{children}</ToastProvider>
        </div>
      </div>
      {label && <div className="mt-3 text-center text-sm font-semibold text-ink-soft" style={{ width: outerW * scale }}>{label}</div>}
    </div>
  )
}

const LINKS: { group: string; items: { to: string; label: string }[] }[] = [
  {
    group: 'Her app',
    items: [
      { to: '/', label: 'Welcome' },
      { to: '/onboarding', label: 'Voice onboarding' },
      { to: '/home', label: 'Home' },
      { to: '/checkin', label: 'Daily check-in' },
      { to: '/vent', label: 'Vent Mode' },
      { to: '/translator', label: 'Say it for me' },
      { to: '/right-now', label: 'Right Now' },
      { to: '/3am', label: '3 AM mode' },
      { to: '/rehearsal', label: 'Rehearsal Room' },
      { to: '/letter', label: 'Letter to myself' },
      { to: '/brief', label: 'Doctor-Ready Brief' },
      { to: '/privacy', label: 'Family & Privacy' },
      { to: '/missed-call', label: 'Missed-call line' },
      { to: '/history', label: 'Letters & moments' },
      { to: '/me', label: 'Me' },
    ],
  },
  { group: 'Family (WhatsApp)', items: [{ to: '/family', label: "Rajesh's chat" }, { to: '/family/lesson', label: '2-min lesson' }] },
  { group: 'Employer & demo', items: [{ to: '/hr', label: 'HR dashboard' }, { to: '/demo', label: '3-minute demo' }] },
]

function SidePanel() {
  const { lang, setLang } = useI18n()
  const loc = useLocation()
  return (
    <aside className="no-scrollbar flex max-h-full w-[300px] shrink-0 flex-col overflow-y-auto pr-2">
      <div className="mb-1 flex items-center gap-3">
        <img src="./favicon.svg" alt="" className="h-11 w-11" />
        <div>
          <div className="text-2xl font-bold tracking-tight text-ink">Sakhi</div>
          <div className="text-[13px] text-ink-soft">Voice-first menopause companion</div>
        </div>
      </div>
      <p className="mb-4 mt-2 text-[14px] leading-relaxed text-ink-soft">
        Clickable UI prototype by Team Slaughter · HABIT Innovate Bootcamp. Everything is scripted; all data is simulated.
      </p>
      <div className="mb-5 grid grid-cols-4 gap-1 rounded-2xl bg-white/60 p-1">
        {LANGS.map((l) => (
          <button key={l.id} onClick={() => setLang(l.id)} className={`min-h-[40px] rounded-xl text-[13px] font-semibold ${lang === l.id ? 'bg-rose text-white' : 'text-ink'}`}>
            {l.native}
          </button>
        ))}
      </div>
      {LINKS.map((g) => (
        <div key={g.group} className="mb-4">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-rose-pressed">{g.group}</div>
          <div className="flex flex-col">
            {g.items.map((it) => {
              const active = loc.pathname === it.to
              return (
                <Link key={it.to} to={it.to} className={`rounded-xl px-3 py-1.5 text-[14px] ${active ? 'bg-white/80 font-semibold text-ink shadow-card' : 'text-ink hover:bg-white/50'}`}>
                  {it.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </aside>
  )
}

/** Desktop: device + navigator. Phone: full-screen. */
export function PhoneFrame({ children }: { children: ReactNode }) {
  const { w, h } = useViewport()
  if (w < 640) {
    return (
      <div className="relative h-[100dvh] w-full overflow-hidden">
        <ToastProvider>{children}</ToastProvider>
      </div>
    )
  }
  const scale = Math.min(1, (h - 40) / (PHONE_H + 24))
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center gap-14 overflow-hidden p-5" style={{ background: 'radial-gradient(1200px 700px at 70% 20%, #FFE9DA 0%, rgba(255,233,218,0) 60%), linear-gradient(135deg, #FFE1CF 0%, #FAD0D6 45%, #EBDDF6 100%)' }}>
      {w >= 1000 && <SidePanel />}
      <Device scale={scale}>{children}</Device>
    </div>
  )
}

// ------------------------------------------------------------------ bottom nav
const TABS: { id: string; to: string; icon: typeof House; label: StrKey }[] = [
  { id: 'home', to: '/home', icon: House, label: 'nav_home' },
  { id: 'letters', to: '/history', icon: BookHeart, label: 'nav_letters' },
  { id: 'family', to: '/privacy', icon: UsersRound, label: 'nav_family' },
  { id: 'me', to: '/me', icon: UserRound, label: 'nav_me' },
]

export function BottomNav({ active }: { active: 'home' | 'letters' | 'family' | 'me' }) {
  const { t } = useI18n()
  const go = useGo()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-6 pt-10" style={{ background: 'linear-gradient(to top, rgba(243,232,251,0.85), rgba(243,232,251,0))' }}>
      <nav className="glass-strong pointer-events-auto flex h-[68px] items-center gap-1 rounded-full px-2">
        {TABS.map((tab) => {
          const on = tab.id === active
          const Icon = tab.icon
          return (
            <button key={tab.id} onClick={() => go(tab.to)} aria-label={t(tab.label)} aria-current={on ? 'page' : undefined} className={`relative flex h-[52px] items-center justify-center rounded-full ${on ? 'px-5' : 'w-[56px]'}`}>
              {on && <motion.span layoutId="navpill" className="absolute inset-0 rounded-full bg-rose shadow-soft" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
              <span className={`relative z-10 flex items-center gap-2 ${on ? 'text-white' : 'text-ink-soft'}`}>
                <Icon size={22} strokeWidth={on ? 2.4 : 2} />
                {on && <span className="text-[15px] font-semibold">{t(tab.label)}</span>}
              </span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
