import { useMemo } from 'react'
import { AudioLines, FileHeart, Languages, Radio } from 'lucide-react'
import { Device } from '../components/Frame'
import { EmbeddedContext } from '../components/nav'
import { MoodBlob } from '../illustrations/Blob'
import CheckIn from '../screens/CheckIn'
import Vent from '../screens/Vent'
import Brief from '../screens/Brief'

/** 1920×1080 pitch-deck hero: three phones on a peach-to-lavender wash. */
export default function Hero() {
  const embedded = useMemo(() => ({ onGo: () => {} }), [])
  return (
    <EmbeddedContext.Provider value={embedded}>
      <div className="relative h-[1080px] w-[1920px] overflow-hidden" style={{ background: 'linear-gradient(125deg, #FFDFC3 0%, #FDCFC8 30%, #FBC2CD 55%, #E6D6F5 100%)' }}>
        <div className="absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full bg-white/40 blur-3xl" />
        <div className="absolute bottom-[-200px] right-[-100px] h-[700px] w-[700px] rounded-full bg-[#E6D6F5] opacity-70 blur-3xl" />
        <div className="absolute left-[430px] top-[140px] opacity-90"><MoodBlob mood="okay" size={70} /></div>
        <div className="absolute left-[90px] top-[820px] opacity-90"><MoodBlob mood="calm" size={84} /></div>
        <div className="absolute left-[560px] top-[860px] opacity-80"><MoodBlob mood="tired" size={56} /></div>

        <div className="absolute left-[110px] top-[230px] w-[600px]">
          <div className="flex items-center gap-4">
            <img src="./favicon.svg" alt="" className="h-20 w-20" />
            <span className="text-[96px] font-bold leading-none tracking-tight text-ink">Sakhi</span>
          </div>
          <p className="mt-8 text-[38px] font-semibold leading-[1.2] text-ink">A voice-first menopause companion for Indian women — and the people who love them.</p>
          <div className="mt-10 flex flex-wrap gap-3">
            {[
              [AudioLines, 'Speak, don’t type'],
              [Languages, 'हिंदी · मराठी · ગુજરાતી · English'],
              [Radio, 'Signals, not stories'],
              [FileHeart, 'Doctor-Ready Brief'],
            ].map(([I, l]) => {
              const Icon = I as typeof Radio
              return (
                <span key={l as string} className="inline-flex items-center gap-2 rounded-full bg-white/75 px-5 py-3 text-[20px] font-medium text-ink shadow-card">
                  <Icon size={22} className="text-rose-pressed" /> {l as string}
                </span>
              )
            })}
          </div>
          <div className="mt-12 text-[18px] text-ink-soft">Team Slaughter · HABIT Innovate Bootcamp · UI prototype, simulated data</div>
        </div>

        <div className="absolute left-[790px] top-[190px] -rotate-[4deg]">
          <Device scale={0.8}><CheckIn initialMood="hot" /></Device>
        </div>
        <div className="absolute left-[1530px] top-[190px] rotate-[4deg]">
          <Device scale={0.8}><Brief /></Device>
        </div>
        <div className="absolute left-[1150px] top-[110px] z-10">
          <Device scale={0.88}><Vent stage="heard" /></Device>
        </div>
      </div>
    </EmbeddedContext.Provider>
  )
}
