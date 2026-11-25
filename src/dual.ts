// Dual subtitles: two of the user's languages at once. The top line is whatever YouTube's player is
// showing (picked in the panel's list, or any other way); this file decides the second line. Pure.
import type { Dual } from './settings';
import { bestChoice, type Choice, currentLanguage, type PlayerState } from './tracks';

export interface SecondLine {
  /** Canonical language code. */
  language: string;
  choice: Choice;
}

/**
 * The second line for this video: the language the user picked for it; if that is what's showing on
 * top (YouTube started the video in it), the pair's other language; then the user's other languages
 * in their order. Always one of the user's languages, never the one on top, and only one this video
 * can show.
 */
export function secondLine(
  dual: Dual,
  mine: readonly string[],
  state: Pick<PlayerState, 'tracks' | 'translations' | 'current'>,
): SecondLine | null {
  const top = currentLanguage(state.current);
  if (!top) return null;
  for (const language of new Set([dual.bottom, dual.top, ...mine])) {
    if (!language || language === top || !mine.includes(language)) continue;
    const choice = bestChoice(language, state);
    if (choice) return { language, choice };
  }
  return null;
}

/** What's on screen when the user picks: both null while subtitles are off. */
export interface Showing {
  top: string | null;
  bottom: string | null;
}

/** The user picked `language` for the top line. Picking the one below swaps the two. */
export function pickTop(dual: Dual, language: string, showing: Showing): Dual {
  const bottom = language === showing.bottom ? showing.top : (dual.bottom ?? showing.bottom);
  return { ...dual, top: language, bottom: bottom === language ? null : bottom };
}

/** The user picked `language` for the second line; what's on top now is its pair. */
export function pickBottom(dual: Dual, language: string, showing: Showing): Dual {
  return { ...dual, top: showing.top ?? dual.top, bottom: language };
}
