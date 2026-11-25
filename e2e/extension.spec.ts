import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  type BrowserContext,
  test as base,
  chromium,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';

const extensionPath = fileURLToPath(new URL('../.output/chrome-mv3', import.meta.url));
const watchPage = readFileSync(new URL('./fixtures/watch.html', import.meta.url), 'utf8');

const test = base.extend<{ context: BrowserContext; page: Page }>({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright requires a destructuring pattern here
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      locale: 'de-DE', // first run picks the browser's languages: German
      args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
    });
    await context.route('https://www.youtube.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: watchPage }),
    );
    // Caption data, as YouTube gives it: nothing without the player's token, else the track's lines.
    await context.route('https://www.youtube.com/api/timedtext**', (route) => {
      const query = new URL(route.request().url()).searchParams;
      const name = `${query.get('tlang') ?? query.get('lang')}${query.get('kind') === 'asr' ? ' auto' : ''}`;
      const events = [1, 2].map((n) => ({
        tStartMs: n * 3000 - 2000,
        dDurationMs: 2000,
        segs: [{ utf8: `${name} line ${n}` }],
      }));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: query.get('pot') ? JSON.stringify({ events }) : '',
      });
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
  },
});

const chevron = (page: Page) => page.getByRole('button', { name: 'Subtitle languages' });
const panel = (page: Page) => page.getByRole('dialog', { name: 'Subtitle languages' });
const row = (page: Page, name: string | RegExp) => panel(page).getByRole('button', { name });
const calls = (page: Page) => page.evaluate(() => (window as unknown as { calls: unknown[] }).calls);

async function open(page: Page, video = 'many') {
  await page.goto(`https://www.youtube.com/watch?v=${video}`);
  await chevron(page).click();
  await expect(panel(page)).toBeVisible();
}

async function addLanguage(page: Page, search: string, pick: RegExp) {
  const input = panel(page).getByRole('searchbox', { name: 'Search to add a language' });
  await input.fill(search);
  await row(page, pick).first().click();
  await expect(row(page, pick).first()).toHaveAttribute('aria-pressed', 'true');
}

const names = (list: Locator) => list.locator('.name').allTextContents();

test('the chevron sits right after YouTube’s CC button', async ({ page }) => {
  await page.goto('https://www.youtube.com/watch?v=many');
  await expect(chevron(page)).toBeVisible();
  const order = await page
    .locator('.ytp-right-controls > *')
    .evaluateAll((nodes) => nodes.map((n) => n.className.split(' ')[0]));
  expect(order.slice(0, 2)).toEqual(['ytp-subtitles-button', 'my-subtitles-chevron']);
});

