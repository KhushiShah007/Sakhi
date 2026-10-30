import { useEffect, useState } from 'react'

/**
 * A live input level (0..1) from the real microphone, so she can SEE that Sakhi is listening.
 * It only measures loudness; the audio is never recorded or sent. If the mic cannot be opened, level stays 0 and the
 * speech recogniser reports the reason separately.
 */
export function useMicLevel(active: boolean): number {
  const [level, setLevel] = useState(0)
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setLevel(0); return }
    let stopped = false
    let raf = 0
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    void (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return }
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        ctx = new AC()
        const an = ctx.createAnalyser(); an.fftSize = 512
        ctx.createMediaStreamSource(stream).connect(an)
        const buf = new Uint8Array(an.fftSize)
        let smooth = 0
        const tick = () => {
          an.getByteTimeDomainData(buf)
          let sum = 0
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
          const rms = Math.sqrt(sum / buf.length)
          smooth = smooth * 0.7 + Math.min(1, rms * 5) * 0.3
          setLevel(smooth)
          raf = requestAnimationFrame(tick)
        }
        tick()
      } catch { setLevel(0) }
    })()
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); void ctx?.close().catch(() => {}); setLevel(0) }
  }, [active])
  return level
}

/** Seconds since `active` became true (0 when not active). */
export function useElapsed(active: boolean): number {
  const [s, setS] = useState(0)
  useEffect(() => {
    if (!active) { setS(0); return }
    const t0 = Date.now()
    const id = window.setInterval(() => setS(Math.floor((Date.now() - t0) / 1000)), 500)
    return () => window.clearInterval(id)
  }, [active])
  return s
}
