import type { Lang } from '../config.js';

export interface TtsAudio { audio: Buffer; mime: string }
export interface TtsProvider { name: string; synth(text: string, lang: Lang): Promise<TtsAudio> }

/** Calm, gentle delivery. Slower than normal, steady, no theatrics. Tunable per deployment, never a cloned voice. */
export const CALM_VOICE_SETTINGS = { stability: 0.75, similarity_boost: 0.75, style: 0, use_speaker_boost: false, speed: 0.9 } as const;
/** ElevenLabs "Sarah" is one of the stock premade voices. Override with ELEVENLABS_VOICE_ID; use only premade or licensed voices (never clone a real person). */
export const DEFAULT_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';
const BREAK_MODELS = /eleven_(multilingual_v2|turbo_v2|turbo_v2_5|flash_v2|flash_v2_5)/;

/** Short pauses between sentences. SSML breaks are only valid on some models, so they are added only when the model supports them. */
export function withPauses(text: string, model: string): string {
  if (!BREAK_MODELS.test(model)) return text;
  return text.replace(/([.!?।॥])\s+(?=\S)/g, '$1 <break time="0.6s" /> ');
}

/** ElevenLabs text-to-speech. Active only when ELEVENLABS_API_KEY is set; the key stays in the server environment. */
export class ElevenLabsTts implements TtsProvider {
  name = 'elevenlabs';
  constructor(private cfg: { apiKey: string; voiceId: string; model: string }, private fetchImpl: typeof fetch = fetch) {}
  async synth(text: string, _lang: Lang): Promise<TtsAudio> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(this.cfg.voiceId)}?output_format=mp3_44100_64`;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12_000);
    try {
      const res = await this.fetchImpl(url, {
        method: 'POST', signal: ctl.signal,
        headers: { 'xi-api-key': this.cfg.apiKey, 'content-type': 'application/json', accept: 'audio/mpeg' },
        body: JSON.stringify({ text: withPauses(text, this.cfg.model), model_id: this.cfg.model, voice_settings: CALM_VOICE_SETTINGS }),
      });
      if (!res.ok) throw new Error(`elevenlabs ${res.status}`); // status only: never echo the body or the key
      return { audio: Buffer.from(await res.arrayBuffer()), mime: 'audio/mpeg' };
    } finally { clearTimeout(timer); }
  }
}

export function ttsFromEnv(env: NodeJS.ProcessEnv = process.env): TtsProvider | null {
  if (!env.ELEVENLABS_API_KEY) return null;
  return new ElevenLabsTts({ apiKey: env.ELEVENLABS_API_KEY, voiceId: env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID, model: env.ELEVENLABS_MODEL || 'eleven_multilingual_v2' });
}
