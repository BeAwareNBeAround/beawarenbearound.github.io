import { expect, test } from '@playwright/test';
import { mockCounterRoute } from './mock-counter.js';
import { mockAudioRecordingRoutes } from './mock-audio-recording.js';
import { mockPlaylistPlayer } from './mock-playlist-player.js';

const INITIAL_TOTAL = 12544;
const FORMATTED_TOTALS = [INITIAL_TOTAL, INITIAL_TOTAL + 1, INITIAL_TOTAL + 2].map((n) => n.toLocaleString('en-US'));

test.use({ locale: 'en-US' });

test('reads the initial count and increments it on each action click', async ({ page }) => {
  const mock = mockCounterRoute(page, { initialTotal: INITIAL_TOTAL });

  mockAudioRecordingRoutes(page);

  await page.goto('/');

  const counter = page.locator('.counter-box');

  // Initial count comes from the GET ?url=...&action=click on mount.
  await expect(counter).toContainText(FORMATTED_TOTALS[0]);

  // Each action-button click POSTs action:'click' and the header follows
  // the response's metrics.total_views.
  await page.getByRole('button', { name: '語言' }).click();
  await page.getByRole('menuitem', { name: 'EN' }).click();
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

test('playlist rows count once while transport, settings, and automatic advancement count zero', async ({ page }) => {
  const mock = mockCounterRoute(page, { initialTotal: INITIAL_TOTAL });
  const media = await mockPlaylistPlayer(page);

  await page.goto('/');
  await page.getByRole('button', { name: '語言' }).click();
  await page.getByRole('menuitem', { name: 'EN' }).click();

  const counter = page.locator('.counter-box');
  await expect(counter).toContainText(FORMATTED_TOTALS[0]);

  // One counted path: the playlist row click.
  await page.locator('.playlist-row-3').click();
  await expect(counter).toContainText(FORMATTED_TOTALS[1]);
  await media.fire('playing');

  // Transport, settings, and seeking commands never count.
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Previous', exact: true }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Repeat all', exact: true }).click();
  await page.keyboard.press('Escape');
  await media.setDuration(30);
  await page.locator('.playlist-seek-range').fill('10');
  await page.getByRole('button', { name: 'Mute', exact: true }).click();

  // Automatic advancement (repeat all reaching the end) never counts either.
  await media.fire('ended');
  await expect(page.locator('.status')).toHaveText('Loading…');
  await media.fire('playing');
  await expect(page.locator('.status')).toHaveText('Playing education step 4...');
  await expect(counter).toContainText(FORMATTED_TOTALS[1]);

  const clickPosts = mock.requests.filter((request) => request.method === 'POST' && request.body?.action === 'click');
  expect(clickPosts.map((request) => request.body.action_target)).toEqual(['3']);
  for (const request of clickPosts) {
    expect(typeof request.body.action_target).toBe('string');
    expect(request.body.action_target).toMatch(/^\d+$/);
  }
  expect(mock.state().total).toBe(INITIAL_TOTAL + 1);
});
