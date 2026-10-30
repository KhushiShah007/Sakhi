import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { recorderSupported, useRecorder } from './recorder'
import { stopSpeaking, useListen, type Listener } from './speech'
import { preloadStt, transcribe, type SttProgress } from './whisper'

const KEY = 'sakhi.stt.record'
const lsGet = () => { try { return localStorage.getItem(KEY) === '1' } catch { return false } }
const lsSet = () => { try { localStorage.setItem(KEY, '1') } catch { /* ignore */ } }

export interface VoiceInput extends Listener {
  /** 'browser' = the browser's own live recognition; 'record' = record, then write it out on this device. */
  mode: 'browser' | 'record'
  phase: 'idle' | 'recording' | 'transcribing'
  progress: SttProgress | null
  level: number
  /** True once the browser's speech service proved unreachable and recording took over. */
  switched: boolean
  sttError: boolean
}

/**
 * One voice input for the whole app. It uses the browser's live speech recognition when that works. When the browser's speech
 * service cannot be reached (the "network" error, Brave, a blocked service, no support at all) it switches, for good, to
 * recording her voice and writing it out on this device with Whisper. Either way the same text box fills and she confirms
 * everything before anything is saved.
 */
export function useVoiceInput(lang: Lang): VoiceInput {
  const l = useListen(lang)
  const rec = useRecorder()
  const [fb, setFb] = useState(lsGet)
  const [switched, setSwitched] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'recording' | 'transcribing'>('idle')
  const [progress, setProgress] = useState<SttProgress | null>(null)
  const [sttError, setSttError] = useState(false)
  const canRecord = recorderSupported()
  const mode: 'browser' | 'record' = canRecord && (!l.supported || fb) ? 'record' : 'browser'
  const textRef = useRef(l.text); textRef.current = l.text
  // recording mode: begin fetching the speech tool right away, so it is ready by the time she finishes speaking
  useEffect(() => { if (mode === 'record') preloadStt() }, [mode])

  const startRecord = useCallback(async () => {
    setSttError(false)
    stopSpeaking()
    if (await rec.start()) setPhase('recording')
  }, [rec])

  // the browser's speech service is unreachable or silent: take over by recording, right away, and remember it
  useEffect(() => {
    if (mode !== 'browser' || !canRecord) return
    if (l.error === 'network' || l.error === 'service-not-allowed' || l.hint === 'no_words') {
      lsSet(); setFb(true); setSwitched(true); l.stop()
      void startRecord()
    }
  }, [l.error, l.hint, mode, canRecord]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(() => { if (mode === 'record') void startRecord(); else l.start() }, [mode, startRecord, l])
  const stop = useCallback(() => { if (mode === 'record') { void rec.stop(); setPhase('idle'); return textRef.current } return l.stop() }, [mode, rec, l])
  const finish = useCallback(async (): Promise<string> => {
    if (mode !== 'record') return l.finish()
    if (phase !== 'recording') return textRef.current
    setPhase('transcribing'); setProgress(null)
    const blob = await rec.stop()
    if (!blob || blob.size < 1500) { setPhase('idle'); return textRef.current }
    try {
      const said = await transcribe(blob, lang, setProgress)
      const merged = `${textRef.current} ${said}`.trim()
      l.setText(merged)
      return merged
    } catch { setSttError(true); return textRef.current }
    finally { setPhase('idle'); setProgress(null) }
  }, [mode, phase, rec, lang, l])
  const reset = useCallback(() => { l.reset(); setSttError(false) }, [l])

  const record = mode === 'record'
  return {
    ...l, mode, phase, progress, switched, sttError, start, stop, finish, reset,
    supported: l.supported || canRecord,
    listening: record ? phase === 'recording' : l.listening,
    hearing: record ? rec.level > 0.08 : l.hearing,
    hint: record ? null : l.hint,
    error: record ? rec.error : l.error,
    level: record ? rec.level : 0,
  }
}
