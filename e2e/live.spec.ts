// Against the real youtube.com: `pnpm build && pnpm e2e:live`. Not in CI (network, and YouTube
// changes); run it before a release and whenever YouTube's player changes.
import { fileURLToPath } from 'node:url';
import { chromium, expect, type Page, test } from '@playwright/test';

const extensionPath = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));
// A TED talk with ~50 uploaded subtitle languages, among them German and English, plus auto-generated English.
const VIDEO = 'https://www.youtube.com/watch?v=arj7oStGLkU&hl=en';

/** What YouTube's player says is showing: "vss_id → translation" or "off". */
const showing = (page: Page) =>
  page.evaluate(() => {
    const player = document.getElementById('movie_player') as unknown as {
      getOption(m: string, o: string): { vss_id?: string; translationLanguage?: { languageCode?: string } };
    };
    const track = player.getOption('captions', 'track');
    return track?.vss_id ? `${track.vss_id} → ${track.translationLanguage?.languageCode ?? '-'}` : 'off';
  });

test('switches real YouTube subtitles: uploaded, auto-translated, back, off', async () => {
  test.setTimeout(150_000);
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    locale: 'de-DE',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  const page = await context.newPage();
  await page.goto(VIDEO);
  // Cookie consent (EU and Switzerland): a modal over the page, a few seconds after load.
  // Matched by text: the button's accessible name is a long aria-label.
  const reject = page.locator('button', { hasText: /^\s*(Reject all|Alle ablehnen)\s*$/ }).first();
  await reject
    .waitFor({ state: 'visible', timeout: 15_000 })
    .then(() => reject.click())
    .catch(() => {});
  await page.waitForFunction(() => document.querySelector('#movie_player .ytp-subtitles-button'));
  // Let a pre-roll ad finish or be skippable; captions belong to the video, not the ad.
  await page.waitForFunction(
    () => !document.querySelector('#movie_player')?.classList.contains('ad-showing'),
    undefined,
    { timeout: 60_000 },
  );
  await page.evaluate(() =>
    (document.getElementById('movie_player') as unknown as { pauseVideo(): void }).pauseVideo(),
  );

  const chevron = page.getByRole('button', { name: 'Subtitle languages' });
  const panel = page.getByRole('dialog', { name: 'Subtitle languages' });
  const row = (name: RegExp | string) => panel.getByRole('button', { name });

  await chevron.click();
  await expect(row(/Deutsch/)).toContainText('Subtitles');
  await row(/Deutsch/).click();
  await expect.poll(() => showing(page)).toBe('.de → -');

  await chevron.click();
  await row('Edit languages').click();
  for (const search of ['bosn', 'engl']) {
    await panel.getByRole('searchbox').fill(search);
    await panel.getByRole('searchbox').press('Enter');
  }
  await panel.getByRole('button', { name: 'Back' }).click();
  await expect(row(/Bosanski/)).toContainText('Auto-translated');
  await row(/Bosanski/).click();
  await expect.poll(() => showing(page)).toMatch(/ → bs$/);

  // From a translation back to a plain track: the translation must not stick.
  await chevron.click();
  await expect(row(/Bosanski/)).toHaveAttribute('aria-pressed', 'true');
  await row(/English/).click();
  await expect.poll(() => showing(page)).toBe('.en → -');

  await chevron.click();
  const box = await panel.boundingBox();
  await row('Off').click();
  await expect.poll(() => showing(page)).toBe('off');

  // Where the panel was, a click reaches the video again (plays the paused video).
  if (!box) throw new Error('panel has no box');
  const state = () =>
    page.evaluate(() =>
      (document.getElementById('movie_player') as unknown as { getPlayerState(): number }).getPlayerState(),
    );
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect.poll(state).toBe(1); // playing
  await context.close();
});
