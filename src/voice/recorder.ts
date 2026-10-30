import { useCallback, useEffect, useRef, useState } from 'react'

export const recorderSupported = () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined'

const pickMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => MediaRecorder.isTypeSupported?.(m)) ?? ''

/**
 * Records the microphone to a Blob, with a live input level for the meter. One stream feeds both the recorder and the meter,
 * so there is no second reader competing for the microphone. The audio stays in memory and is never uploaded by this hook.
 */
export function useRecorder() {
  const [recording, setRecording] = useState(false)
  const [level, setLevel] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const mr = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const cleanup = useRef<() => void>(() => {})

  const teardown = () => { cleanup.current(); cleanup.current = () => {}; setLevel(0) }

  const start = useCallback(async (): Promise<boolean> => {
    setError(null)
    if (!recorderSupported()) { setError('unsupported'); return false }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      const mime = pickMime()
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      chunks.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data) }
      mr.current = rec
      rec.start(250)
      setRecording(true)
      // loudness for the meter
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC(); const an = ctx.createAnalyser(); an.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.fftSize); let raf = 0; let smooth = 0
      const tick = () => { an.getByteTimeDomainData(buf); let s = 0; for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; s += v * v } smooth = smooth * 0.7 + Math.min(1, Math.sqrt(s / buf.length) * 5) * 0.3; setLevel(smooth); raf = requestAnimationFrame(tick) }
      tick()
      cleanup.current = () => { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); void ctx.close().catch(() => {}) }
      return true
    } catch (e) {
      setError((e as DOMException)?.name === 'NotAllowedError' ? 'not-allowed' : 'audio-capture')
      return false
    }
  }, [])

  /** Stops and resolves with everything recorded (null if nothing was recorded). */
  const stop = useCallback((): Promise<Blob | null> => new Promise((resolve) => {
    const rec = mr.current
    if (!rec || rec.state === 'inactive') { setRecording(false); teardown(); resolve(null); return }
    rec.onstop = () => {
      const type = rec.mimeType || chunks.current[0]?.type || 'audio/webm'
      const blob = chunks.current.length ? new Blob(chunks.current, { type }) : null
      chunks.current = []; mr.current = null; setRecording(false); teardown(); resolve(blob)
    }
    try { rec.requestData(); rec.stop() } catch { setRecording(false); teardown(); resolve(null) }
  }), [])

  useEffect(() => () => { try { mr.current?.stop() } catch { /* ignore */ } teardown() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { recording, level, error, start, stop }
}
