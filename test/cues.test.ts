import { describe, expect, it } from 'vitest';
import { cueAt, parseJson3 } from '../src/cues';

const event = (tStartMs: number, dDurationMs: number | undefined, ...words: string[]) => ({
  tStartMs,
  ...(dDurationMs === undefined ? {} : { dDurationMs }),
  segs: words.map((utf8) => ({ utf8 })),
});

describe('parseJson3', () => {
  it('reads uploaded subtitles, one line per event', () => {
    const cues = parseJson3({ events: [event(1000, 2000, 'Hallo\nWelt'), event(4000, 1500, 'Zwei')] });
    expect(cues).toEqual([
      { start: 1000, end: 3000, text: 'Hallo Welt' },
      { start: 4000, end: 5500, text: 'Zwei' },
    ]);
  });

  it('joins the words of an auto-generated line and drops the events that only break the line', () => {
    const cues = parseJson3({
      events: [
        { tStartMs: 0, dDurationMs: 9000, id: 1 }, // the window, no text
        event(80, 4000, 'so', ' today', ' we'),
        event(2070, 2010, '\n'),
        event(2080, 4500, 'look', ' at'),
      ],
    });
    expect(cues.map((cue) => cue.text)).toEqual(['so today we', 'look at']);
  });

  it('puts the lines in time order and ends a line without a duration at the next one', () => {
    const cues = parseJson3({ events: [event(5000, undefined, 'b'), event(1000, undefined, 'a')] });
    expect(cues).toEqual([
      { start: 1000, end: 5000, text: 'a' },
      { start: 5000, end: 9000, text: 'b' },
    ]);
  });

  it('is empty for anything else', () => {
    for (const data of [null, undefined, '', {}, { events: 'x' }, { events: [null, { segs: [] }, {}] }]) {
      expect(parseJson3(data)).toEqual([]);
    }
  });
});

describe('cueAt', () => {
  const cues = parseJson3({
    events: [event(1000, 2000, 'one'), event(4000, 3000, 'two'), event(5000, 3000, 'three')],
  });

  it('is the line showing at that moment', () => {
    expect(cueAt(cues, 1000)?.text).toBe('one');
    expect(cueAt(cues, 2999)?.text).toBe('one');
    expect(cueAt(cues, 4500)?.text).toBe('two');
  });

  it('is nothing before, between and after the lines', () => {
    expect(cueAt(cues, 0)).toBeNull();
    expect(cueAt(cues, 3000)).toBeNull();
    expect(cueAt(cues, 8000)).toBeNull();
    expect(cueAt([], 10)).toBeNull();
  });

  it('gives way to the line that started last when two overlap (auto-generated)', () => {
    expect(cueAt(cues, 5000)?.text).toBe('three');
    expect(cueAt(cues, 7500)?.text).toBe('three');
  });

  it('falls back to a long line still showing once a short one inside it has ended', () => {
    const nested = parseJson3({ events: [event(0, 10_000, 'long'), event(2000, 1000, 'short')] });
    expect(cueAt(nested, 2500)?.text).toBe('short');
    expect(cueAt(nested, 4000)?.text).toBe('long');
  });
});
