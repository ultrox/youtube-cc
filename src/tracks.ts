// Which subtitle track to show for a language, given what the current video offers.
// Pure: the data comes from YouTube's player (src/bridge), see PlayerState.
import { canonical, primaryOf } from './languages';

/** One caption track, as YouTube's player lists it (`getOption('captions', 'tracklist')`). */
export interface Track {
  languageCode: string;
  /** YouTube's name for it in its interface language, e.g. "English (auto-generated)". */
  displayName: string;
  /** "asr" for automatic speech recognition, "" for uploaded or community subtitles. */
  kind: string;
  /** Unique per track: ".en", "a.en", ".en.nP7-2PuUl7o". */
  vssId: string;
  translatable: boolean;
}

export interface TranslationLanguage {
  /** YouTube's code, which is what auto-translate needs back ("iw", "zh-Hans", "pt-PT"). */
  languageCode: string;
  languageName: string;
}

/** What is showing now; null when subtitles are off. */
export interface CurrentTrack {
  vssId: string;
  languageCode: string;
  translateTo?: string;
}

export interface PlayerState {
  videoId: string;
  tracks: Track[];
  translations: TranslationLanguage[];
  current: CurrentTrack | null;
}

/** A way to show subtitles in a language: a track as is, or a track auto-translated. */
export interface Choice {
  vssId: string;
  /** YouTube's code of the auto-translate target, when translating. */
  translateTo?: string;
  how: 'subtitles' | 'auto-generated' | 'auto-translated';
  /** For auto-translated: the track it's translated from. */
  from?: Track;
}

const isAsr = (t: Track) => t.kind === 'asr';

/**
 * The best way to show `language` (a canonical code) on this video:
 * uploaded subtitles, then auto-generated ones, then auto-translate. A track in another variant of
 * the language (e.g. "pt-PT" for Portuguese) is taken before a machine translation.
 */
export function bestChoice(
  language: string,
  state: Pick<PlayerState, 'tracks' | 'translations'>,
): Choice | null {
  const exact = (t: Track) => canonical(t.languageCode) === language;
  const sibling = (t: Track) => primaryOf(t.languageCode) === primaryOf(language);
  const tiers: [(t: Track) => boolean, Choice['how']][] = [
    [(t) => !isAsr(t) && exact(t), 'subtitles'],
    [(t) => !isAsr(t) && sibling(t), 'subtitles'],
    [(t) => isAsr(t) && exact(t), 'auto-generated'],
    [(t) => isAsr(t) && sibling(t), 'auto-generated'],
  ];
  for (const [test, how] of tiers) {
    const track = state.tracks.find(test);
    if (track) return { vssId: track.vssId, how };
  }

  const target = state.translations.find((l) => canonical(l.languageCode) === language);
  const from = target && translationSource(state.tracks);
  if (!target || !from) return null;
  return { vssId: from.vssId, translateTo: target.languageCode, how: 'auto-translated', from };
}

/**
 * The track to auto-translate from. Uploaded subtitles in the spoken language (the language of
 * the auto-generated track) are the closest to what's said; then the auto-generated track itself;
 * then any uploaded subtitles.
 */
export function translationSource(tracks: readonly Track[]): Track | undefined {
  const usable = tracks.filter((t) => t.translatable);
  const asr = usable.find(isAsr);
  const spoken =
    asr && usable.find((t) => !isAsr(t) && primaryOf(t.languageCode) === primaryOf(asr.languageCode));
  return spoken ?? asr ?? usable.find((t) => !isAsr(t));
}

/** The canonical language of what's showing, if anything is. */
export function currentLanguage(current: CurrentTrack | null): string | null {
  if (!current) return null;
  return canonical(current.translateTo ?? current.languageCode);
}

export const sameChoice = (current: CurrentTrack | null, choice: Pick<Choice, 'vssId' | 'translateTo'>) =>
  !!current && current.vssId === choice.vssId && (current.translateTo ?? '') === (choice.translateTo ?? '');
