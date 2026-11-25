// Dual subtitles on the video: two lines, one per language, drawn here in place of YouTube's captions.
//
// YouTube's player shows one track. The top line is still its track (picked in the panel, with the CC
// button, any way at all); the second is one more of the user's languages (src/dual.ts). Both tracks'
// lines are loaded through the page script and drawn from the video's clock. YouTube's own captions
// are hidden only while both are loaded: if anything fails, they simply stay.
import { ask, askCues } from '../bridge/client';
import { type Cue, cueAt } from '../cues';
import { secondLine } from '../dual';
import type { Dual } from '../settings';
import type { CaptionStyle, PlayerState } from '../tracks';
import { el } from './dom';
import { LINES_CSS } from './styles';

export const LINES_HOST = 'my-subtitles-lines';
/** On the player while our two lines stand in for YouTube's captions (entrypoints/content/page.css). */
export const DUAL_CLASS = 'my-subtitles-dual';

export interface DualLinesOptions {
  player: HTMLElement;
  dual: () => Dual;
  languages: () => string[];
}

export interface DualLines {
  readonly player: HTMLElement;
  /** Still in the player? */
  attached(): boolean;
  /** Settings, subtitles or the video changed: look again now. */
  sync(): void;
  destroy(): void;
}

const CHECK_MS = 700;

