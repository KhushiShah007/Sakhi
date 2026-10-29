import { useCallback, useEffect, useRef, useState } from 'react'
import type { Lang } from '../i18n'
import { apiBase, getCsrf } from '../api/client'
import { CALM, pickVoice, splitSentences } from './tts'
import { PACE_RATE, getVoicePrefs } from './prefs'

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

let serverTts = false
/** Set from /healthz: true when the server has a natural-voice provider configured (ELEVENLABS_API_KEY). */
export const setServerTts = (on: boolean) => { serverTts = on }

let token = 0            // bumping this cancels whatever is currently being said
let audio: HTMLAudioElement | null = null
const audioCache = new Map<string, string>() // phrase -> object URL, so a repeated breath cue costs nothing

function stopAll() {
  token++
  if (audio) { audio.pause(); audio.src = ''; audio = null }
  if (ttsSupported()) window.speechSynthesis.cancel()
}

/** Browser voice, tuned to be calm: slower, lower, the most natural voice the device has, with a pause between sentences. */
function speakBrowser(text: string, lang: Lang, my: number, onEnd?: () => void) {
  if (!ttsSupported()) { onEnd?.(); return }
  const synth = window.speechSynthesis
  const prefs = getVoicePrefs()
  const voices = synth.getVoices()
  const voice = voices.find((v) => v.name === prefs.voice && v.lang.toLowerCase().startsWith(SPEECH_LANG[lang].slice(0, 2).toLowerCase())) ?? pickVoice(voices, SPEECH_LANG[lang])
  const parts = splitSentences(text)
  const next = (i: number) => {
    if (my !== token) return
    if (i >= parts.length) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(parts[i])
    u.lang = SPEECH_LANG[lang]; u.rate = PACE_RATE[prefs.pace]; u.pitch = CALM.pitch; u.volume = CALM.volume
    if (voice) { try { u.voice = voice } catch { /* an odd voice object must never stop the app speaking */ } }
    const done = () => { if (my === token) window.setTimeout(() => next(i + 1), i + 1 < parts.length ? CALM.pauseMs : 0) }
    u.onend = done; u.onerror = done
    synth.speak(u)
  }
  next(0)
}

async function speakServer(text: string, lang: Lang, my: number, onEnd?: () => void) {
  let fellBack = false // the error handler and the catch can both fire: speak the fallback once
  const fallback = () => { if (fellBack || my !== token) return; fellBack = true; speakBrowser(text, lang, my, onEnd) }
  try {
    const key = `${lang}|${text}`
    let url = audioCache.get(key)
    if (!url) {
      const res = await fetch(`${apiBase()}/api/tts`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-csrf-token': getCsrf() }, body: JSON.stringify({ text, lang }) })
      if (!res.ok) throw new Error('tts')
      url = URL.createObjectURL(await res.blob())
      if (audioCache.size > 60) audioCache.delete(audioCache.keys().next().value as string)
      audioCache.set(key, url)
    }
    if (my !== token) return
    const a = new Audio(url)
    audio = a
    a.onended = () => { if (my === token) onEnd?.() }
    a.onerror = fallback
    await a.play()
  } catch {
    fallback() // no key, offline, blocked autoplay, provider error: the browser voice still works
  }
}

/** Calm, neutral synthetic voice. Never a clone of a real person. */
export function speak(text: string, lang: Lang, onEnd?: () => void) {
  stopAll()
  const my = token
  if (!getVoicePrefs().on) { onEnd?.(); return }
  if (serverTts) void speakServer(text, lang, my, onEnd)
  else speakBrowser(text, lang, my, onEnd)
}
export const stopSpeaking = () => stopAll()

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
  const want = useRef(false)
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
    r.onerror = (e) => { want.current = false; setError(e.error); setListening(false) }
    // browsers end a session after a pause in speech; keep going while she still wants to talk
    r.onend = () => {
      if (want.current && rec.current === r) { try { r.start(); return } catch { /* fall through */ } }
      setListening(false)
    }
    rec.current = r
    want.current = true
    try { r.start(); setListening(true) } catch { want.current = false; setError('start_failed') }
  }, [lang])

  const stop = useCallback(() => {
    want.current = false
    rec.current?.stop()
    setListening(false)
    return textRef.current
  }, [])
  const reset = useCallback(() => { finalRef.current = ''; textRef.current = ''; setTextState(''); setConfidence(null); setError(null) }, [])

  useEffect(() => () => { want.current = false; rec.current?.abort(); stopSpeaking() }, [])
  return { supported: sttSupported(), listening, text, confidence, error, start, stop, reset, setText }
}
