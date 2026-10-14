import { expect, test } from '@playwright/test';

const RECORDING_NAMES = ['stay', 'save', 'side', 'help'];
const RECORDING_LOCALES = ['zh-HK', 'zh-CN', 'en'];

test('serves the generated manifest and service worker', async ({ page, request }) => {
  await page.goto('/');

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(manifestHref).toBeTruthy();

  const manifest = await request.get(manifestHref);
  expect(manifest.ok()).toBeTruthy();
  expect(await manifest.json()).toMatchObject({
    name: "香港腦癇基金會 - 守望相助 (EFHK Be Aware n' Be Around)",
    display: 'standalone',
  });

  const serviceWorker = await request.get('/sw.js');
  expect(serviceWorker.ok()).toBeTruthy();
});

test('precaches every locale recording under a relative asset path', async ({ request }) => {
  const response = await request.get('/sw.js');
  expect(response.ok()).toBeTruthy();
  const swSource = await response.text();

  // The build keeps the app's relative base ('./'), so recordings must be
  // precached relative to the service-worker scope, never as absolute paths.
  for (const name of RECORDING_NAMES) {
    for (const locale of RECORDING_LOCALES) {
      expect(swSource).toContain(`"resources/${name}-${locale}.mp3"`);
    }
  }
  expect(swSource).not.toContain('"/resources/');
});

test('plays a cached recording after the service worker activates offline', async ({ page, context }) => {
  await page.goto('/');

  // Activation evidence: the SW is active and every locale recording has been
  // precached (workbox keys carry a revision query, so compare pathnames).
  const expectedPaths = RECORDING_NAMES.flatMap((name) => RECORDING_LOCALES.map((locale) => `/resources/${name}-${locale}.mp3`));
  await expect
    .poll(async () => page.evaluate(async (paths) => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) return 0;
      const cached = new Set();
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) cached.add(new URL(request.url).pathname);
      }
      return paths.filter((path) => cached.has(path)).length;
    }, expectedPaths), { timeout: 20000 })
    .toBe(expectedPaths.length);

  await context.setOffline(true);
  // A recording request that reached the network would be aborted here, so a
  // successful playback proves the service-worker precache answered it.
  await page.route('**/resources/*.mp3', (route) => route.abort());
  await page.reload();
  await expect(page.getByRole('heading', { name: "Be Aware n' Be Around" })).toBeVisible();

  // Playback runs entirely from the precached recording: the browser reports a
  // real playing event and a finite duration with the network switched off.
  await page.locator('.playlist-row-1').click();
  await expect(page.locator('.status')).toHaveText('播放教育步驟 1...', { timeout: 20000 });
  const max = Number(await page.getAttribute('.playlist-seek-range', 'max'));
  expect(Number.isFinite(max)).toBe(true);
  expect(max).toBeGreaterThan(0);
  await expect(page.locator('.playlist-seek .playlist-time').nth(1)).not.toHaveText('0:00');
});
