// The content script (isolated world: storage, UI) asks the page script (main world, where YouTube's
// player API lives) over two DOM events. Payloads are JSON strings: objects in a CustomEvent's detail
// don't cross between worlds.
import type { Cue } from '../cues';
import type { PlayerState } from '../tracks';

export const REQUEST_EVENT = 'my-subtitles:request';
export const RESPONSE_EVENT = 'my-subtitles:response';
/** Content script → page script, on load and on every change: the user's settings for the player. */
export const SETTINGS_EVENT = 'my-subtitles:settings';

export interface PageSettings {
  /** Start every video in its original audio, never in a dub. */
  originalAudio: boolean;
}

export type Request =
  | { id: number; action: 'state' }
  | { id: number; action: 'select'; vssId: string; translateTo?: string }
  /** A track's lines with their times, for the second line of dual subtitles. Answered after a fetch. */
  | { id: number; action: 'cues'; vssId: string; translateTo?: string };

export type Failure =
  | 'no-player'
  | 'no-track'
  /** The player hasn't loaded captions for this video yet, so there is no request of its to reuse. */
  | 'no-source'
  | 'failed';

export type Response =
  | { id: number; ok: true; state: PlayerState; cues?: Cue[] }
  | { id: number; ok: false; error: Failure; message?: string };
