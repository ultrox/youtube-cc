// Content-script side of the bridge (see protocol.ts).
import type { PlayerState } from '../tracks';
import { REQUEST_EVENT, RESPONSE_EVENT, type Request, type Response } from './protocol';

type Ask = { action: 'state' } | { action: 'select'; vssId: string; translateTo?: string };

export class BridgeError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

let nextId = 1;

/** Ask the page script; it answers synchronously, the timeout covers it not being there yet. */
export function ask(question: Ask, timeoutMs = 1500): Promise<PlayerState> {
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
      if (response.ok) resolve(response.state);
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
