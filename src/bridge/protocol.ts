// The content script (isolated world: storage, UI) asks the page script (main world, where YouTube's
// player API lives) over two DOM events. Payloads are JSON strings: objects in a CustomEvent's detail
// don't cross between worlds.
import type { PlayerState } from '../tracks';

export const REQUEST_EVENT = 'my-subtitles:request';
export const RESPONSE_EVENT = 'my-subtitles:response';

export type Request =
  | { id: number; action: 'state' }
  | { id: number; action: 'select'; vssId: string; translateTo?: string };

export type Response =
  | { id: number; ok: true; state: PlayerState }
  | { id: number; ok: false; error: 'no-player' | 'no-track' | 'failed'; message?: string };
