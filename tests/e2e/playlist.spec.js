import { expect, test } from '@playwright/test';
import { mockCounterRoute } from './mock-counter.js';
import { mockPlaylistPlayer } from './mock-playlist-player.js';

// Browser coverage for the shared first-aid playlist. Two families live here:
//
//   1. Deterministic playback tests driven by tests/e2e/mock-playlist-player.js
//      (explicit media events, so phase transitions are reproducible).
//   2. Real-recording tests that keep the browser's own HTMLAudioElement and
//      prove decoding, finite duration, seeking, natural end, and single-player
//      switching against the shipped recordings.
//
// Every assertion goes through the rendered UI and the mocked counter wire
// contract; the hook is never called directly.

const LOCALES = [
  {
    selector: '繁體',
    code: 'zh-HK',
    default: '教育模式：請點擊按鍵聆聽指示。',
    loading: '載入中…',
    paused: '教育播放已暫停。',
    ended: '教育步驟已完成。',
    error: '播放失敗，請按播放重試。',
    playing: (id) => `播放教育步驟 ${id}...`,
    play: '播放',
    pause: '暫停',
    previous: '上一段',
    next: '下一段',
    settings: '播放設定',
    repeatOff: '不重複',
    repeatAll: '全部重複',
    repeatOne: '單曲重複',
    mute: '靜音',
    unmute: '取消靜音',
  },
  {
    selector: '简体',
    code: 'zh-CN',
    default: '教育模式：请点击按键聆听指示。',
    loading: '加载中…',
    paused: '教育播放已暂停。',
    ended: '教育步骤已完成。',
    error: '播放失败，请按播放重试。',
    playing: (id) => `播放教育步骤 ${id}...`,
    play: '播放',
    pause: '暂停',
    previous: '上一段',
    next: '下一段',
    settings: '播放设置',
    repeatOff: '不重复',
    repeatAll: '全部重复',
    repeatOne: '单曲重复',
    mute: '静音',
    unmute: '取消静音',
  },
  {
    selector: 'EN',
    code: 'en',
    default: 'Education Mode: Click buttons for instructions.',
    loading: 'Loading…',
    paused: 'Education playback paused.',
    ended: 'Education step finished.',
    error: 'Playback failed. Press play to try again.',
    playing: (id) => `Playing education step ${id}...`,
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous',
    next: 'Next',
    settings: 'Settings',
    repeatOff: 'Repeat off',
    repeatAll: 'Repeat all',
    repeatOne: 'Repeat one',
    mute: 'Mute',
    unmute: 'Unmute',
  },
];

const HK = LOCALES[0];

/**
 * Loads the app with the deterministic media stand-in and the counter stub.
 * Returns the media handle plus the counter mock so tests assert the wire
 * contract (numeric-string action_target, one POST per counted click).
 */
async function openApp(page, { initialTotal = 12544 } = {}) {
  const media = await mockPlaylistPlayer(page);
  const counter = mockCounterRoute(page, { initialTotal });
  await page.goto('/');
  await expect(page.locator('.playlist-card')).toBeVisible();
  const clickPosts = () => counter.requests.filter((request) => request.method === 'POST' && request.body?.action === 'click');
  return { media, counter, clickPosts };
}

async function selectLocale(page, locale) {
  await page.getByRole('button', { name: '語言' }).click();
  await page.getByRole('menuitem', { name: locale.selector, exact: true }).click();
}

async function openSettings(page, locale) {
  const toggle = page.getByRole('button', { name: locale.settings, exact: true });
  // Idempotent: the panel stays open after a settings choice, so only click
  // the toggle when it is actually closed.
  if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  await expect(page.locator('#playlist-settings-panel')).toBeVisible();
}

