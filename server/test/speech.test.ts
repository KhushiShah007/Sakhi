import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENCOURAGE, freshCueState, nextCue } from '../../src/voice/cues.js';

// A tiny fake of the browser speech engine, so the real src/voice/speech.ts code runs unchanged.
class FakeUtterance { text: string; lang = ''; rate = 1; pitch = 1; volume = 1; voice: unknown = null; onend: (() => void) | null = null; onerror: ((e: { error: string }) => void) | null = null; constructor(t: string) { this.text = t; } }
type V = { name: string; lang: string; localService: boolean };
const synth = {
  voices: [] as V[], spoken: [] as FakeUtterance[],
  behaviour: (_u: FakeUtterance) => {},
  getVoices() { return this.voices; },
  speak(u: FakeUtterance) { this.spoken.push(u); this.behaviour(u); },
  cancel() {}, addEventListener() {}, removeEventListener() {},
};
const EN: V = { name: 'Google UK English', lang: 'en-IN', localService: false };
const HI: V = { name: 'Google हिन्दी', lang: 'hi-IN', localService: false };

let m: typeof import('../../src/voice/speech.js');
beforeAll(async () => {
  Object.assign(globalThis, { window: globalThis, SpeechSynthesisUtterance: FakeUtterance, speechSynthesis: synth });
  m = await import('../../src/voice/speech.js');
});
beforeEach(() => { vi.useFakeTimers(); synth.spoken = []; synth.voices = [EN, HI]; m.resetVoiceStatus(); m.stopSpeaking(); synth.spoken = []; });
afterEach(() => { vi.useRealTimers(); });

describe('speech: errors never become a silent fast loop', () => {
  it('an engine error on every line stops after the first, reports why, and moves on at reading pace', async () => {
    synth.behaviour = (u) => { setTimeout(() => u.onerror?.({ error: 'synthesis-failed' }), 0); };
    const onError = vi.fn(); const onEnd = vi.fn();
    m.speak('One. Two. Three.', 'en', onEnd, { onError });
    await vi.advanceTimersByTimeAsync(50);
    expect(synth.spoken).toHaveLength(1);                       // not one attempt per sentence in a blink
    expect(onError).toHaveBeenCalledTimes(1); expect(onError).toHaveBeenCalledWith('synthesis-failed');
    expect(onEnd).not.toHaveBeenCalled();                       // the track does not skip ahead instantly
    expect(m.getVoiceStatus()).toMatchObject({ available: false, reason: 'synthesis-failed' });
    await vi.advanceTimersByTimeAsync(m.readingMs('One. Two. Three.') + 10);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a language with no usable voice shows text instead of an English voice reading it', async () => {
    synth.voices = [EN];
    const onError = vi.fn(); const onEnd = vi.fn();
    m.speak('ધીમેથી શ્વાસ લો.', 'gu', onEnd, { onError });
    await vi.advanceTimersByTimeAsync(10);
    expect(synth.spoken).toHaveLength(0);
    expect(onError).toHaveBeenCalledWith('no_voice_for_language');
    expect(m.getVoiceStatus().available).toBe(false);
    await vi.advanceTimersByTimeAsync(8000);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('Marathi may use a Hindi voice (same script)', async () => {
    synth.behaviour = (u) => { setTimeout(() => u.onend?.(), 0); };
    m.speak('हळूच श्वास घ्या.', 'mr', vi.fn());
    await vi.advanceTimersByTimeAsync(10);
    expect(synth.spoken).toHaveLength(1);
    expect((synth.spoken[0].voice as V).lang).toBe('hi-IN');
    expect(m.getVoiceStatus()).toMatchObject({ available: true, voiceName: HI.name });
  });

  it('no voices at all after the wait is reported, not silent', async () => {
    synth.voices = [];
    const onError = vi.fn();
    m.speak('Hello.', 'en', undefined, { onError });
    await vi.advanceTimersByTimeAsync(1100);
    expect(onError).toHaveBeenCalledWith('no_voices');
  });
});

describe('speech: engines that never say they are done', () => {
  it('the watchdog moves on when onend never fires', async () => {
    synth.behaviour = () => {};                                  // never calls onend
    m.speak('First line. Second line.', 'en', vi.fn());
    await vi.advanceTimersByTimeAsync(10);
    expect(synth.spoken).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(m.watchdogMs('First line.') + 10);
    await vi.advanceTimersByTimeAsync(2000);
    expect(synth.spoken.map((u) => u.text)).toEqual(['First line.', 'Second line.']);
  });

  it('a healthy engine speaks each sentence once, in order, then calls onEnd once', async () => {
    synth.behaviour = (u) => { setTimeout(() => u.onend?.(), 5); };
    const onEnd = vi.fn();
    m.speak('One. Two. Three.', 'en', onEnd);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(synth.spoken.map((u) => u.text)).toEqual(['One.', 'Two.', 'Three.']);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('a newer line cancels the old one: the old line never continues or calls its onEnd', async () => {
    synth.behaviour = (u) => { setTimeout(() => u.onend?.(), 5); };
    const first = vi.fn(); const second = vi.fn();
    m.speak('Old one. Old two.', 'en', first);
    await vi.advanceTimersByTimeAsync(2);
    m.speak('New.', 'en', second);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledTimes(1);
    expect(synth.spoken.filter((u) => u.text === 'Old two.')).toHaveLength(0);
  });
});

describe('Right Now cues', () => {
  it('speaks the full cue for the first two cycles only, then varied encouragement, never the same line twice in a row', () => {
    const st = freshCueState(); const said: string[] = [];
    const phase = (e: number) => { const c = e % 12; return c < 4 ? 'rn_in' : c < 6 ? 'rn_hold' : 'rn_out'; };
    for (let e = 0; e <= 90; e++) { const k = nextCue(e, phase(e), st); if (k) said.push(k); }
    expect(said.slice(0, 6)).toEqual(['rn_in', 'rn_hold', 'rn_out', 'rn_in', 'rn_hold', 'rn_out']);
    const rest = said.slice(6);
    expect(rest.length).toBeGreaterThanOrEqual(2); expect(rest.length).toBeLessThanOrEqual(3);
    expect(rest.every((k) => (ENCOURAGE as readonly string[]).includes(k))).toBe(true);
    for (let i = 1; i < said.length; i++) expect(said[i]).not.toBe(said[i - 1]);
    expect(said.length).toBeLessThanOrEqual(9);                   // was about 22 spoken cues in 90 s
  });
});
