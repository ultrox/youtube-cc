// The user's languages and switches, kept in chrome.storage.local (on this device, never sent anywhere).
import { browser } from 'wxt/browser';
import { CATALOGUE, canonical, defaultLanguages } from './languages';

export const LANGUAGES_KEY = 'languages';
const MAX = 12;

/** Stored value → a clean list of canonical codes; null when nothing usable is stored. */
export function parseLanguages(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  const codes: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const code = value in CATALOGUE ? value : canonical(value);
    if (!codes.includes(code)) codes.push(code);
  }
  return codes.slice(0, MAX);
}

export const canAdd = (languages: readonly string[]) => languages.length < MAX;

export async function loadLanguages(): Promise<string[]> {
  const stored = parseLanguages((await browser.storage.local.get(LANGUAGES_KEY))[LANGUAGES_KEY]);
  if (stored) return stored;
  // First run: the browser's languages, saved so they don't shift when the browser's change.
  const initial = defaultLanguages(navigator.languages);
  await saveLanguages(initial);
  return initial;
}

export async function saveLanguages(languages: readonly string[]) {
  await browser.storage.local.set({ [LANGUAGES_KEY]: [...languages] });
}

export const ORIGINAL_AUDIO_KEY = 'originalAudio';

/** Never start a video in a dub. On unless the user turned it off. */
export const parseOriginalAudio = (raw: unknown) => raw !== false;

export async function loadOriginalAudio(): Promise<boolean> {
  return parseOriginalAudio((await browser.storage.local.get(ORIGINAL_AUDIO_KEY))[ORIGINAL_AUDIO_KEY]);
}

export async function saveOriginalAudio(on: boolean) {
  await browser.storage.local.set({ [ORIGINAL_AUDIO_KEY]: on });
}

export const DUAL_KEY = 'dual';

/** Dual subtitles: two of the user's languages at once (src/dual.ts). */
export interface Dual {
  on: boolean;
  /** The pair the user last put together, as canonical codes; null until they pick. */
  top: string | null;
  bottom: string | null;
}

export function parseDual(raw: unknown): Dual {
  const stored = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const code = (value: unknown) => (typeof value === 'string' && value.trim() ? canonical(value) : null);
  return { on: stored.on === true, top: code(stored.top), bottom: code(stored.bottom) };
}

export async function loadDual(): Promise<Dual> {
  return parseDual((await browser.storage.local.get(DUAL_KEY))[DUAL_KEY]);
}

export async function saveDual(dual: Dual) {
  await browser.storage.local.set({ [DUAL_KEY]: { ...dual } });
}

/** Changes to one stored value, from any tab (or the user's other windows). */
function onStored<T>(key: string, parse: (raw: unknown) => T, listener: (value: T) => void): () => void {
  const handle = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && key in changes) listener(parse(changes[key]?.newValue));
  };
  browser.storage.onChanged.addListener(handle);
  return () => browser.storage.onChanged.removeListener(handle);
}

export const onLanguagesChanged = (listener: (languages: string[]) => void) =>
  onStored(LANGUAGES_KEY, (raw) => parseLanguages(raw) ?? [], listener);

export const onOriginalAudioChanged = (listener: (on: boolean) => void) =>
  onStored(ORIGINAL_AUDIO_KEY, parseOriginalAudio, listener);

export const onDualChanged = (listener: (dual: Dual) => void) => onStored(DUAL_KEY, parseDual, listener);
