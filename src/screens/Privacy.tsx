import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CloudSun, EyeOff, GraduationCap, HeartHandshake, Lock, NotebookPen, Pause, Play, Plus, Radio, ShieldCheck, Trash2 } from 'lucide-react'
import { pick, useI18n } from '../i18n'
import { BottomNav } from '../components/Frame'
import { Screen, Switch, useToast } from '../components/ui'
import { family as initialFamily } from '../mock/user'
import { HeroSwirls } from '../illustrations/art'
import { useLive } from '../api/session'
import { useEmbedded } from '../components/nav'
import PrivacyLive from './PrivacyLive'

/** Live when logged in; demo/screenshots/static hosting keep the scripted version. */
export default function Privacy() {
  const live = useLive()
  const embedded = useEmbedded()
  return live && !embedded ? <PrivacyLive /> : <PrivacyMock />
}

function PrivacyMock() {
  const { t, lang } = useI18n()
  const toast = useToast()
  const [people, setPeople] = useState(initialFamily)
  const [discreet, setDiscreet] = useState(true)
  const update = (id: string, patch: Partial<(typeof people)[number]>) => setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  const regular = people.filter((p) => !p.trusted)
  const trusted = people.find((p) => p.trusted)

  return (
    <Screen nav={<BottomNav active="family" />}>
      <div className="px-5 pb-36">
        <div className="flex items-center justify-between pb-4 pt-2">
          <h1 className="text-[27px] font-bold tracking-tight">{t('fp_title')}</h1>
          <span className="icon-btn"><ShieldCheck size={22} className="text-rose-pressed" /></span>
        </div>

        <div className="waves relative overflow-hidden rounded-[30px] p-5 text-white shadow-soft">
          <HeroSwirls className="absolute inset-0 h-full w-full" />
          <div className="relative">
            <Lock size={22} />
            <div className="mt-2 text-[24px] font-bold leading-tight">{t('fp_hero_a')}</div>
            <div className="mt-1 text-[16px] text-white">{t('fp_hero_b')}</div>
            <div className="mt-4 flex items-center gap-2">
              <span className="rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-medium"><Lock size={13} className="mr-1 inline" />{t('tr_yours').split('·')[0]}</span>
              <ArrowRight size={16} />
              <span className="rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-rose-pressed"><Radio size={13} className="mr-1 inline" />{t('perm_signals')}</span>
            </div>
          </div>
        </div>

        <h2 className="h-section mb-3 mt-6">{t('fp_people')}</h2>
        <div className="flex flex-col gap-3">
          {regular.map((p) => (
            <motion.div layout key={p.id} className={`glass rounded-[24px] p-4 ${p.paused ? 'opacity-80' : ''}`}>
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[18px] font-bold" style={{ background: p.tint }}>{p.initial}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[17px] font-semibold leading-tight">{t(p.nameKey)}</div>
                  <div className="text-[14px] text-ink-soft">{t(p.relKey)}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${p.paused ? 'bg-[#EFE6EA] text-ink-soft' : 'bg-[#E3F3EA] text-[#24563F]'}`}>{p.paused ? t('paused') : `● ${t('live')}`}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {([['signals', Radio, 'perm_signals'], ['weather', CloudSun, 'perm_weather'], ['learning', GraduationCap, 'perm_learning']] as const).map(([k, Icon, label]) => {
                  const on = p[k] && !p.paused
                  return (
                    <button key={k} onClick={() => update(p.id, { [k]: !p[k] })} aria-pressed={on} className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-[14px] font-medium transition ${on ? 'bg-rose text-white' : 'bg-white/70 text-ink-soft'}`}>
                      <Icon size={15} /> {t(label)}
                    </button>
                  )
                })}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/80 pt-2">
                <span className="truncate text-[13px] text-ink-soft">{t('fp_last')}: {pick(p.last, lang)}</span>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => update(p.id, { paused: !p.paused })} className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-2.5 text-[14px] font-semibold text-rose-pressed">
                    {p.paused ? <Play size={15} /> : <Pause size={15} />} {p.paused ? t('resume') : t('pause')}
                  </button>
                  <button onClick={() => toast.show()} aria-label={t('revoke')} className="grid h-10 w-10 place-items-center rounded-full text-ink-soft"><Trash2 size={17} /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {trusted && (
          <div className="glass mt-3 flex items-center gap-3 rounded-[24px] p-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={{ background: trusted.tint }}><HeartHandshake size={22} className="text-[#24563F]" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-rose-pressed">{t('trusted')}</div>
              <div className="text-[17px] font-semibold leading-tight">{t(trusted.nameKey)}</div>
              <div className="text-[13px] text-ink-soft">{t(trusted.relKey)}</div>
            </div>
            <Switch on label={t('trusted')} onChange={() => toast.show()} />
          </div>
        )}

        <button onClick={() => toast.show()} className="btn-ghost mt-3 w-full"><Plus size={18} /> {t('add_person')}</button>

        <div className="glass mt-6 rounded-[24px] p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-ink text-white"><EyeOff size={20} /></span>
            <div className="min-w-0 flex-1">
              <div className="text-[17px] font-semibold leading-tight">{t('discreet')}</div>
              <div className="text-[14px] leading-snug text-ink-soft">{t('discreet_s')}</div>
            </div>
            <Switch on={discreet} onChange={setDiscreet} label={t('discreet')} />
          </div>
          <AnimatePresence>
            {discreet && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="mt-4 text-[13px] font-semibold text-ink-soft">{t('discreet_prev')}</div>
                <div className="mt-2 grid grid-cols-[1fr_auto] gap-3">
                  <div className="grid grid-cols-4 gap-2 rounded-2xl p-3" style={{ background: 'linear-gradient(160deg,#5B6378,#3D4458)' }}>
                    {['#7BA7E0', '#F2C14E', '#8BD3A8', 'APP', '#E58F65', '#B79CE8', '#6CC3D5', '#F08BA8'].map((c, i) =>
                      c === 'APP' ? (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#F4F1EA] ring-2 ring-white"><NotebookPen size={20} className="text-[#5B6378]" /></span>
                          <span className="max-w-[56px] truncate text-[9.5px] text-white">{t('neutral_name')}</span>
                        </div>
                      ) : (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="h-10 w-10 rounded-xl" style={{ background: c, opacity: 0.85 }} />
                          <span className="h-1.5 w-8 rounded bg-white/40" />
                        </div>
                      ),
                    )}
                  </div>
                  <div className="flex w-[92px] flex-col items-center justify-center rounded-2xl bg-white/80 p-2">
                    <Lock size={18} className="text-ink" />
                    <div className="mt-2 flex gap-1.5">
                      {[1, 1, 0, 0].map((f, i) => (
                        <span key={i} className={`h-2.5 w-2.5 rounded-full ${f ? 'bg-ink' : 'border-2 border-ink/40'}`} />
                      ))}
                    </div>
                    <span className="mt-2 text-[12px] font-semibold text-ink-soft">PIN</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Screen>
  )
}