test('first run offers the browser’s languages and switches subtitles in one click', async ({ page }) => {
  await open(page);
  await expect(chevron(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(row(page, 'Off')).toHaveAttribute('aria-pressed', 'true');
  await expect(row(page, /Deutsch/)).toContainText('Subtitles');

  await row(page, /Deutsch/).click();
  await expect(panel(page)).toBeHidden();
  await expect(chevron(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(chevron(page)).toBeFocused();
  expect(await calls(page)).toEqual([{ vss: '.de', to: null }]);
  await expect(page.locator('.ytp-subtitles-button')).toHaveAttribute('aria-pressed', 'true');

  await chevron(page).click();
  await expect(row(page, /Deutsch/)).toHaveAttribute('aria-pressed', 'true');
  await row(page, 'Off').click();
  await expect(page.locator('.ytp-subtitles-button')).toHaveAttribute('aria-pressed', 'false');
});

test('search adds languages; they are saved and offered with how this video can show them', async ({
  page,
}) => {
  await open(page);
  await row(page, 'Edit languages').click();
  await expect(panel(page).getByRole('searchbox')).toBeFocused();

  await addLanguage(page, 'engl', /^English/);
  // Enter adds the best match and clears the search for the next one.
  const input = panel(page).getByRole('searchbox');
  await input.fill('bosn');
  await input.press('Enter');
  await expect(input).toHaveValue('');
  expect(await names(panel(page).locator('.edit-row'))).toEqual(['Deutsch', 'English', 'Bosanski']);

  await panel(page).getByRole('button', { name: 'Back' }).click();
  await expect(row(page, /English/)).toContainText('Subtitles');
  await expect(row(page, /Bosanski/)).toContainText('Auto-translated');

  await row(page, /Bosanski/).click();
  // Translated from the uploaded subtitles in the spoken language (English).
  expect(await calls(page)).toEqual([{ vss: '.en', to: 'bs' }]);

  await page.reload();
  await chevron(page).click();
  expect(await names(panel(page).locator('.list'))).toEqual(['Deutsch', 'English', 'Bosanski']);
});

test('languages can be reordered and removed', async ({ page }) => {
  await open(page);
  await row(page, 'Edit languages').click();
  await addLanguage(page, 'hrv', /^Hrvatski/);
  await panel(page).getByRole('searchbox').fill('');

  await panel(page).getByRole('button', { name: 'Move Hrvatski up' }).click();
  expect(await names(panel(page).locator('.edit-row'))).toEqual(['Hrvatski', 'Deutsch']);
  await panel(page).getByRole('button', { name: 'Remove Deutsch' }).click();
  expect(await names(panel(page).locator('.edit-row'))).toEqual(['Hrvatski']);

  await panel(page).getByRole('button', { name: 'Back' }).click();
  await expect(row(page, 'Edit languages')).toBeVisible();
  expect(await names(panel(page).locator('.list'))).toEqual(['Hrvatski']);
});

test('auto-generated subtitles are used when that is all there is', async ({ page }) => {
  await open(page, 'asr');
  await row(page, 'Edit languages').click();
  await addLanguage(page, 'english', /^English/);
  await panel(page).getByRole('button', { name: 'Back' }).click();
  await expect(row(page, /English/)).toContainText('Auto-generated');
  await expect(row(page, /Deutsch/)).toContainText('Auto-translated');
});

test('a video without subtitles says so and still lets you edit languages', async ({ page }) => {
  await open(page, 'none');
  await expect(panel(page)).toContainText('This video has no subtitles.');
  await expect(row(page, /Deutsch/)).toHaveAttribute('aria-disabled', 'true');
  await expect(row(page, 'Edit languages')).toBeEnabled();
});

test('clicks and keys inside the panel stay away from YouTube’s player and shortcuts', async ({ page }) => {
  await open(page);
  await row(page, 'Edit languages').click();
  await panel(page).getByRole('searchbox').pressSequentially('kf c');
  const leaked = await page.evaluate(() => {
    const w = window as unknown as { playerClicks: number; shortcutKeys: string[] };
    return { clicks: w.playerClicks, keys: w.shortcutKeys };
  });
  expect(leaked).toEqual({ clicks: 0, keys: [] });

  // Escape in the search closes the whole panel, back to the chevron.
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  await expect(chevron(page)).toBeFocused();
  // …and the reopened panel starts at the main view.
  await chevron(page).click();
  await expect(row(page, 'Edit languages')).toBeVisible();
});

test('once closed, the panel’s area belongs to the video again', async ({ page }) => {
  await open(page);
  const box = await panel(page).boundingBox();
  if (!box) throw new Error('panel has no box');
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();

  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  expect(await page.evaluate(() => (window as unknown as { playerClicks: number }).playerClicks)).toBe(1);
});

test('keyboard: arrows move through the rows, a click outside closes', async ({ page }) => {
  await open(page);
  await expect(row(page, 'Off')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(row(page, /Deutsch/)).toBeFocused();
  await page.keyboard.press('End');
  await expect(row(page, 'Edit languages')).toBeFocused();

  await page.mouse.click(5, 5);
  await expect(panel(page)).toBeHidden();
});

const audioNow = (page: Page) =>
  page.evaluate(() => (window as unknown as { audioNow(): string }).audioNow());
const audioCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { audioCalls: string[] }).audioCalls);

test('a video YouTube starts in a dub switches to its original audio', async ({ page }) => {
  await page.goto('https://www.youtube.com/watch?v=dub');
  await expect.poll(() => audioNow(page)).toBe('en.4');
  expect(await audioCalls(page)).toEqual(['en.4']); // once, not on every check
});

test('with Original audio off, the dub YouTube picked stays', async ({ page }) => {
  await open(page);
  const audio = panel(page).getByRole('switch', { name: /Original audio/ });
  await expect(audio).toHaveAttribute('aria-checked', 'true'); // on by default
  await audio.click();
  await expect(audio).toHaveAttribute('aria-checked', 'false');

  await page.goto('https://www.youtube.com/watch?v=dub');
  await expect(chevron(page)).toBeVisible();
  await page.waitForTimeout(1500); // several of the page script's checks
  expect(await audioNow(page)).toBe('de.3');
  expect(await audioCalls(page)).toEqual([]);
});

test('a video already playing its original audio is left alone', async ({ page }) => {
  await page.goto('https://www.youtube.com/watch?v=dub-original');
  await expect(chevron(page)).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await audioCalls(page)).toEqual([]);
});

test('the chevron turns over while the panel is open', async ({ page }) => {
  await open(page);
  const svg = chevron(page).locator('svg');
  await expect
    .poll(() => svg.evaluate((s) => getComputedStyle(s).transform))
    .toMatch(/^matrix\(-1, .*-1, 0, 0\)$/);
});

// ── Dual subtitles ───────────────────────────────────────────────────────────────────────────
const dualSwitch = (page: Page) => panel(page).getByRole('switch', { name: /Dual subtitles/ });
const chip = (page: Page, name: string) => panel(page).getByRole('radio', { name });
const player = (page: Page) => page.locator('#movie_player');
const seek = (page: Page, seconds: number) =>
  page.evaluate((s) => {
    (document.querySelector('video') as HTMLVideoElement).currentTime = s;
  }, seconds);
/** The lines our overlay shows on the video, top first. */
const lines = (page: Page) => page.locator('.my-subtitles-lines .row:not([hidden]) .line').allTextContents();

async function openWithLanguages(page: Page, video: string, ...searches: string[]) {
  await open(page, video);
  await row(page, 'Edit languages').click();
  const input = panel(page).getByRole('searchbox');
  for (const search of searches) {
    await input.fill(search);
    await input.press('Enter');
    await expect(input).toHaveValue('');
  }
  await panel(page).getByRole('button', { name: 'Back' }).click();
}

test('dual subtitles: one switch shows two of your languages, chips choose the second line', async ({
  page,
}) => {
  await openWithLanguages(page, 'many', 'engl', 'bosn');
  await expect(dualSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(panel(page).getByRole('radiogroup')).toHaveCount(0);

  // Subtitles are off: turning Dual on shows the first two languages and leaves the panel open.
  await dualSwitch(page).click();
  await expect(dualSwitch(page)).toHaveAttribute('aria-checked', 'true');
  await expect(panel(page)).toBeVisible();
  expect(await calls(page)).toEqual([{ vss: '.de', to: null }]);
  await expect(row(page, /Deutsch/)).toHaveAttribute('aria-pressed', 'true');
  await expect(chip(page, 'English')).toHaveAttribute('aria-checked', 'true');
  await expect(chip(page, 'Deutsch')).toHaveAttribute('aria-disabled', 'true'); // it's on top

  await seek(page, 1.5);
  await expect.poll(() => lines(page)).toEqual(['de line 1', 'en line 1']);
  // Our lines stand in for YouTube's captions.
  await expect(player(page)).toHaveClass(/my-subtitles-dual/);
  await expect(page.locator('.ytp-caption-window-container')).toHaveCSS('opacity', '0');
  await seek(page, 3.5); // between two lines
  await expect.poll(() => lines(page)).toEqual([]);
  await seek(page, 5);
  await expect.poll(() => lines(page)).toEqual(['de line 2', 'en line 2']);

  // Another second line: the panel stays, the player's own track is untouched.
  await chip(page, 'Bosanski').click();
  await expect(chip(page, 'Bosanski')).toHaveAttribute('aria-checked', 'true');
  await expect(panel(page)).toBeVisible();
  await expect.poll(() => lines(page)).toEqual(['de line 2', 'bs line 2']);
  expect(await calls(page)).toHaveLength(1);

  // Picking the second line's language in the list swaps the two.
  await row(page, /Bosanski/).click();
  await expect(panel(page)).toBeHidden();
  await expect.poll(() => lines(page)).toEqual(['bs line 2', 'de line 2']);

  // Remembered on the next video; YouTube's own CC button turns both lines on and off.
  await page.reload();
  await page.locator('.ytp-subtitles-button').click(); // the fixture's player starts in German
  await seek(page, 1.5);
  await expect.poll(() => lines(page)).toEqual(['de line 1', 'bs line 1']);
  await page.locator('.ytp-subtitles-button').click();
  await expect(player(page)).not.toHaveClass(/my-subtitles-dual/);
  await expect.poll(() => lines(page)).toEqual([]);

  // Off again: YouTube's captions are back.
  await page.locator('.ytp-subtitles-button').click();
  await expect(player(page)).toHaveClass(/my-subtitles-dual/);
  await chevron(page).click();
  await dualSwitch(page).click();
  await expect(dualSwitch(page)).toHaveAttribute('aria-checked', 'false');
  await expect(player(page)).not.toHaveClass(/my-subtitles-dual/);
  await expect(page.locator('.ytp-caption-window-container')).toHaveCSS('opacity', '1');
});

test('dual subtitles need a second language', async ({ page }) => {
  await open(page);
  await dualSwitch(page).click();
  await expect(panel(page)).toContainText('Add another language to pair it with.');
  await expect(player(page)).not.toHaveClass(/my-subtitles-dual/);
});

test('dual subtitles: a caption request made before we looked is asked for again', async ({ page }) => {
  await openWithLanguages(page, 'late', 'engl');
  await dualSwitch(page).click();
  await seek(page, 1.5);
  await expect.poll(() => lines(page), { timeout: 15_000 }).toEqual(['de line 1', 'en line 1']);
});

test('dual subtitles: when the second track can’t be loaded, YouTube’s captions stay', async ({ page }) => {
  await openWithLanguages(page, 'nopot', 'engl');
  await dualSwitch(page).click();
  await expect(chip(page, 'English')).toHaveAttribute('aria-checked', 'true');
  await page.waitForTimeout(2500); // several tries
  await expect(player(page)).not.toHaveClass(/my-subtitles-dual/);
  await expect(page.locator('.ytp-caption-window-container')).toHaveCSS('opacity', '1');
  expect(await lines(page)).toEqual([]);
});
