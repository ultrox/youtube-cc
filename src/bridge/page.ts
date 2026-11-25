// Main world: answers the content script with YouTube's player API on #movie_player.
//
// The player's caption API (checked live on 2026-11-18):
//   getOption('captions', 'tracklist', { includeAsr: true }) → every track, also while captions are off
//   getOption('captions', 'translationLanguages')            → auto-translate targets
//   getOption('captions', 'track')                           → what's showing, {} when off
//   setOption('captions', 'track', track)                    → show it (turns captions on); the
//     track must be the player's own object: a bare { languageCode, kind: 'asr' } picks the
//     uploaded track instead. Add translationLanguage: { languageCode, languageName } to translate.
//
// Caption data (checked live 2026-11-25): the player loads a track's lines from
//   /api/timedtext?v=…&lang=de&fmt=json3&pot=…   (+ kind=asr, name=…, tlang=bs)
// `pot` is a proof-of-origin token the player works out per video; without it YouTube answers 200
// with an empty body. The same URL with another lang/kind/name/tlang gives that track, which is how
// the second line of dual subtitles is loaded (src/cues.ts reads the format). The page clears
// performance.getEntries(), so the player's request is caught by a PerformanceObserver from the start.
//   setOption('captions', 'reload', true)  → the player requests the showing track again
//   getSubtitlesUserSettings()             → { fontSizeIncrement, color, textOpacity, background, … };
//     the font is 16px per 360px of player height, × (1 + fontSizeIncrement / 4)
//
// Audio (2026-11-18, a video with 21 audio tracks): getAvailableAudioTracks(), getAudioTrack(), and
// setAudioTrack(track) with one of the player's own track objects. See src/audio.ts for telling the
// original from a dub.
import { isDubbedAudio, isOriginalAudio } from '../audio';
import { type Cue, parseJson3 } from '../cues';
import type { CaptionStyle, CurrentTrack, PlayerState, Track, TranslationLanguage } from '../tracks';
import {
  type Failure,
  type PageSettings,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  type Request,
  type Response,
  SETTINGS_EVENT,
} from './protocol';

interface RawTrack {
  languageCode?: string;
  languageName?: string;
  displayName?: string;
  kind?: string;
  /** Set when a video has several tracks in one language. */
  name?: string;
  vss_id?: string;
  is_translateable?: boolean;
  translationLanguage?: { languageCode?: string; languageName?: string } | null;
}

interface Player extends HTMLElement {
  getOption(module: 'captions', option: string, args?: object): unknown;
  setOption(module: 'captions', option: string, value: unknown): void;
  getVideoData?(): { video_id?: string };
  getSubtitlesUserSettings?(): {
    fontSizeIncrement?: number;
    color?: string;
    textOpacity?: number;
    background?: string;
    backgroundOpacity?: number;
  };
  getAvailableAudioTracks?(): unknown[];
  getAudioTrack?(): unknown;
  setAudioTrack?(track: unknown): boolean;
}

const player = () => {
  const el = document.getElementById('movie_player') as Player | null;
  return el && typeof el.getOption === 'function' && typeof el.setOption === 'function' ? el : null;
};

const list = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

function rawTracks(p: Player): RawTrack[] {
  return list<RawTrack>(p.getOption('captions', 'tracklist', { includeAsr: true })).filter(
    (t) => t?.languageCode && t.vss_id,
  );
}

