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

  await page.keyboard.press('Escape'); // back to the main view
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

  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(panel(page)).toBeHidden();
  await expect(chevron(page)).toBeFocused();
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

test('the chevron turns over while the panel is open', async ({ page }) => {
  await open(page);
  const svg = chevron(page).locator('svg');
  await expect
    .poll(() => svg.evaluate((s) => getComputedStyle(s).transform))
    .toMatch(/^matrix\(-1, .*-1, 0, 0\)$/);
});
