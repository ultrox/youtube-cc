import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const { canAdd, parseLanguages } = await import('../src/settings');

describe('parseLanguages', () => {
  it('cleans, canonicalises and deduplicates', () => {
    expect(parseLanguages(['de', 'de-CH', 'en-GB', 'iw', '', 3, 'zh-TW'])).toEqual([
      'de',
      'en',
      'he',
      'zh-Hant',
    ]);
  });

  it('keeps an empty list (the user removed everything)', () => {
    expect(parseLanguages([])).toEqual([]);
  });

  it('is null for nothing stored', () => {
    expect(parseLanguages(undefined)).toBeNull();
    expect(parseLanguages('de')).toBeNull();
  });

  it('caps the list', () => {
    const many = ['de', 'en', 'fr', 'it', 'es', 'pt', 'nl', 'sv', 'da', 'fi', 'pl', 'cs', 'sk', 'hu'];
    expect(parseLanguages(many)).toHaveLength(12);
    expect(canAdd(many.slice(0, 11))).toBe(true);
    expect(canAdd(many.slice(0, 12))).toBe(false);
  });
});
