import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'

/** Browser-native speech. No keys, no audio leaves the device in our code path. Typed input is always the fallback. */
export const SPEECH_LANG: Record<Lang, string> = { hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', en: 'en-IN' }

interface RecEvent { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string; confidence: number } } } }
interface Rec { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: RecEvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; start(): void; stop(): void; abort(): void }
type RecCtor = new () => Rec
const recCtor = (): RecCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export const sttSupported = () => typeof window !== 'undefined' && !!recCtor()
export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

/** Calm, neutral synthetic voice. Never a clone: only voices the device already ships. */
export function speak(text: string, lang: Lang, onEnd?: () => void) {
  if (!ttsSupported()) { onEnd?.(); return }
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = SPEECH_LANG[lang]
  u.rate = 0.88
  u.pitch = 1
  const voices = synth.getVoices()
  const v = voices.find((x) => x.lang === u.lang) ?? voices.find((x) => x.lang.startsWith(lang))
  if (v) u.voice = v
  u.onend = () => onEnd?.()
  u.onerror = () => onEnd?.()
  synth.speak(u)
}
export const stopSpeaking = () => { if (ttsSupported()) window.speechSynthesis.cancel() }

export interface Listener {
  supported: boolean
  listening: boolean
  /** words so far: final + interim, so the transcript appears word by word */
  text: string
  confidence: number | null
  error: string | null
  start: () => void
  /** Stops and returns the final text. */
  stop: () => string
  reset: () => void
  setText: (t: string) => void
}

export function useListen(lang: Lang): Listener {
  const [listening, setListening] = useState(false)
  const [text, setTextState] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Rec | null>(null)
  const finalRef = useRef('')
  const textRef = useRef('')
  const setText = useCallback((t: string) => { textRef.current = t; finalRef.current = t; setTextState(t) }, [])

  const start = useCallback(() => {
    const C = recCtor()
    if (!C) { setError('unsupported'); return }
    setError(null)
    const r = new C()
    r.lang = SPEECH_LANG[lang]
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) { finalRef.current = `${finalRef.current} ${res[0].transcript}`.trim(); setConfidence(res[0].confidence || null) }
        else interim += res[0].transcript
      }
      textRef.current = `${finalRef.current} ${interim}`.trim()
      setTextState(textRef.current)
    }
    r.onerror = (e) => { setError(e.error); setListening(false) }
    r.onend = () => setListening(false)
    rec.current = r
    try { r.start(); setListening(true) } catch { setError('start_failed') }
  }, [lang])

  const stop = useCallback(() => {
    rec.current?.stop()
    setListening(false)
    return textRef.current
  }, [])
  const reset = useCallback(() => { finalRef.current = ''; textRef.current = ''; setTextState(''); setConfidence(null); setError(null) }, [])

  useEffect(() => () => { rec.current?.abort(); stopSpeaking() }, [])
  return { supported: sttSupported(), listening, text, confidence, error, start, stop, reset, setText }
}
