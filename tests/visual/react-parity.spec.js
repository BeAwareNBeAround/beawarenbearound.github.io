import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { mockCounterRoute } from '../e2e/mock-counter.js';

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
