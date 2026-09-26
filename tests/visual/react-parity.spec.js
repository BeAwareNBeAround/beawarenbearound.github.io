import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { mockCounterRoute } from '../e2e/mock-counter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_URL = 'https://epilepsy.org.hk/wp-content/uploads/elementor/thumbs/EFHK-abb-Logo-Ver-%E5%9C%93%E5%BA%95-rsi4tzw9b949vi84j6y5gkdzbj2s5xn3mit7czgz2g.png';
const logoBody = fs.readFileSync(path.join(__dirname, 'fixtures', 'efhk-logo.png'));

// The screenshots must not depend on external network state: the counter
// endpoint is mocked (shared e2e helper) and the EFHK logo is served from a
// captured fixture, so the rendered header is identical on every run.
async function mockExternalRequests(page) {
  mockCounterRoute(page, { initialTotal: 12544 });
  await page.route(LOGO_URL, (route) => {
    route.fulfill({ status: 200, contentType: 'image/png', body: logoBody });
  });
}

const languageStates = [
  { selector: '繁體', snapshot: 'zh-hk-375.png' },
  { selector: '简体', snapshot: 'zh-cn-375.png' },
  { selector: 'EN', snapshot: 'en-375.png' },
];

test.describe('localized mobile layouts', () => {
  test.use({ viewport: { width: 375, height: 1200 } });

  for (const language of languageStates) {
    test(`preserves the approved ${language.selector} layout`, async ({ page }) => {
      await mockExternalRequests(page);
      await page.goto('/');
      await page.getByRole('button', { name: language.selector, exact: true }).click();

      await expect(page).toHaveScreenshot(language.snapshot, {
        fullPage: true,
        animations: 'disabled',
        mask: [page.locator('iframe')],
        maxDiffPixelRatio: 0.01,
      });
    });
  }
});
