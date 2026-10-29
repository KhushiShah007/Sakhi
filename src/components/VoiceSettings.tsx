import { useEffect, useState } from 'react'
import { Volume2 } from 'lucide-react'
import { useI18n } from '../i18n'
import type { StrKey } from '../i18n/strings'
import { Switch } from './ui'
import { getVoicePrefs, setVoicePrefs, type Pace } from '../voice/prefs'
import { speak, ttsSupported } from '../voice/speech'
import { SPEECH_LANG } from '../voice/speech'

const PACES: { id: Pace; t: StrKey }[] = [{ id: 'slower', t: 'vs_slower' }, { id: 'calm', t: 'vs_calm' }, { id: 'normal', t: 'vs_normal' }]

/** Spoken guidance choices: on/off, pace, which voice, and a preview. Stored on this device only. */
export default function VoiceSettings() {
  const { t, lang } = useI18n()
  const [p, setP] = useState(getVoicePrefs())
  const [voices, setVoices] = useState<string[]>([])
  useEffect(() => {
    if (!ttsSupported()) return
    const load = () => setVoices(window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(SPEECH_LANG[lang].slice(0, 2).toLowerCase())).map((v) => v.name))
    load(); window.speechSynthesis.addEventListener?.('voiceschanged', load)
    return () => window.speechSynthesis.removeEventListener?.('voiceschanged', load)
  }, [lang])
  const change = (n: Partial<typeof p>) => { setVoicePrefs(n); setP(getVoicePrefs()) }

  return (
    <div className="glass flex flex-col gap-3 rounded-[24px] p-4" data-testid="voice-settings">
      <div className="flex items-center justify-between gap-3">
        <span><span className="block text-[16px] font-semibold">{t('vs_on')}</span><span className="block text-[13.5px] text-ink-soft">{t('vs_on_s')}</span></span>
        <Switch on={p.on} onChange={(v) => change({ on: v })} label={t('vs_on')} />
      </div>
      {p.on && <>
        <div className="flex gap-2" role="group" aria-label={t('vs_pace')}>
          {PACES.map((x) => <button key={x.id} aria-pressed={p.pace === x.id} onClick={() => change({ pace: x.id })} className={`min-h-[44px] flex-1 rounded-full text-[14.5px] font-semibold ${p.pace === x.id ? 'bg-rose text-white' : 'bg-white/70 text-ink'}`}>{t(x.t)}</button>)}
        </div>
        {voices.length > 1 && (
          <label className="block"><span className="mb-1 block text-[14px] font-semibold">{t('vs_voice')}</span>
            <select value={p.voice} onChange={(e) => change({ voice: e.target.value })} className="h-12 w-full rounded-2xl border border-[#E7CBD3] bg-white/90 px-3 text-[16px]">
              <option value="">{t('vs_auto')}</option>
              {voices.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        )}
        <button onClick={() => speak(t('vs_sample'), lang)} className="btn-ghost"><Volume2 size={18} /> {t('vs_preview')}</button>
      </>}
    </div>
  )
}
