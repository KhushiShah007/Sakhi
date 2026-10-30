import { useI18n } from '../i18n'
import { useGo } from './nav'
import { useVoiceStatus } from '../voice/speech'

/** Shown only when this device cannot speak the line: the words stay on screen, and she is told why (never silence without a reason). */
export default function VoiceNote({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const go = useGo()
  const v = useVoiceStatus()
  if (v.available !== false) return null
  return (
    <p role="status" data-testid="voice-note" className={`rounded-2xl bg-[#FFF3C4] px-4 py-3 text-[15px] leading-snug text-[#54656F] ${className}`}>
      {t('vn_none')} <button onClick={() => go('/me')} className="font-semibold underline">{t('vn_settings')}</button>
    </p>
  )
}