async function setRepeat(page, locale, mode) {
  const labels = { off: locale.repeatOff, all: locale.repeatAll, one: locale.repeatOne };
  await openSettings(page, locale);
  await page.getByRole('button', { name: labels[mode], exact: true }).click();
  await expect(page.getByRole('button', { name: labels[mode], exact: true })).toHaveAttribute('aria-pressed', 'true');
}

const status = (page) => page.locator('.status');
const playButton = (page, locale) => page.getByRole('button', { name: locale.play, exact: true });
const pauseButton = (page, locale) => page.getByRole('button', { name: locale.pause, exact: true });
const row = (page, id) => page.locator(`.playlist-row-${id}`);
const upperButton = (page, id) => page.locator(`.btn-toy.button-${id}`);

test.describe('deterministic playback', () => {
  test('fresh load shows the idle defaults and creates no audio element', async ({ page }) => {
    const { media } = await openApp(page);

    await expect(status(page)).toHaveText(HK.default);
    await expect(row(page, 1)).toHaveAttribute('aria-pressed', 'false');
    await expect(row(page, 4)).toHaveAttribute('aria-pressed', 'false');
    await expect(playButton(page, HK)).toBeVisible();
    await expect(page.getByRole('button', { name: HK.previous, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: HK.next, exact: true })).toBeDisabled();
    await expect(page.locator('.playlist-seek-range')).toBeDisabled();
    await expect(page.locator('.playlist-seek .playlist-time')).toHaveText(['0:00', '0:00']);
    await expect(page.locator('.playlist-playing-badge')).toHaveCount(0);

    await openSettings(page, HK);
    await expect(page.getByRole('button', { name: HK.repeatOff, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: '速度 1×', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await expect(page.locator('.playlist-volume-range')).toHaveValue('1');
    await expect(page.getByRole('button', { name: HK.mute, exact: true })).toHaveAttribute('aria-pressed', 'false');
    expect(await media.elementCount()).toBe(0);
  });

  test('a row click counts once and drives loading, then playing on explicit media events', async ({ page }) => {
    const { media, clickPosts } = await openApp(page);

    await row(page, 2).click();

    // Loading phase: the counted request is on the wire, but nothing is
    // highlighted as playing until the browser reports it.
    await expect(status(page)).toHaveText(HK.loading);
    await expect(upperButton(page, 2)).not.toHaveClass(/playing/);
    await expect(row(page, 2).locator('.playlist-playing-badge')).toHaveCount(0);
    await expect(row(page, 2)).toHaveAttribute('aria-pressed', 'true');
    expect(clickPosts().map((request) => request.body.action_target)).toEqual(['2']);

    const loadingState = await media.state();
    expect(loadingState.src).toBe(new URL('/resources/save-zh-HK.mp3', page.url()).href);
    expect(loadingState.playCount).toBe(1);

    await media.fire('playing');

    await expect(status(page)).toHaveText(HK.playing(2));
    await expect(upperButton(page, 2)).toHaveClass(/playing/);
    await expect(row(page, 2).locator('.playlist-playing-badge')).toHaveCount(1);
    await expect(row(page, 1)).toHaveAttribute('aria-pressed', 'false');
    expect(clickPosts().length).toBe(1);
  });

  test('an upper action button drives the same shared player', async ({ page }) => {
    const { media, clickPosts } = await openApp(page);

    await upperButton(page, 4).click();
    await expect(status(page)).toHaveText(HK.loading);
    expect((await media.state()).src).toBe(new URL('/resources/help-zh-HK.mp3', page.url()).href);

    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(4));
    await expect(row(page, 4)).toHaveAttribute('aria-pressed', 'true');
    expect(clickPosts().map((request) => request.body.action_target)).toEqual(['4']);
  });

  test('play with no selection starts track 1 without counting a click', async ({ page }) => {
    const { media, clickPosts } = await openApp(page);

    await playButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.loading);
    const state = await media.state();
    expect(state.src).toBe(new URL('/resources/stay-zh-HK.mp3', page.url()).href);
    expect(state.playCount).toBe(1);
    expect(clickPosts()).toHaveLength(0);

    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));
    expect(clickPosts()).toHaveLength(0);
  });

  test('pause and resume round-trip through the paused phase', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 1).click();
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));

    await pauseButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.paused);
    await expect(playButton(page, HK)).toBeVisible();
    await expect(upperButton(page, 1)).not.toHaveClass(/playing/);
    expect((await media.state()).paused).toBe(true);

    await playButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.loading);
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));
    expect((await media.state()).playCount).toBe(2);
  });

  test('clicking the selected row again restarts it from zero', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 3).click();
    await media.fire('playing');
    await media.setDuration(40);
    await media.setTime(25);
    await expect(page.locator('.playlist-seek .playlist-time').first()).toHaveText('0:25');

    await row(page, 3).click();
    await expect(status(page)).toHaveText(HK.loading);
    const state = await media.state();
    expect(state.currentTime).toBe(0);
    expect(state.playCount).toBe(2);
    await expect(page.locator('.playlist-seek .playlist-time').first()).toHaveText('0:00');
  });

  test('repeat all advances 4 to 1 without a counted click', async ({ page }) => {
    const { media, clickPosts } = await openApp(page);

    await row(page, 4).click();
    await media.fire('playing');
    await setRepeat(page, HK, 'all');

    await media.fire('ended');
    await expect(status(page)).toHaveText(HK.loading);
    const advanced = await media.state();
    expect(advanced.src).toBe(new URL('/resources/stay-zh-HK.mp3', page.url()).href);
    expect(advanced.playCount).toBe(2);

    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));
    await expect(row(page, 1)).toHaveAttribute('aria-pressed', 'true');
    await expect(row(page, 4)).toHaveAttribute('aria-pressed', 'false');
    expect(clickPosts().map((request) => request.body.action_target)).toEqual(['4']);
  });

  test('repeat one replays the same track from zero', async ({ page }) => {
    const { media, clickPosts } = await openApp(page);

    await row(page, 2).click();
    await media.fire('playing');
    await media.setDuration(30);
    await media.setTime(28);
    await setRepeat(page, HK, 'one');

    await media.fire('ended');
    await expect(status(page)).toHaveText(HK.loading);
    const replayed = await media.state();
    expect(replayed.src).toBe(new URL('/resources/save-zh-HK.mp3', page.url()).href);
    expect(replayed.currentTime).toBe(0);
    expect(replayed.playCount).toBe(2);

    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(2));
    expect(clickPosts()).toHaveLength(1);
  });

  test('repeat off ends without loading a next track', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 3).click();
    await media.fire('playing');
    await media.setDuration(20);
    await media.setTime(20);

    await media.fire('ended');
    await expect(status(page)).toHaveText(HK.ended);
    await expect(playButton(page, HK)).toBeVisible();
    const ended = await media.state();
    expect(ended.src).toBe(new URL('/resources/side-zh-HK.mp3', page.url()).href);
    expect(ended.playCount).toBe(1);
    expect(await media.elementCount()).toBe(1);
    await expect(row(page, 3).locator('.playlist-playing-badge')).toHaveCount(0);

    // The finished track can be started again from zero.
    await playButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.loading);
    expect((await media.state()).playCount).toBe(2);
  });

  test('manual previous and next never wrap, in playing or paused state', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 1).click();
    await media.fire('playing');
    await expect(page.getByRole('button', { name: HK.previous, exact: true })).toBeDisabled();

    await page.getByRole('button', { name: HK.next, exact: true }).click();
    await expect(status(page)).toHaveText(HK.loading);
    expect((await media.state()).src).toBe(new URL('/resources/save-zh-HK.mp3', page.url()).href);
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(2));

    // Paused navigation loads the neighbour without starting playback.
    await pauseButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.paused);
    const playsBeforePausedNav = (await media.state()).playCount;
    await page.getByRole('button', { name: HK.next, exact: true }).click();
    await expect(status(page)).toHaveText(HK.paused);
    const pausedState = await media.state();
    expect(pausedState.src).toBe(new URL('/resources/side-zh-HK.mp3', page.url()).href);
    expect(pausedState.paused).toBe(true);
    expect(pausedState.playCount).toBe(playsBeforePausedNav);
    await expect(row(page, 3)).toHaveAttribute('aria-pressed', 'true');

    await playButton(page, HK).click();
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(3));

    await row(page, 4).click();
    await media.fire('playing');
    await expect(page.getByRole('button', { name: HK.next, exact: true })).toBeDisabled();
  });

  test('transport and settings commands never count a click', async ({ page }) => {
    const { media, clickPosts } = await openApp(page);

    await row(page, 2).click();
    await media.fire('playing');
    await media.setDuration(30);

    await pauseButton(page, HK).click();
    await playButton(page, HK).click();
    await media.fire('playing');
    await page.getByRole('button', { name: HK.next, exact: true }).click();
    await media.fire('playing');
    await page.getByRole('button', { name: HK.previous, exact: true }).click();
    await media.fire('playing');
    await setRepeat(page, HK, 'all');
    await openSettings(page, HK);
    await page.getByRole('button', { name: '速度 1.5×', exact: true }).click();
    // Close the panel first: at 375px it overlays the wrapped control row.
    await page.keyboard.press('Escape');
    await expect(page.locator('#playlist-settings-panel')).toHaveCount(0);
    await media.setDuration(30);
    await page.locator('.playlist-seek-range').fill('12');
    await page.getByRole('button', { name: HK.mute, exact: true }).click();
    await page.locator('.playlist-volume-range').fill('0.5');

    expect(clickPosts().map((request) => request.body.action_target)).toEqual(['2']);
    expect(await media.elementCount()).toBe(1);
    const state = await media.state();
    expect(state.playbackRate).toBe(1.5);
    expect(state.volume).toBe(0.5);
    expect(state.muted).toBe(true);
  });

  test('a language change resets playback but keeps selection and settings', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 2).click();
    await media.fire('playing');
    await media.setDuration(30);
    await media.setTime(10);
    await setRepeat(page, HK, 'all');
    await openSettings(page, HK);
    await page.getByRole('button', { name: '速度 1.5×', exact: true }).click();

    const zhCN = LOCALES[1];
    await selectLocale(page, zhCN);

    await expect(status(page)).toHaveText(zhCN.default);
    await expect(row(page, 2)).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.playlist-seek .playlist-time')).toHaveText(['0:00', '0:00']);
    await expect(page.locator('.playlist-seek-range')).toBeDisabled();

    await setRepeat(page, zhCN, 'all');
    await openSettings(page, zhCN);
    await expect(page.getByRole('button', { name: '速度 1.5×', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#playlist-settings-panel')).toHaveCount(0);

    await playButton(page, zhCN).click();
    await expect(status(page)).toHaveText(zhCN.loading);
    expect((await media.state()).src).toBe(new URL('/resources/save-zh-CN.mp3', page.url()).href);
  });

  test('a media error shows the translated failure and a retry recovers', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 1).click();
    await media.fire('playing');
    await media.fire('error');

    await expect(status(page)).toHaveText(HK.error);
    await expect(page.locator('.playlist-status')).toHaveText(HK.error);
    await expect(upperButton(page, 1)).not.toHaveClass(/playing/);
    await expect(row(page, 1).locator('.playlist-playing-badge')).toHaveCount(0);
    await expect(playButton(page, HK)).toBeVisible();

    await playButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.loading);
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));
  });

  test('a rejected play request also surfaces the retryable error state', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 1).click();
    await expect(status(page)).toHaveText(HK.loading);
    await media.rejectPlay();
    await expect(status(page)).toHaveText(HK.error);

    await playButton(page, HK).click();
    await expect(status(page)).toHaveText(HK.loading);
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));
  });

  test('seeking stays disabled until a finite duration exists and clamps to the track', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 1).click();
    await media.fire('playing');
    await expect(page.locator('.playlist-seek-range')).toBeDisabled();
    await expect(page.locator('.playlist-seek .playlist-time').nth(1)).toHaveText('0:00');

    await media.setDuration(30);
    await expect(page.locator('.playlist-seek-range')).toBeEnabled();
    expect(Number(await page.locator('.playlist-seek-range').getAttribute('max'))).toBe(30);

    await media.setTime(12);
    await expect(page.locator('.playlist-seek .playlist-time').first()).toHaveText('0:12');
    await expect(page.locator('.playlist-seek-range')).toHaveValue('12');

    await page.locator('.playlist-seek-range').fill('30');
    expect((await media.state()).currentTime).toBe(30);
    await expect(page.locator('.playlist-seek .playlist-time').first()).toHaveText('0:30');

    // The slider itself cannot exceed max, so drive an out-of-range value the
    // way a hostile input would arrive and assert the player clamps it.
    await page.evaluate(() => {
      const input = document.querySelector('.playlist-seek-range');
      const valueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      valueSetter.call(input, '45');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect((await media.state()).currentTime).toBe(30);
    await expect(page.locator('.playlist-seek .playlist-time').first()).toHaveText('0:30');
  });

  test('the card status line is a visual echo, never a second live region', async ({ page }) => {
    const { media } = await openApp(page);

    await row(page, 1).click();
    await expect(page.locator('.playlist-status')).toHaveText(HK.loading);
    await expect(page.locator('.playlist-status')).not.toHaveAttribute('role');
    await expect(page.locator('.playlist-status')).not.toHaveAttribute('aria-live');
    await expect(status(page)).toHaveAttribute('aria-live', 'polite');
    await media.fire('playing');
    await expect(status(page)).toHaveText(HK.playing(1));
  });
});

