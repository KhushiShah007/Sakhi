import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { Lang } from '../i18n'
import { apiBase, getCsrf } from '../api/client'
import { CALM, pickVoice, splitSentences } from './tts'
import { PACE_RATE, getVoicePrefs } from './prefs'

/** Browser-native speech. No keys, no audio leaves the device in our code path. Typed input is always the fallback. */
export const SPEECH_LANG: Record<Lang, string> = { hi: 'hi-IN', mr: 'mr-IN', gu: 'gu-IN', en: 'en-IN' }

interface RecEvent { resultIndex: number; results: { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string; confidence: number } } } }
interface Rec { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: RecEvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null; onaudiostart?: (() => void) | null; onspeechstart?: (() => void) | null; onspeechend?: (() => void) | null; start(): void; stop(): void; abort(): void }
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

// ---- voice status: screens show "voice not available, showing text" instead of failing silently
export interface VoiceStatus { available: boolean | null; voiceName: string; reason: string }
let status: VoiceStatus = { available: null, voiceName: '', reason: '' }
const listeners = new Set<() => void>()
const setStatus = (s: VoiceStatus) => { if (s.available === status.available && s.voiceName === status.voiceName && s.reason === status.reason) return; status = s; listeners.forEach((l) => l()) }
export const getVoiceStatus = () => status
/** For tests. */
export const resetVoiceStatus = () => setStatus({ available: null, voiceName: '', reason: '' })
export function useVoiceStatus(): VoiceStatus {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => status, () => status)
}

export interface SpeakOpts { /** Called when the device cannot speak this line (no voice, blocked, engine error). The line is then shown as text. */ onError?: (reason: string) => void }

/** How long a line takes to read silently, used to pace text-only playback so a track never skips through in a blink. */
export const readingMs = (text: string) => Math.min(Math.max(text.length * 60, 1800), 7000)
/** If the engine never reports the end of a line, move on after this long. */
export const watchdogMs = (text: string) => text.length * 120 + 3000

const keepAlive = new Set<SpeechSynthesisUtterance>() // browsers can garbage-collect a speaking utterance and never fire onend

/** getVoices() is often empty on the first call; wait for voiceschanged, but never longer than about a second. */
export function voicesReady(timeoutMs = 1000): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported()) return Promise.resolve([])
  const synth = window.speechSynthesis
  const have = synth.getVoices()
  if (have.length) return Promise.resolve(have)
  return new Promise((resolve) => {
    let done = false
    const finish = () => { if (done) return; done = true; synth.removeEventListener?.('voiceschanged', finish); resolve(synth.getVoices()) }
    synth.addEventListener?.('voiceschanged', finish)
    window.setTimeout(finish, timeoutMs)
  })
}

/**
 * The best voice we can honestly use. A Marathi line may use a Hindi voice (same script); Gujarati has no such stand-in,
 * and an English voice reading Devanagari or Gujarati is gibberish, so then there is no voice and the line is shown as text.
 */
export function chooseVoice(voices: SpeechSynthesisVoice[], lang: Lang, preferred: string): SpeechSynthesisVoice | undefined {
  const want = SPEECH_LANG[lang]
  const own = voices.find((v) => v.name === preferred && v.lang.toLowerCase().startsWith(want.slice(0, 2).toLowerCase())) ?? pickVoice(voices, want)
  if (own) return own
  return lang === 'mr' ? pickVoice(voices, SPEECH_LANG.hi) : undefined
}

/** Text-only playback: the line is on screen, and the track moves on at reading pace. */
function readInstead(text: string, my: number, reason: string, opts: SpeakOpts | undefined, onEnd?: () => void) {
  setStatus({ available: false, voiceName: '', reason })
  opts?.onError?.(reason)
  window.setTimeout(() => { if (my === token) onEnd?.() }, readingMs(text))
}

