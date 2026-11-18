import { describe, expect, it } from 'vitest';
import { CATALOGUE, canonical, defaultLanguages, fold, namesOf, searchLanguages } from '../src/languages';

describe('canonical', () => {
  it.each([
    ['de', 'de'],
    ['de-CH', 'de'],
    ['en-GB', 'en'],
    ['EN_us', 'en'],
    ['es-419', 'es'],
    ['sr-Latn', 'sr'],
    ['iw', 'he'],
    ['in', 'id'],
    ['zh', 'zh-Hans'],
    ['zh-CN', 'zh-Hans'],
    ['zh-Hans', 'zh-Hans'],
    ['zh-TW', 'zh-Hant'],
    ['zh-HK', 'zh-Hant'],
    ['zh-Hant', 'zh-Hant'],
    ['pt', 'pt'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt-PT'],
    ['fil', 'fil'],
  ])('%s → %s', (input, expected) => {
    expect(canonical(input)).toBe(expected);
  });

  it('every catalogue code is already canonical', () => {
    for (const code of Object.keys(CATALOGUE)) expect(canonical(code)).toBe(code);
  });
});

describe('namesOf', () => {
  it('names a language in itself and in the reader’s language', () => {
    expect(namesOf('de', 'en')).toEqual({ native: 'Deutsch', local: 'German', english: 'German' });
    expect(namesOf('hr', 'de')).toMatchObject({ native: 'Hrvatski', local: 'Kroatisch' });
  });

  it('names Serbian in Latin script, next to Bosanski and Hrvatski', () => {
    expect(namesOf('sr', 'en').native).toBe('Srpski');
  });

  it('leaves out the local name when it is the same', () => {
    expect(namesOf('en', 'en').local).toBeUndefined();
  });

  it('falls back to the English name for languages Intl doesn’t know', () => {
    expect(namesOf('kri', 'en').english).toBe('Krio');
    expect(namesOf('xx-unknown', 'en', 'Somewhere').native).toBe('Somewhere');
  });
});

describe('searchLanguages', () => {
  const codes = Object.keys(CATALOGUE);
  const names = (code: string) => namesOf(code, 'en');

  it('finds by English name, native name and code', () => {
    expect(searchLanguages('germ', codes, names)[0]).toBe('de');
    expect(searchLanguages('deutsch', codes, names)[0]).toBe('de');
    expect(searchLanguages('hrv', codes, names)[0]).toBe('hr');
    expect(searchLanguages('bs', codes, names)).toContain('bs');
  });

  it('ignores accents and case', () => {
    expect(fold('Nemački')).toBe('nemacki');
    expect(searchLanguages('FRANCAIS', codes, names)[0]).toBe('fr');
  });

  it('matches a later word: "simplified" finds Chinese', () => {
    expect(searchLanguages('simplified', codes, names)).toContain('zh-Hans');
  });

  it('keeps the given order between equally good matches', () => {
    expect(searchLanguages('s', ['sv', 'sr', 'es'], names).slice(0, 2)).toEqual(['sv', 'sr']);
  });

  it('returns everything for an empty query', () => {
    expect(searchLanguages('  ', ['de', 'en'], names)).toEqual(['de', 'en']);
  });
});

describe('defaultLanguages', () => {
  it('takes the browser’s languages, deduplicated, at most four', () => {
    expect(defaultLanguages(['de-CH', 'de', 'en-US', 'en', 'bs', 'hr', 'sr'])).toEqual([
      'de',
      'en',
      'bs',
      'hr',
    ]);
  });

  it('falls back to English', () => {
    expect(defaultLanguages([])).toEqual(['en']);
    expect(defaultLanguages(['x-klingon'])).toEqual(['en']);
  });
});
