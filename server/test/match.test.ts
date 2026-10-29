import { describe, expect, it } from 'vitest';
import { matchLanguage, matchStage } from '../../src/voice/match.js';

describe('voice answer matching', () => {
  it.each([
    ['I speak Hindi', 'hi'], ['मराठी', 'mr'], ['gujarati please', 'gu'], ['ગુજરાતી', 'gu'], ['English', 'en'], ['हिंदी में', 'hi'],
  ])('language: %s -> %s', (text, want) => expect(matchLanguage(text)).toBe(want));
  it('language: no match returns null', () => expect(matchLanguage('blah')).toBeNull());

  it.each([
    ['my periods are irregular', 'perimenopause'], ['perimenopause', 'perimenopause'], ['पेरिमेनोपॉज़', 'perimenopause'],
    ['menopause', 'menopause'], ['मेनोपॉज़ हो गया', 'menopause'], ['मेनोपॉज', 'menopause'],
    ['I had a hysterectomy', 'surgical_early'], ['ऑपरेशन के बाद', 'surgical_early'],
    ['I am alone, no family', 'no_family'], ['मैं अकेली हूँ', 'no_family'],
  ])('stage: %s -> %s', (text, want) => expect(matchStage(text)).toBe(want));
  it('stage: perimenopause is not mistaken for menopause', () => expect(matchStage('perimenopause')).toBe('perimenopause'));
});