/** Browser voice, tuned to be calm: slower, the most natural voice the device has, with a pause between sentences. */
async function speakBrowser(text: string, lang: Lang, my: number, onEnd?: () => void, opts?: SpeakOpts) {
  if (!ttsSupported()) { readInstead(text, my, 'unsupported', opts, onEnd); return }
  const synth = window.speechSynthesis
  const prefs = getVoicePrefs()
  const voices = await voicesReady()
  if (my !== token) return
  const voice = chooseVoice(voices, lang, prefs.voice)
  if (!voice) { readInstead(text, my, voices.length ? 'no_voice_for_language' : 'no_voices', opts, onEnd); return }
  setStatus({ available: true, voiceName: voice.name, reason: '' })
  const parts = splitSentences(text)
  const next = (i: number) => {
    if (my !== token) return
    if (i >= parts.length) { onEnd?.(); return }
    const u = new SpeechSynthesisUtterance(parts[i])
    u.lang = voice.lang || SPEECH_LANG[lang]; u.rate = PACE_RATE[prefs.pace]; u.pitch = CALM.pitch; u.volume = CALM.volume
    try { u.voice = voice } catch { /* an odd voice object must never stop the app speaking */ }
    let settled = false
    let dog = 0
    const settle = () => { if (settled) return false; settled = true; window.clearTimeout(dog); keepAlive.delete(u); return true }
    u.onend = () => { if (settle() && my === token) window.setTimeout(() => next(i + 1), i + 1 < parts.length ? CALM.pauseMs : 0) }
    u.onerror = (e) => {
      if (!settle() || my !== token) return
      const reason = (e as { error?: string }).error || 'speech_error'
      if (reason === 'canceled' || reason === 'interrupted') return // we cancelled it ourselves
      // a real engine error (blocked, no language data, busy): do NOT race through the remaining lines
      readInstead(parts.slice(i).join(' '), my, reason, opts, onEnd)
    }
    dog = window.setTimeout(() => { if (!settle() || my !== token) return; try { synth.cancel() } catch { /* ignore */ } next(i + 1) }, watchdogMs(parts[i]))
    keepAlive.add(u)
    synth.speak(u)
  }
  next(0)
}

let unlocked = false
/** Mobile browsers only allow speech after a tap; one silent utterance on the first tap unlocks it for the rest of the session. */
function installUnlock() {
  if (unlocked || typeof document === 'undefined' || !ttsSupported()) return
  const once = () => {
    unlocked = true
    document.removeEventListener('pointerdown', once, true)
    try { window.speechSynthesis.speak(new SpeechSynthesisUtterance('')) } catch { /* ignore */ }
  }
  document.addEventListener('pointerdown', once, true)
}
installUnlock()

