import { describe, expect, it } from 'vitest';
import { audioTags, isDubbedAudio, isOriginalAudio } from '../src/audio';

/** A player audio track id the way YouTube builds it: "251;" + base64url(xtags protobuf). */
function trackId(tags: Record<string, string>) {
  const bytes: number[] = [];
  for (const [key, value] of Object.entries(tags)) {
    const k = [...new TextEncoder().encode(key)];
    const v = [...new TextEncoder().encode(value)];
    const pair = [0x0a, k.length, ...k, 0x12, v.length, ...v];
    bytes.push(0x0a, pair.length, ...pair);
  }
  return `251;${btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')}`;
}

describe('audioTags', () => {
  it('reads a real track id from YouTube', () => {
    expect(audioTags('251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZGU')).toEqual({ acont: 'dubbed', lang: 'de' });
    expect(audioTags('251;Cg8KBWFjb250EgZkdWJiZWQKDwoEbGFuZxIHemgtSGFudA')).toEqual({
      acont: 'dubbed',
      lang: 'zh-Hant',
    });
  });

  it('round-trips the builder', () => {
    expect(audioTags(trackId({ acont: 'original', lang: 'en' }))).toEqual({ acont: 'original', lang: 'en' });
  });

  it('is empty for ids without tags or garbage', () => {
    expect(audioTags('251')).toEqual({});
    expect(audioTags('251;%%%')).toEqual({});
  });
});

describe('isOriginalAudio', () => {
  it('trusts acont', () => {
    expect(isOriginalAudio({ id: trackId({ acont: 'original', lang: 'en' }) })).toBe(true);
    expect(isOriginalAudio({ id: trackId({ acont: 'dubbed', lang: 'de' }) })).toBe(false);
    expect(isOriginalAudio({ id: trackId({ acont: 'dubbed-auto', lang: 'de' }) })).toBe(false);
  });

  it('falls back to the ".4" id in the track details', () => {
    expect(isOriginalAudio({ id: '251', Xb: { id: 'en.4', name: 'English original' } })).toBe(true);
    expect(isOriginalAudio({ id: '251', Xb: { id: 'de.3', name: 'German' } })).toBe(false);
  });

  it('is false for nothing', () => {
    expect(isOriginalAudio(null)).toBe(false);
    expect(isOriginalAudio({})).toBe(false);
  });
});

describe('isDubbedAudio', () => {
  it('is true only for a positive dub', () => {
    expect(isDubbedAudio({ id: trackId({ acont: 'dubbed', lang: 'de' }) })).toBe(true);
    expect(isDubbedAudio({ id: '251', Xb: { id: 'de.3', name: 'German' } })).toBe(true);
    expect(isDubbedAudio({ id: trackId({ acont: 'original', lang: 'en' }) })).toBe(false);
  });

  it('is false for the placeholder the player reports while playing the default audio', () => {
    expect(isDubbedAudio({ id: '251', Xb: { id: 'und', name: 'Default' } })).toBe(false);
    expect(isDubbedAudio({})).toBe(false);
  });
});