function readState(p: Player): PlayerState {
  const tracks: Track[] = rawTracks(p).map((t) => ({
    languageCode: t.languageCode ?? '',
    displayName: t.displayName || t.languageName || t.languageCode || '',
    kind: t.kind ?? '',
    vssId: t.vss_id ?? '',
    translatable: t.is_translateable !== false,
  }));
  const translations: TranslationLanguage[] = list<{ languageCode?: string; languageName?: string }>(
    p.getOption('captions', 'translationLanguages'),
  )
    .filter((l) => l?.languageCode)
    .map((l) => ({
      languageCode: l.languageCode ?? '',
      languageName: l.languageName ?? l.languageCode ?? '',
    }));
  const raw = (p.getOption('captions', 'track') ?? {}) as RawTrack;
  const current: CurrentTrack | null =
    raw.languageCode && raw.vss_id
      ? {
          vssId: raw.vss_id,
          languageCode: raw.languageCode,
          ...(raw.translationLanguage?.languageCode
            ? { translateTo: raw.translationLanguage.languageCode }
            : {}),
        }
      : null;
  return {
    videoId: p.getVideoData?.()?.video_id ?? '',
    tracks,
    translations,
    current,
    captionStyle: captionStyle(p),
    ad: p.classList.contains('ad-showing'),
  };
}