test.describe('responsive and keyboard access', () => {
  const viewports = [
    { label: '320px', viewport: { width: 320, height: 720 } },
    { label: '375px', viewport: { width: 375, height: 1200 } },
    { label: 'desktop', viewport: { width: 1280, height: 900 } },
  ];

  for (const { label, viewport } of viewports) {
    test.describe(`at ${label}`, () => {
      test.use({ viewport });

      for (const locale of LOCALES) {
        test(`keeps the ${locale.selector} card usable and keyboard operable`, async ({ page }) => {
          const { media, clickPosts } = await openApp(page);
          await selectLocale(page, locale);

          const cardBox = await page.locator('.playlist-card').boundingBox();
          expect(cardBox.width).toBeLessThanOrEqual(viewport.width);
          expect(cardBox.x).toBeGreaterThanOrEqual(0);

          // Tiles stay 64px squares and every instruction stays readable.
          for (let id = 1; id <= 4; id++) {
            const tileBox = await row(page, id).locator('.playlist-tile').boundingBox();
            expect(tileBox.width).toBeCloseTo(64, 1);
            expect(tileBox.height).toBeCloseTo(64, 1);
            await expect(row(page, id).locator('.playlist-instruction')).toBeVisible();
            await expect(row(page, id).locator('.playlist-instruction')).not.toHaveText('');
          }

          // Nothing spills horizontally, and controls stay inside the card.
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
          expect(overflow).toBeLessThanOrEqual(1);
          for (const selector of ['.playlist-transport .playlist-btn', '.playlist-seek-range', '.playlist-volume-range', '.playlist-settings > .playlist-btn']) {
            const box = await page.locator(selector).first().boundingBox();
            expect(box.x).toBeGreaterThanOrEqual(cardBox.x - 1);
            expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
          }

          await openSettings(page, locale);
          const panelBox = await page.locator('#playlist-settings-panel').boundingBox();
          expect(panelBox.x).toBeGreaterThanOrEqual(0);
          expect(panelBox.x + panelBox.width).toBeLessThanOrEqual(viewport.width + 1);
          await page.keyboard.press('Escape');
          await expect(page.locator('#playlist-settings-panel')).toHaveCount(0);

          // Keyboard: Tab reaches a row, Enter selects (and counts) it.
          let reachedRow = false;
          for (let i = 0; i < 25 && !reachedRow; i++) {
            await page.keyboard.press('Tab');
            reachedRow = await page.evaluate(() => document.activeElement?.classList.contains('playlist-row') ?? false);
          }
          expect(reachedRow).toBe(true);
          await page.keyboard.press('Enter');
          await expect(status(page)).toHaveText(locale.loading);
          expect(clickPosts().map((request) => request.body.action_target)).toEqual(['1']);

          await media.fire('playing');
          await expect(status(page)).toHaveText(locale.playing(1));

          // Keyboard: Space on the transport toggles playback without counting.
          await page.locator('.playlist-btn-play').focus();
          await page.keyboard.press('Space');
          await expect(status(page)).toHaveText(locale.paused);
          expect(clickPosts()).toHaveLength(1);
        });
      }
    });
  }
});

