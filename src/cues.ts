// A subtitle track's lines with their times, read from YouTube's caption data, and which line is
// showing at a given moment. Pure: the data is fetched in src/bridge/page.ts.
//
// The format is YouTube's "json3" (checked live 2026-11-25):
//   { events: [{ tStartMs, dDurationMs, segs: [{ utf8 }] }, …] }
// Uploaded subtitles are one event per line. Auto-generated ones are a line per event with a segment
// per word; each line stays until the next one has ended (YouTube shows two rolling lines), and
// between them come events holding only "\n". Auto-translated tracks keep the shape of their source.

export interface Cue {
  /** Milliseconds from the start of the video. */
  start: number;
  end: number;
  text: string;
}

interface RawEvent {
  tStartMs?: unknown;
  dDurationMs?: unknown;
  segs?: unknown;
}

/** YouTube's caption data → lines in time order. Line breaks inside a line become spaces. */
export function parseJson3(data: unknown): Cue[] {
  const events = (data as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return [];
  const cues: Cue[] = [];
  for (const event of events as RawEvent[]) {
    if (!event || typeof event.tStartMs !== 'number' || !Array.isArray(event.segs)) continue;
    const text = (event.segs as { utf8?: unknown }[])
      .map((seg) => (typeof seg?.utf8 === 'string' ? seg.utf8 : ''))
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) continue;
    const duration = typeof event.dDurationMs === 'number' ? event.dDurationMs : 0;
    cues.push({ start: event.tStartMs, end: event.tStartMs + Math.max(0, duration), text });
  }
  cues.sort((a, b) => a.start - b.start);
  // A line without a duration lasts until the next one starts.
  cues.forEach((cue, index) => {
    if (cue.end <= cue.start) cue.end = cues[index + 1]?.start ?? cue.start + 4000;
  });
  return cues;
}

/**
 * The line showing at `ms`: the one that started last and hasn't ended. So an auto-generated line
 * gives way as soon as the next one starts, one line at a time.
 */
export function cueAt(cues: readonly Cue[], ms: number): Cue | null {
  let low = 0;
  let high = cues.length - 1;
  let last = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((cues[middle]?.start ?? Infinity) <= ms) {
      last = middle;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }
  // Usually the last one started; a few back covers a long line with short ones inside it.
  for (let i = last; i >= 0 && i > last - 4; i--) {
    const cue = cues[i];
    if (cue && cue.end > ms) return cue;
  }
  return null;
}
