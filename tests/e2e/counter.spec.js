import { expect, test } from '@playwright/test';
import { mockCounterRoute } from './mock-counter.js';

const INITIAL_TOTAL = 12544;
const FORMATTED_TOTALS = [INITIAL_TOTAL, INITIAL_TOTAL + 1, INITIAL_TOTAL + 2].map((n) => n.toLocaleString('en-US'));

test.use({ locale: 'en-US' });

test('reads the initial count and increments it on each action click', async ({ page }) => {
  const mock = mockCounterRoute(page, { initialTotal: INITIAL_TOTAL });

  await page.addInitScript(() => {
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel() {}, speak() {} },
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        constructor(text) {
          this.text = text;
        }
      },
    });
  });

  await page.goto('/');

  const counter = page.locator('.counter-box');

  // Initial count comes from the GET ?url=...&action=click on mount.
  await expect(counter).toContainText(FORMATTED_TOTALS[0]);

  // Each action-button click POSTs action:'click' and the header follows
  // the response's metrics.total_views.
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByRole('button', { name: 'STAY', exact: true }).click();
  await expect(counter).toContainText(FORMATTED_TOTALS[1]);

  await page.getByRole('button', { name: 'STAY', exact: true }).click();
  await expect(counter).toContainText(FORMATTED_TOTALS[2]);

  // Wire contract, mirroring the unit stub semantics.
  expect(mock.requests.some((request) => request.method === 'GET' && new URL(request.url).searchParams.get('action') === 'click')).toBe(true);
  const visitPost = mock.requests.find((request) => request.method === 'POST' && request.body && request.body.action === undefined);
  expect(visitPost).toBeDefined();
  expect(visitPost.body.log).toBe(true);
  const clickPosts = mock.requests.filter((request) => request.method === 'POST' && request.body && request.body.action === 'click');
  expect(clickPosts.length).toBe(2);
  expect(clickPosts.map((request) => request.body.action_target)).toEqual(['1', '1']);
  expect(mock.state().total).toBe(INITIAL_TOTAL + 2);
});
