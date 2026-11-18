// Main world: answers the content script with YouTube's player API on #movie_player.
//
// The player's caption API (checked live on 2026-11-18):
//   getOption('captions', 'tracklist', { includeAsr: true }) → every track, also while captions are off
//   getOption('captions', 'translationLanguages')            → auto-translate targets
//   getOption('captions', 'track')                           → what's showing, {} when off
//   setOption('captions', 'track', track)                    → show it (turns captions on); the
//     track must be the player's own object: a bare { languageCode, kind: 'asr' } picks the
//     uploaded track instead. Add translationLanguage: { languageCode, languageName } to translate.
import type { CurrentTrack, PlayerState, Track, TranslationLanguage } from '../tracks';
import { REQUEST_EVENT, RESPONSE_EVENT, type Request, type Response } from './protocol';

interface RawTrack {
  languageCode?: string;
  languageName?: string;
  displayName?: string;
  kind?: string;
  vss_id?: string;
  is_translateable?: boolean;
  translationLanguage?: { languageCode?: string; languageName?: string } | null;
}

interface Player extends HTMLElement {
  getOption(module: 'captions', option: string, args?: object): unknown;
  setOption(module: 'captions', option: string, value: unknown): void;
  getVideoData?(): { video_id?: string };
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
  return { videoId: p.getVideoData?.()?.video_id ?? '', tracks, translations, current };
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

export function installPageBridge() {
  document.addEventListener(REQUEST_EVENT, (event) => {
    let request: Request;
    try {
      request = JSON.parse(String((event as CustomEvent).detail));
    } catch {
      return;
    }
    let response: Response;
    try {
      response = handle(request);
    } catch (error) {
      response = { id: request.id, ok: false, error: 'failed', message: String(error) };
    }
    document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(response) }));
  });
}
