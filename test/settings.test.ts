import { describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const { canAdd, parseDual, parseLanguages } = await import('../src/settings');

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

describe('parseDual', () => {
  it('is off with no pair until the user turns it on', () => {
    for (const raw of [undefined, null, 'on', [], { on: 'yes' }]) {
      expect(parseDual(raw)).toEqual({ on: false, top: null, bottom: null });
    }
  });

  it('keeps the switch and the pair, as canonical codes', () => {
    expect(parseDual({ on: true, top: 'de-CH', bottom: 'iw' })).toEqual({
      on: true,
      top: 'de',
      bottom: 'he',
    });
    expect(parseDual({ on: true, top: '', bottom: 3 })).toEqual({ on: true, top: null, bottom: null });
  });
});
