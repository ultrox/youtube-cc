import { describe, expect, it } from 'vitest';
import { bestChoice, currentLanguage, sameChoice, type Track, translationSource } from '../src/tracks';

const track = (languageCode: string, kind = '', extra: Partial<Track> = {}): Track => ({
  languageCode,
  displayName: kind === 'asr' ? `${languageCode} (auto-generated)` : languageCode,
  kind,
  vssId: `${kind === 'asr' ? 'a' : ''}.${languageCode}`,
  translatable: true,
  ...extra,
});

const translations = ['de', 'en', 'bs', 'hr', 'sr', 'iw', 'zh-Hans', 'pt', 'pt-PT'].map((languageCode) => ({
  languageCode,
  languageName: languageCode,
}));

describe('bestChoice', () => {
  it('prefers uploaded subtitles over auto-generated ones', () => {
    const state = { tracks: [track('en', 'asr'), track('en')], translations };
    expect(bestChoice('en', state)).toEqual({ vssId: '.en', how: 'subtitles' });
  });

  it('uses auto-generated subtitles when that’s all there is', () => {
    const state = { tracks: [track('de', 'asr')], translations };
    expect(bestChoice('de', state)).toEqual({ vssId: 'a.de', how: 'auto-generated' });
  });

  it('counts a regional variant as the language', () => {
    const state = { tracks: [track('en-GB'), track('en', 'asr')], translations };
    expect(bestChoice('en', state)).toEqual({ vssId: '.en-GB', how: 'subtitles' });
  });

  it('takes another variant before a machine translation', () => {
    const state = { tracks: [track('pt-PT')], translations };
    expect(bestChoice('pt', state)?.vssId).toBe('.pt-PT');
  });

  it('auto-translates from the spoken language’s uploaded subtitles', () => {
    const state = { tracks: [track('fr'), track('en'), track('en', 'asr')], translations };
    expect(bestChoice('bs', state)).toMatchObject({
      vssId: '.en',
      translateTo: 'bs',
      how: 'auto-translated',
    });
  });

  it('auto-translates with YouTube’s own code for the target', () => {
    const state = { tracks: [track('en', 'asr')], translations };
    expect(bestChoice('he', state)).toMatchObject({ vssId: 'a.en', translateTo: 'iw' });
  });

  it('is null when the video has no subtitles at all', () => {
    expect(bestChoice('de', { tracks: [], translations: [] })).toBeNull();
  });

  it('is null when nothing can be translated', () => {
    const state = { tracks: [track('en', '', { translatable: false })], translations };
    expect(bestChoice('de', state)).toBeNull();
  });

  it('is null when YouTube can’t translate into the language', () => {
    expect(bestChoice('kl', { tracks: [track('en')], translations })).toBeNull();
  });
});

describe('translationSource', () => {
  it('falls back to the auto-generated track, then any uploaded one', () => {
    expect(translationSource([track('fr'), track('de', 'asr')])?.vssId).toBe('a.de');
    expect(translationSource([track('fr')])?.vssId).toBe('.fr');
    expect(translationSource([])).toBeUndefined();
  });
});

describe('currentLanguage / sameChoice', () => {
  it('reads the translation target first', () => {
    expect(currentLanguage({ vssId: '.en', languageCode: 'en', translateTo: 'zh-Hant' })).toBe('zh-Hant');
    expect(currentLanguage({ vssId: '.en-GB', languageCode: 'en-GB' })).toBe('en');
    expect(currentLanguage(null)).toBeNull();
  });

  it('compares track and target', () => {
    const current = { vssId: '.en', languageCode: 'en', translateTo: 'de' };
    expect(sameChoice(current, { vssId: '.en', translateTo: 'de' })).toBe(true);
    expect(sameChoice(current, { vssId: '.en' })).toBe(false);
    expect(sameChoice(null, { vssId: '.en' })).toBe(false);
  });
});
