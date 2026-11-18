// Which audio track is the video's original language, as opposed to a dub. Pure.
//
// YouTube's player (getAvailableAudioTracks(), checked live 2026-11-18 on a video with 21 audio
// tracks) gives each track an id like "251;Cg8KBWFjb250EgZkdWJiZWQKCgoEbGFuZxICZGU": the itag, then
// base64url protobuf "xtags", repeated { key, value } pairs: acont=dubbed|original, lang=de. The
// track's details (minified property names) also carry an id like "en.4" / "de.3"; ".4" is the
// original, so it serves as a fallback.

/** The xtags of a player audio track id: "251;…" → { acont: 'dubbed', lang: 'de' }. */
export function audioTags(trackId: string): Record<string, string> {
  const encoded = trackId.split(';')[1];
  if (!encoded) return {};
  let bytes: Uint8Array;
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  } catch {
    return {};
  }
  const text = (from: number, length: number) =>
    new TextDecoder().decode(bytes.subarray(from, from + length));
  const tags: Record<string, string> = {};
  // Field 1 (0x0a), length-delimited: a pair of field 1 = key, field 2 (0x12) = value.
  let i = 0;
  while (i + 1 < bytes.length && bytes[i] === 0x0a) {
    const end = i + 2 + (bytes[i + 1] ?? 0);
    let j = i + 2;
    let key = '';
    let value = '';
    while (j + 1 < end) {
      const field = bytes[j];
      const length = bytes[j + 1] ?? 0;
      if (field === 0x0a) key = text(j + 2, length);
      else if (field === 0x12) value = text(j + 2, length);
      j += 2 + length;
    }
    if (key) tags[key] = value;
    i = end;
  }
  return tags;
}

/** Any object-valued property with a string `id` and a `name`: the track's details. */
function details(track: object): { id?: string } | undefined {
  for (const value of Object.values(track)) {
    if (
      value &&
      typeof value === 'object' &&
      typeof (value as { id?: unknown }).id === 'string' &&
      'name' in value
    )
      return value as { id: string };
  }
  return undefined;
}

type Kind = 'original' | 'dub' | 'unknown';

function kindOf(track: unknown): Kind {
  if (!track || typeof track !== 'object') return 'unknown';
  const id = (track as { id?: unknown }).id;
  const acont = typeof id === 'string' ? audioTags(id).acont : undefined;
  if (acont) return acont === 'original' ? 'original' : 'dub';
  const detailId = details(track)?.id ?? '';
  if (/\.4$/.test(detailId)) return 'original';
  return /\.\d+$/.test(detailId) ? 'dub' : 'unknown';
}

export const isOriginalAudio = (track: unknown) => kindOf(track) === 'original';

/**
 * Positively a dub. The player reports a placeholder ("und", no tags) while it plays the video's
 * default audio; that is not a dub, and switching to the original then would only interrupt playback.
 */
export const isDubbedAudio = (track: unknown) => kindOf(track) === 'dub';
