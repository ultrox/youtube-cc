// Content-script side of the bridge (see protocol.ts).
import type { Cue } from '../cues';
import type { PlayerState } from '../tracks';
import { REQUEST_EVENT, RESPONSE_EVENT, type Request, type Response } from './protocol';

type Track = { vssId: string; translateTo?: string };
type Ask = { action: 'state' } | ({ action: 'select' } & Track);
type Question = Ask | ({ action: 'cues' } & Track);

export class BridgeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

let nextId = 1;

function send(question: Question, timeoutMs: number): Promise<Extract<Response, { ok: true }>> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const done = (event: Event) => {
      let response: Response;
      try {
        response = JSON.parse(String((event as CustomEvent).detail));
      } catch {
        return;
      }
      if (response.id !== id) return;
      cleanup();
      if (response.ok) resolve(response);
      else reject(new BridgeError(response.error));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new BridgeError('timeout'));
    }, timeoutMs);
    const cleanup = () => {
      clearTimeout(timer);
      document.removeEventListener(RESPONSE_EVENT, done);
    };
    document.addEventListener(RESPONSE_EVENT, done);
    const request: Request = { id, ...question };
    document.dispatchEvent(new CustomEvent(REQUEST_EVENT, { detail: JSON.stringify(request) }));
  });
}

/** Ask the page script; it answers synchronously, the timeout covers it not being there yet. */
export const ask = async (question: Ask, timeoutMs = 1500): Promise<PlayerState> =>
  (await send(question, timeoutMs)).state;

/** A track's lines. The page script fetches them from YouTube, so this one takes a moment. */
export const askCues = async (track: Track, timeoutMs = 10_000): Promise<Cue[]> =>
  (await send({ action: 'cues', ...track }, timeoutMs)).cues ?? [];