export function mountDualLines({ player, dual, languages }: DualLinesOptions): DualLines {
  const host = el('div', { class: LINES_HOST, 'aria-hidden': 'true' });
  const root = host.attachShadow({ mode: 'open' });
  const top = el('span', { class: 'line' });
  const bottom = el('span', { class: 'line' });
  root.append(
    el('style', {}, LINES_CSS),
    el('div', { class: 'row top' }, top),
    el('div', { class: 'row bottom' }, bottom),
  );
  // Where YouTube's captions are, so the controls and menus stay above the lines.
  const captions = player.querySelector('.ytp-caption-window-container');
  if (captions) captions.after(host);
  else player.append(host);

  const write = (line: HTMLElement, text: string) => {
    if (line.textContent !== text) line.textContent = text;
    (line.parentElement as HTMLElement).hidden = !text;
  };
  write(top, '');
  write(bottom, '');

  let destroyed = false;
  /** Video and the two tracks being shown or loaded. */
  let key = '';
  let pair: { top: Cue[]; bottom: Cue[] } | null = null;
  /** The video `pair` belongs to. */
  let video = '';
  let load = 0;
  let failure = { key: '', count: 0, retryAt: 0 };
  let frame = 0;
  let checking = false;
  let again = false;

  // ── Drawing ────────────────────────────────────────────────────────────────────────────────

  function draw() {
    frame = requestAnimationFrame(draw);
    const video = player.querySelector('video');
    if (!pair || !video) return;
    const ms = video.currentTime * 1000;
    write(top, cueAt(pair.top, ms)?.text ?? '');
    write(bottom, cueAt(pair.bottom, ms)?.text ?? '');
  }

  function show() {
    if (frame) return;
    player.classList.add(DUAL_CLASS);
    host.toggleAttribute('data-on', true);
    place();
    draw();
  }

  function hide() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    player.classList.remove(DUAL_CLASS);
    host.toggleAttribute('data-on', false);
    write(top, '');
    write(bottom, '');
  }

  function stop() {
    load++;
    key = '';
    pair = null;
    hide();
  }

  /** Above the controls while they show, like YouTube's captions; the font follows the player's size. */
  function place() {
    const controls = player.querySelector<HTMLElement>('.ytp-chrome-bottom');
    const showing = !!controls && !player.classList.contains('ytp-autohide');
    host.style.setProperty('--lift', `${showing ? controls.offsetHeight + 11 : 0}px`);
    const height = Math.min(player.clientHeight, (player.clientWidth * 9) / 16);
    host.style.setProperty('--size', `${Math.max(11, (height / 360) * 16).toFixed(2)}px`);
  }

  function style(captionStyle: CaptionStyle | undefined) {
    host.style.setProperty('--scale', String(captionStyle?.scale ?? 1));
    if (captionStyle) {
      // The second line is yellow, unless the viewer's own caption colour already is: then white.
      const [red = 255, green = 255, blue = 255] = (captionStyle.color.match(/\d+/g) ?? []).map(Number);
      const yellow = red > 180 && green > 180 && blue < 140;
      host.style.setProperty('--second', yellow ? 'rgb(255, 255, 255)' : 'rgb(255, 224, 102)');
      host.style.setProperty('--color', captionStyle.color);
      host.style.setProperty('--background', captionStyle.background);
    }
  }

  // ── Which two tracks ───────────────────────────────────────────────────────────────────────
  async function check() {
    if (destroyed) return;
    if (!dual().on) return stop();
    let state: PlayerState;
    try {
      state = await ask({ action: 'state' });
    } catch {
      return stop();
    }
    if (destroyed) return;
    const second = state.ad ? null : secondLine(dual(), languages(), state);
    if (!dual().on || !state.current || !second) return stop();
    style(state.captionStyle);

    const first = { vssId: state.current.vssId, translateTo: state.current.translateTo };
    const wanted = [
      state.videoId,
      first.vssId,
      first.translateTo,
      second.choice.vssId,
      second.choice.translateTo,
    ]
      .map((part) => part ?? '')
      .join('|');
    if (wanted === key) return; // showing, or loading
    if (wanted === failure.key && Date.now() < failure.retryAt) return;

    // Another line of the same video: the lines on screen stay until the new ones are loaded.
    if (pair && video === state.videoId) load++;
    else stop();
    key = wanted;
    const mine = load;
    try {
      const [topCues, bottomCues] = await Promise.all([
        askCues(first),
        askCues({ vssId: second.choice.vssId, translateTo: second.choice.translateTo }),
      ]);
      if (mine !== load || destroyed) return;
      if (!topCues.length || !bottomCues.length) throw new Error('empty');
      pair = { top: topCues, bottom: bottomCues };
      video = state.videoId;
      failure = { key: '', count: 0, retryAt: 0 };
      show();
    } catch {
      if (mine !== load || destroyed) return;
      // YouTube's captions stay up meanwhile. Soon again at first (the player may only now be
      // loading its captions), then less often.
      const count = failure.key === wanted ? failure.count + 1 : 1;
      failure = { key: wanted, count, retryAt: Date.now() + Math.min(15_000, 400 * 2 ** count) };
      stop();
    }
  }

  async function sync() {
    if (checking) {
      again = true;
      return;
    }
    checking = true;
    try {
      do {
        again = false;
        await check();
      } while (again && !destroyed);
    } finally {
      checking = false;
    }
  }

  const timer = setInterval(() => void sync(), CHECK_MS);
  // Controls showing or hiding, an ad starting: the player's classes change.
  let wasAd = player.classList.contains('ad-showing');
  const classes = new MutationObserver(() => {
    if (frame) place();
    const ad = player.classList.contains('ad-showing');
    if (ad !== wasAd) {
      wasAd = ad;
      void sync();
    }
  });
  classes.observe(player, { attributes: true, attributeFilter: ['class'] });
  // Subtitles turned on or off with YouTube's CC button or the C key.
  const button = player.querySelector('.ytp-subtitles-button');
  const pressed = new MutationObserver(() => void sync());
  if (button) pressed.observe(button, { attributes: true, attributeFilter: ['aria-pressed'] });
  const resized = new ResizeObserver(() => frame && place());
  resized.observe(player);
  void sync();

  return {
    player,
    attached: () => host.isConnected && host.parentElement === player,
    sync: () => void sync(),
    destroy() {
      destroyed = true;
      clearInterval(timer);
      classes.disconnect();
      pressed.disconnect();
      resized.disconnect();
      stop();
      host.remove();
    },
  };
}
