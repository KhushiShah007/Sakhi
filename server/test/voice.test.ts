import { describe, expect, it } from 'vitest';
import { CALM, pickVoice, scoreVoice, splitSentences } from '../../src/voice/tts.js';

describe('calm voice settings', () => {
  it('is slower and lower than the default, with a real pause between sentences', () => {
    expect(CALM.rate).toBeLessThanOrEqual(0.85); expect(CALM.rate).toBeGreaterThan(0.6);
    expect(CALM.pitch).toBeLessThanOrEqual(0.9); expect(CALM.pitch).toBeGreaterThan(0.6);
    expect(CALM.pauseMs).toBeGreaterThanOrEqual(400);
  });
});

describe('splitSentences', () => {
  it('splits Latin, Devanagari and Gujarati sentences, keeps the punctuation, drops empties', () => {
    expect(splitSentences('Let your shoulders drop. Unclench your jaw.')).toEqual(['Let your shoulders drop.', 'Unclench your jaw.']);
    expect(splitSentences('कंधे ढीले छोड़ें। जबड़े को ढीला करें।')).toEqual(['कंधे ढीले छोड़ें।', 'जबड़े को ढीला करें।']);
    expect(splitSentences('એક વાક્ય. બીજું વાક્ય?')).toHaveLength(2);
    expect(splitSentences('Breathe in')).toEqual(['Breathe in']);
    expect(splitSentences('  ')).toEqual([]);
    expect(splitSentences('Well done!  Notice your body.')).toEqual(['Well done!', 'Notice your body.']);
  });
});

describe('voice choice', () => {
  const v = (name: string, lang: string) => ({ name, lang });
  it('prefers neural / natural voices over the robotic default of the same language', () => {
    const voices = [v('Microsoft Heera - Hindi (India)', 'hi-IN'), v('Microsoft Swara Online (Natural) - Hindi (India)', 'hi-IN'), v('espeak hindi', 'hi')];
    expect(pickVoice(voices, 'hi-IN')?.name).toBe('Microsoft Swara Online (Natural) - Hindi (India)');
  });
  it('prefers an exact locale, then the same language, and never a different language', () => {
    expect(pickVoice([v('Plain', 'en-GB'), v('Plain', 'en-IN')], 'en-IN')?.lang).toBe('en-IN');
    expect(pickVoice([v('Plain', 'en-GB')], 'en-IN')?.lang).toBe('en-GB');
    expect(pickVoice([v('Google US English', 'en-US'), v('Google हिन्दी', 'hi-IN')], 'mr-IN')).toBeUndefined();
    expect(scoreVoice(v('X', 'fr-FR'), 'hi-IN')).toBe(-Infinity);
  });
  it('handles underscore locales (Android) and Google voices', () => {
    expect(pickVoice([v('Voice', 'hi_IN'), v('Google हिन्दी', 'hi-IN')], 'hi-IN')?.name).toBe('Google हिन्दी');
  });
  it('avoids novelty/robotic voices when anything else exists', () => {
    expect(pickVoice([v('Zarvox', 'en-US'), v('Samantha', 'en-US')], 'en-US')?.name).toBe('Samantha');
  });
  it('returns nothing for an empty list', () => expect(pickVoice([], 'hi-IN')).toBeUndefined());
});
