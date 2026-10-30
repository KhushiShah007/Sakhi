import type { Lang } from '../i18n'

/**
 * Speech-to-text that runs INSIDE the browser (Whisper, via transformers.js + WASM). It is the fallback when the browser's own
 * speech service cannot be reached: her voice is recorded, written out on this device, and the audio is thrown away.
 * The model (about 80 MB) is downloaded once from huggingface.co and then cached by the browser.
 */
export const WHISPER_MODEL = 'Xenova/whisper-base'
export const WHISPER_LANG: Record<Lang, string> = { hi: 'hindi', mr: 'marathi', gu: 'gujarati', en: 'english' }

export interface SttProgress { phase: 'download' | 'think'; pct: number | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipe: Promise<any> | null = null
let ready = false
export const sttModelReady = () => ready

const listeners = new Set<(p: SttProgress) => void>()
const emit = (p: SttProgress) => listeners.forEach((f) => f(p))

async function load() {
  const tf = await import('@huggingface/transformers')
  tf.env.allowLocalModels = false
  const wasm = tf.env.backends.onnx.wasm
  if (wasm) { wasm.wasmPaths = new URL('ort/', document.baseURI).href; wasm.numThreads = 1; wasm.proxy = false }
  const files = new Map<string, { loaded: number; total: number }>()
  return tf.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
    dtype: 'q8', device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file || !p.total) return
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total })
      let l = 0, t = 0
      for (const f of files.values()) { l += f.loaded; t += f.total }
      emit({ phase: 'download', pct: t ? Math.min(99, Math.round((l / t) * 100)) : null })
    },
  })
}

/** Decodes a recording (webm/opus, mp4, wav...) to the 16 kHz mono samples Whisper wants. */
export async function toMono16k(blob: Blob): Promise<Float32Array> {
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ctx = new AC()
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer())
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000)
    const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start()
    return (await off.startRendering()).getChannelData(0)
  } finally { void ctx.close().catch(() => {}) }
}

/** Writes out what was said. Rejects if the model cannot be loaded (offline on the very first use) or the audio cannot be read. */
export async function transcribe(blob: Blob, lang: Lang, onProgress: (p: SttProgress) => void = () => {}): Promise<string> {
  listeners.add(onProgress)
  try {
    const [p, audio] = await Promise.all([ensureLoaded(), toMono16k(blob)])
    onProgress({ phase: 'think', pct: null })
    return await run(p, audio, lang)
  } finally { listeners.delete(onProgress) }
}

/** Starts downloading the model in the background (call as soon as recording mode is chosen), so it is ready when she finishes speaking. */
export const preloadStt = (): void => { void ensureLoaded().catch(() => {}) }

function ensureLoaded() {
  pipe ??= load().then((p) => { ready = true; return p }).catch((e) => { pipe = null; throw e })
  return pipe
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run(p: any, audio: Float32Array, lang: Lang): Promise<string> {
  const out = await p(audio, { language: WHISPER_LANG[lang], task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
  const text = (Array.isArray(out) ? out.map((o: { text: string }) => o.text).join(' ') : out.text) as string
  return text.replace(/\s+/g, ' ').trim()
}