async function speakServer(text: string, lang: Lang, my: number, onEnd?: () => void, opts?: SpeakOpts) {
  let fellBack = false // the error handler and the catch can both fire: speak the fallback once
  const fallback = () => { if (fellBack || my !== token) return; fellBack = true; void speakBrowser(text, lang, my, onEnd, opts) }
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
export function speak(text: string, lang: Lang, onEnd?: () => void, opts?: SpeakOpts) {
  stopAll()
  const my = token
  if (!getVoicePrefs().on) { onEnd?.(); return }
  if (serverTts) void speakServer(text, lang, my, onEnd, opts)
  else void speakBrowser(text, lang, my, onEnd, opts)
}
export const stopSpeaking = () => stopAll()

export interface Listener {
  supported: boolean
  listening: boolean
  /** words so far: final + interim, so the transcript appears word by word */
  text: string
  confidence: number | null
  error: string | null
  /** The language actually being heard (it can fall back from the one asked for). */
  usedLang: string
  /** True while the recogniser reports speech (drives the activity indicator where a real level meter is not safe). */
  hearing: boolean
  /** Set when listening but nothing useful is coming through: no microphone audio at all, or sound but no words (speech service blocked or offline). */
  hint: 'no_audio' | 'no_words' | null
  start: () => void
  /** Stops and returns the text so far. */
  stop: () => string
  /** Stops, waits (briefly) for the recogniser's last final result, then returns the text. */
  finish: () => Promise<string>
  reset: () => void
  setText: (t: string) => void
}

/** Requested language first, then Hindi, then Indian English: some devices cannot hear Marathi or Gujarati. */
export const listenChain = (lang: Lang): string[] => [...new Set([SPEECH_LANG[lang], SPEECH_LANG.hi, SPEECH_LANG.en])]

export function useListen(lang: Lang): Listener {
  const [listening, setListening] = useState(false)
  const [text, setTextState] = useState('')
  const [confidence, setConfidence] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [usedLang, setUsedLang] = useState(SPEECH_LANG[lang])
  const [hearing, setHearing] = useState(false)
  const [hint, setHint] = useState<'no_audio' | 'no_words' | null>(null)
  const gotAudio = useRef(false)
  const timers = useRef<number[]>([])
  const clearTimers = () => { timers.current.forEach((t) => window.clearTimeout(t)); timers.current = [] }
  const rec = useRef<Rec | null>(null)
  const want = useRef(false)
  const idx = useRef(0)
  const restarts = useRef<number[]>([])
  const waiters = useRef<(() => void)[]>([])
  const finalRef = useRef('')
  const textRef = useRef('')
  const setText = useCallback((t: string) => { textRef.current = t; finalRef.current = t; setTextState(t) }, [])

  const begin = useCallback(() => {
    const C = recCtor()
    if (!C) { setError('unsupported'); return }
    const chain = listenChain(lang)
    const r = new C()
    r.lang = chain[idx.current]
    r.continuous = true
    r.interimResults = true
    r.onaudiostart = () => { gotAudio.current = true; setHint((h) => (h === 'no_audio' ? null : h)) }
    r.onspeechstart = () => setHearing(true)
    r.onspeechend = () => setHearing(false)
    r.onresult = (e) => {
      clearTimers(); setHint(null)
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) { finalRef.current = `${finalRef.current} ${res[0].transcript}`.trim(); setConfidence(res[0].confidence || null) }
        else interim += res[0].transcript
      }
      textRef.current = `${finalRef.current} ${interim}`.trim()
      setTextState(textRef.current)
    }
    r.onerror = (e) => {
      // this language is not available on this device: quietly try the next one
      if (e.error === 'language-not-supported' && idx.current + 1 < chain.length) {
        idx.current++; setUsedLang(chain[idx.current]); rec.current = null
        try { begin(); return } catch { /* fall through to the error */ }
      }
      want.current = false; setError(e.error); setListening(false)
    }
    // browsers end a session after a pause in speech; keep going while she still wants to talk, but never in a tight loop
    r.onend = () => {
      if (rec.current !== r) return
      setHearing(false)
      if (want.current) {
        const now = Date.now()
        restarts.current = restarts.current.filter((t) => now - t < 3000).concat(now)
        if (restarts.current.length > 4) { want.current = false; setError('restart_loop') }
        else { try { r.start(); return } catch { want.current = false } }
      }
      setListening(false)
      const w = waiters.current; waiters.current = []; w.forEach((f) => f())
    }
    rec.current = r
    try { r.start(); setListening(true) } catch { want.current = false; setError('start_failed') }
  }, [lang])

  /** Must be called straight from a tap (no await before it), or mobile Chrome refuses to start the microphone. */
  const start = useCallback(() => {
    stopAll()                        // never let Sakhi's own voice hold the audio while she is about to speak
    if (typeof window !== 'undefined' && window.isSecureContext === false) { setError('insecure'); return }
    setError(null)
    idx.current = 0; restarts.current = []; setUsedLang(SPEECH_LANG[lang]); setHint(null); gotAudio.current = false
    // if the browser never opens the microphone, or hears sound but returns no words, say so instead of sitting silent
    clearTimers()
    timers.current = [
      window.setTimeout(() => { if (want.current && !gotAudio.current) setHint('no_audio') }, 4000),
      window.setTimeout(() => { if (want.current && gotAudio.current) setHint('no_words') }, 10000),
    ]
    want.current = true
    begin()
  }, [begin, lang])

  const stop = useCallback(() => {
    want.current = false; clearTimers(); setHearing(false)
    rec.current?.stop()
    setListening(false)
    return textRef.current
  }, [])
  const finish = useCallback((): Promise<string> => {
    want.current = false; clearTimers(); setHearing(false)
    const r = rec.current
    if (!r) { setListening(false); return Promise.resolve(textRef.current) }
    return new Promise((resolve) => {
      let done = false
      const fin = () => { if (done) return; done = true; setListening(false); resolve(textRef.current) }
      waiters.current.push(fin)
      window.setTimeout(fin, 600) // some engines never send onend after stop()
      try { r.stop() } catch { fin() }
    })
  }, [])
  const reset = useCallback(() => { finalRef.current = ''; textRef.current = ''; setTextState(''); setConfidence(null); setError(null) }, [])

  useEffect(() => () => { want.current = false; clearTimers(); rec.current?.abort(); stopSpeaking() }, [])
  return { supported: sttSupported(), listening, text, confidence, error, usedLang, hearing, hint, start, stop, finish, reset, setText }
}