/** "#fff" or "#080808" with an opacity → a CSS colour. */
function rgba(hex: unknown, opacity: unknown, fallback: string): string {
  const found = typeof hex === 'string' ? /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)?.[1] : undefined;
  if (!found) return fallback;
  const digits = found.length === 3 ? [...found].map((d) => d + d).join('') : found;
  const channel = (at: number) => Number.parseInt(digits.slice(at, at + 2), 16);
  const alpha = typeof opacity === 'number' && opacity >= 0 && opacity <= 1 ? opacity : 1;
  return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${alpha})`;
}

function captionStyle(p: Player): CaptionStyle | undefined {
  let settings: ReturnType<NonNullable<Player['getSubtitlesUserSettings']>> | undefined;
  try {
    settings = p.getSubtitlesUserSettings?.();
  } catch {}
  if (!settings) return undefined;
  const step = typeof settings.fontSizeIncrement === 'number' ? settings.fontSizeIncrement : 0;
  return {
    scale: Math.min(2, Math.max(0.5, 1 + step / 4)),
    color: rgba(settings.color, settings.textOpacity, 'rgb(255, 255, 255)'),
    background: rgba(settings.background, settings.backgroundOpacity, 'rgba(8, 8, 8, 0.75)'),
  };
}

class Refusal extends Error {
  constructor(readonly code: Failure) {
    super(code);
  }
}

/**
 * The lines of any track of the playing video. YouTube only answers caption requests that carry the
 * player's token, so this watches for the player's own request and asks again with another track.
 */
function captionLoader() {
  const KEEP = 12;
  /** Video id → the player's last caption request for it. */
  const sources = new Map<string, string>();
  const loaded = new Map<string, Promise<Cue[]>>();
  let nudged = '';

  const remember = <T>(map: Map<string, T>, key: string, value: T) => {
    map.delete(key);
    map.set(key, value);
    for (const oldest of map.keys()) {
      if (map.size <= KEEP) break;
      map.delete(oldest);
    }
  };

  try {
    new PerformanceObserver((entries) => {
      for (const entry of entries.getEntries()) {
        if (!entry.name.includes('/api/timedtext')) continue;
        try {
          const video = new URL(entry.name).searchParams.get('v');
          if (video) remember(sources, video, entry.name);
        } catch {}
      }
    }).observe({ type: 'resource', buffered: true });
  } catch {}

  return async (p: Player, vssId: string, translateTo?: string): Promise<Cue[]> => {
    const video = p.getVideoData?.()?.video_id ?? '';
    const track = rawTracks(p).find((t) => t.vss_id === vssId);
    if (!track?.languageCode) throw new Refusal('no-track');
    const source = sources.get(video);
    if (!source) {
      // Subtitles are showing but their request was missed: have the player make it again, once.
      if (nudged !== video && (p.getOption('captions', 'track') as RawTrack | undefined)?.vss_id) {
        nudged = video;
        p.setOption('captions', 'reload', true);
      }
      throw new Refusal('no-source');
    }

    const url = new URL(source);
    const set = (name: string, value: string | undefined) =>
      value ? url.searchParams.set(name, value) : url.searchParams.delete(name);
    set('lang', track.languageCode);
    set('kind', track.kind);
    set('name', track.name);
    set('tlang', translateTo);
    set('fmt', 'json3');

    const key = `${video}|${vssId}|${translateTo ?? ''}`;
    let lines = loaded.get(key);
    if (!lines) {
      lines = fetch(url).then(async (response) => {
        const body = await response.text();
        if (!response.ok || !body) throw new Refusal('failed');
        return parseJson3(JSON.parse(body));
      });
      remember(loaded, key, lines);
      lines.catch(() => loaded.delete(key));
    }
    return lines;
  };
}

function handle(request: Request): Response {
  const p = player();
  if (!p) return { id: request.id, ok: false, error: 'no-player' };
  if (request.action === 'select') {
    const track = rawTracks(p).find((t) => t.vss_id === request.vssId);
    if (!track) return { id: request.id, ok: false, error: 'no-track' };
    if (request.translateTo) {
      const target = list<{ languageCode?: string; languageName?: string }>(
        p.getOption('captions', 'translationLanguages'),
      ).find((l) => l.languageCode === request.translateTo);
      if (!target) return { id: request.id, ok: false, error: 'no-track' };
      p.setOption('captions', 'track', { ...track, translationLanguage: target });
    } else {
      // Without a translation left on the player's object by an earlier pick.
      const { translationLanguage: _, ...plain } = track;
      p.setOption('captions', 'track', plain);
    }
  }
  return { id: request.id, ok: true, state: readState(p) };
}

/**
 * Original audio: when a video starts in a dub (YouTube picks one to match the viewer's language),
 * switch to the original. Only in the first seconds of each video, where YouTube makes its pick; a
 * dub the viewer chooses by hand after that stays.
 */
function audioKeeper() {
  const WINDOW_MS = 4000;
  let enabled = false;
  let video = '';
  let since = 0;

  document.addEventListener(SETTINGS_EVENT, (event) => {
    try {
      const settings: PageSettings = JSON.parse(String((event as CustomEvent).detail));
      // Turned on mid-video: apply it now.
      if (settings.originalAudio && !enabled) video = '';
      enabled = settings.originalAudio;
    } catch {}
  });

  setInterval(() => {
    if (!enabled) return;
    const p = player();
    if (!p?.getAvailableAudioTracks || !p.getAudioTrack || !p.setAudioTrack) return;
    if (p.classList.contains('ad-showing')) return;
    const id = p.getVideoData?.()?.video_id ?? '';
    const tracks = p.getAvailableAudioTracks() ?? [];
    if (!id || !tracks.length) return;
    if (id !== video) {
      video = id;
      since = Date.now();
    }
    if (Date.now() - since > WINDOW_MS || tracks.length < 2) return;
    const original = tracks.find(isOriginalAudio);
    if (original && isDubbedAudio(p.getAudioTrack())) p.setAudioTrack(original);
  }, 250);
}

export function installPageBridge() {
  audioKeeper();
  const loadCues = captionLoader();
  const answer = (response: Response) =>
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(response) }));

  document.addEventListener(REQUEST_EVENT, (event) => {
    let request: Request;
    try {
      request = JSON.parse(String((event as CustomEvent).detail));
    } catch {
      return;
    }
    const { id } = request;
    const failed = (error: unknown) =>
      answer({
        id,
        ok: false,
        error: error instanceof Refusal ? error.code : 'failed',
        message: String(error),
      });
    try {
      if (request.action !== 'cues') return answer(handle(request));
      const p = player();
      if (!p) return failed(new Refusal('no-player'));
      loadCues(p, request.vssId, request.translateTo).then(
        (cues) => answer({ id, ok: true, state: readState(p), cues }),
        failed,
      );
    } catch (error) {
      failed(error);
    }
  });
}
