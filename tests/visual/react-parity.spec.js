import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { mockCounterRoute } from '../e2e/mock-counter.js';
import { mockPlaylistPlayer } from '../e2e/mock-playlist-player.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Pattern route (must track logoUrl in src/App.jsx): keeps serving the
// fixture even if the logo asset name changes.
const LOGO_URL = 'https://epilepsy.org.hk/wp-content/uploads/elementor/thumbs/EFHK-abb-Logo*';
const logoBody = fs.readFileSync(path.join(__dirname, 'fixtures', 'efhk-logo.png'));

// The screenshots must not depend on external network state: the counter
// endpoint is mocked (shared e2e helper) and the EFHK logo is served from a
// captured fixture, so the rendered header is identical on every run.
function mockExternalRequests(page) {
  mockCounterRoute(page, { initialTotal: 12544 });
  page.route(LOGO_URL, (route) => {
    route.fulfill({ status: 200, contentType: 'image/png', body: logoBody });
  });
}

// Cover the YouTube embed with a fixed pink box so the screenshots never
// capture external video state. This is an in-page element (normal stacking
// context) rather than the built-in screenshot `mask`: the built-in mask
// paints in the top layer, above the native <dialog> modals, which would
// cover the dialog boxes in the FAQ snapshots.
async function maskVideoEmbed(page) {
  await page.evaluate(() => {
    const iframe = document.querySelector('iframe');
    const rect = iframe.getBoundingClientRect();
    const mask = document.createElement('div');
    mask.style.cssText = `position: absolute; left: ${rect.left}px; top: ${rect.top + window.scrollY}px; width: ${rect.width}px; height: ${rect.height}px; background: #f0f; pointer-events: none;`;
    document.body.appendChild(mask);
  });
}

const languageStates = [
  { selector: '繁體', snapshot: 'zh-hk-375.png', dialogSnapshot: 'faq-dialog-zh-hk-375.png' },
  { selector: '简体', snapshot: 'zh-cn-375.png', dialogSnapshot: 'faq-dialog-zh-cn-375.png' },
  { selector: 'EN', snapshot: 'en-375.png', dialogSnapshot: 'faq-dialog-en-375.png' },
];

test.describe('localized mobile layouts', () => {
  test.use({ viewport: { width: 375, height: 1200 } });
  test.use({ locale: 'en-US' });

  for (const language of languageStates) {
    test(`preserves the approved ${language.selector} layout`, async ({ page }) => {
      mockExternalRequests(page);
      await page.goto('/');
      await page.getByRole('button', { name: '語言' }).click();
      await page.getByRole('menuitem', { name: language.selector, exact: true }).click();
      await maskVideoEmbed(page);

      await expect(page).toHaveScreenshot(language.snapshot, {
        fullPage: true,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });

      await page.locator('.faq-guide').click();
      await expect(page.locator('dialog[open]')).toHaveCount(1);
      await expect(page).toHaveScreenshot(language.dialogSnapshot, {
        fullPage: false,
        animations: 'disabled',
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});

// The playlist replaced the static guide paragraphs, so the interactive card
// states are review material too. The deterministic media stand-in fixes the
// reported duration/position, so the transport row renders identically on
// every run instead of capturing whatever a real recording had decoded to.
const playlistStates = [
  { selector: '繁體', prefix: 'zh-hk', pause: '暫停', play: '播放', settings: '播放設定', repeatAll: '全部重複', speed: '速度 1.5×' },
  { selector: '简体', prefix: 'zh-cn', pause: '暂停', play: '播放', settings: '播放设置', repeatAll: '全部重复', speed: '速度 1.5×' },
  { selector: 'EN', prefix: 'en', pause: 'Pause', play: 'Play', settings: 'Settings', repeatAll: 'Repeat all', speed: 'Speed 1.5×' },
];

test.describe('playlist card states', () => {
  test.use({ viewport: { width: 375, height: 1200 } });
  test.use({ locale: 'en-US' });

  for (const state of playlistStates) {
    test(`captures the ${state.selector} selected, playing, and settings card`, async ({ page }) => {
      const media = await mockPlaylistPlayer(page);
      mockExternalRequests(page);
      await page.goto('/');
      await page.getByRole('button', { name: '語言' }).click();
      await page.getByRole('menuitem', { name: state.selector, exact: true }).click();
      await maskVideoEmbed(page);

      const screenshotOptions = { fullPage: true, animations: 'disabled', maxDiffPixelRatio: 0.01 };

      // Playing: a selected row, the transport row mid-track.
      await page.locator('.playlist-row-2').click();
      await media.fire('playing');
      await media.setDuration(42);
      await media.setTime(13);
      await expect(page.locator('.playlist-seek .playlist-time')).toHaveText(['0:13', '0:42']);
      await expect(page).toHaveScreenshot(`${state.prefix}-playing-375.png`, screenshotOptions);

      // Selected: the same track paused, so the selected mark shows without the
      // playing badge or the upper-button highlight.
      await page.getByRole('button', { name: state.pause, exact: true }).click();
      await expect(page.locator('.playlist-playing-badge')).toHaveCount(0);
      await expect(page).toHaveScreenshot(`${state.prefix}-selected-375.png`, screenshotOptions);

      // Settings: repeat and speed choices open over the card.
      await page.getByRole('button', { name: state.play, exact: true }).click();
      await media.fire('playing');
      await page.getByRole('button', { name: state.settings, exact: true }).click();
      await page.getByRole('button', { name: state.repeatAll, exact: true }).click();
      await page.getByRole('button', { name: state.speed, exact: true }).click();
      await expect(page.locator('#playlist-settings-panel')).toBeVisible();
      await expect(page).toHaveScreenshot(`${state.prefix}-settings-375.png`, screenshotOptions);
    });
  }
});
