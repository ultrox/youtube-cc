import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const { pickBottom, pickTop, secondLine } = await import('../src/dual');

import type { Track } from '../src/tracks';

const track = (languageCode: string, kind = ''): Track => ({
  languageCode,
  displayName: languageCode,
  kind,
  vssId: `${kind === 'asr' ? 'a' : ''}.${languageCode}`,
  translatable: true,
});
const translations = ['de', 'en', 'bs', 'fr'].map((languageCode) => ({
  languageCode,
  languageName: languageCode,
}));
const tracks = [track('de'), track('en'), track('en', 'asr')];
const showing = (vssId: string, translateTo?: string) => ({
  tracks,
  translations,
  current: { vssId, languageCode: vssId.split('.')[1] ?? '', ...(translateTo ? { translateTo } : {}) },
});
const off = { tracks, translations, current: null };
const dual = (top: string | null = null, bottom: string | null = null) => ({ on: true, top, bottom });
const mine = ['de', 'en', 'bs'];

describe('secondLine', () => {
  it('is the language picked for it', () => {
    expect(secondLine(dual('de', 'en'), mine, showing('.de'))).toEqual({
      language: 'en',
      choice: { vssId: '.en', how: 'subtitles' },
    });
    expect(secondLine(dual('de', 'bs'), mine, showing('.de'))?.language).toBe('bs');
  });

  it('is the pair’s other language when the video starts in the second one', () => {
    expect(secondLine(dual('de', 'en'), mine, showing('.en'))?.language).toBe('de');
  });

  it('without a pair yet, is the first other language of the user’s', () => {
    expect(secondLine(dual(), mine, showing('.de'))?.language).toBe('en');
    expect(secondLine(dual(), mine, showing('.en', 'bs'))?.language).toBe('de');
  });

  it('skips a language the user has removed or the video can’t show', () => {
    expect(secondLine(dual('de', 'fr'), mine, showing('.de'))?.language).toBe('en');
    const untranslatable = { ...showing('.de'), translations: [] };
    expect(secondLine(dual('de', 'bs'), mine, untranslatable)?.language).toBe('en');
  });

  it('is nothing while subtitles are off or with a single language', () => {
    expect(secondLine(dual('de', 'en'), mine, off)).toBeNull();
    expect(secondLine(dual('de', 'en'), ['de'], showing('.de'))).toBeNull();
  });
});

describe('pickTop', () => {
  it('keeps the second line when another language goes on top', () => {
    expect(pickTop(dual('de', 'en'), 'bs', { top: 'de', bottom: 'en' })).toEqual(dual('bs', 'en'));
  });

  it('swaps the two when the second line’s language is picked', () => {
    expect(pickTop(dual('de', 'en'), 'en', { top: 'de', bottom: 'en' })).toEqual(dual('en', 'de'));
  });

  it('never pairs a language with itself', () => {
    expect(pickTop(dual('de', 'en'), 'en', { top: null, bottom: null })).toEqual(dual('en', null));
  });

  it('remembers the line shown below when none was picked yet', () => {
    expect(pickTop(dual(), 'bs', { top: 'de', bottom: 'en' })).toEqual(dual('bs', 'en'));
  });
});

describe('pickBottom', () => {
  it('pairs the pick with what is on top', () => {
    expect(pickBottom(dual('en', 'de'), 'bs', { top: 'de', bottom: 'en' })).toEqual(dual('de', 'bs'));
    expect(pickBottom(dual('en', null), 'bs', { top: null, bottom: null })).toEqual(dual('en', 'bs'));
  });
});
