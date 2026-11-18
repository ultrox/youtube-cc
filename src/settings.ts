// The user's languages, kept in chrome.storage.local (on this device, never sent anywhere).
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

export function onOriginalAudioChanged(listener: (on: boolean) => void): () => void {
  const handle = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'local' && ORIGINAL_AUDIO_KEY in changes)
      listener(parseOriginalAudio(changes[ORIGINAL_AUDIO_KEY]?.newValue));
  };
  browser.storage.onChanged.addListener(handle);
  return () => browser.storage.onChanged.removeListener(handle);
}

/** Changes from any tab (or the user's other windows). */
export function onLanguagesChanged(listener: (languages: string[]) => void): () => void {
  const handle = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'local' || !(LANGUAGES_KEY in changes)) return;
    listener(parseLanguages(changes[LANGUAGES_KEY]?.newValue) ?? []);
  };
  browser.storage.onChanged.addListener(handle);
  return () => browser.storage.onChanged.removeListener(handle);
}