test.describe('real recordings in the browser', () => {
  // No media stand-in here: the shipped recordings are decoded by Chromium and
  // the player reacts to the browser's own media events.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const RealAudio = window.Audio;
      window.__createdAudio = [];
      window.Audio = function Audio(...args) {
        const element = new RealAudio(...args);
        window.__createdAudio.push(element);
        return element;
      };
    });
    mockCounterRoute(page, { initialTotal: 12544 });
    await page.goto('/');
    await expect(page.locator('.playlist-card')).toBeVisible();
  });

  test('a real recording reports a finite duration, seeks, and ends on its own', async ({ page }) => {
    await row(page, 1).click();
    await expect(status(page)).toHaveText(HK.playing(1));

    const max = Number(await page.locator('.playlist-seek-range').getAttribute('max'));
    expect(Number.isFinite(max)).toBe(true);
    expect(max).toBeGreaterThan(0);
    await expect(page.locator('.playlist-seek .playlist-time').nth(1)).not.toHaveText('0:00');

    await page.locator('.playlist-seek-range').fill(String(max / 2));
    await expect(page.locator('.playlist-seek .playlist-time').first()).not.toHaveText('0:00');
    expect(await page.evaluate(() => window.__createdAudio[0].currentTime)).toBeGreaterThan(0);

    // Seek close to the end so the natural end event arrives quickly.
    await page.locator('.playlist-seek-range').fill(String(max - 0.2));
    await expect(status(page)).toHaveText(HK.ended, { timeout: 15000 });
    await expect(page.locator('.playlist-playing-badge')).toHaveCount(0);
  });

  test('switching tracks mid-playback restarts the single shared element', async ({ page }) => {
    await row(page, 1).click();
    await expect(status(page)).toHaveText(HK.playing(1));
    await expect(row(page, 1).locator('.playlist-playing-badge')).toHaveCount(1);

    await row(page, 3).click();
    await expect(status(page)).toHaveText(HK.playing(3));

    const elements = await page.evaluate(() => window.__createdAudio.map((element) => ({
      currentSrc: element.currentSrc,
      paused: element.paused,
      currentTime: element.currentTime,
    })));
    expect(elements).toHaveLength(1);
    expect(elements[0].currentSrc).toMatch(/\/resources\/side-zh-HK\.mp3$/);
    expect(elements[0].paused).toBe(false);
    expect(elements[0].currentTime).toBeLessThan(1);
    await expect(page.locator('.playlist-playing-badge')).toHaveCount(1);
    await expect(row(page, 1).locator('.playlist-playing-badge')).toHaveCount(0);
  });
});
