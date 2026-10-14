import { expect, test } from '@playwright/test';
import { mockPlaylistPlayer } from './mock-playlist-player.js';

const languageStates = [
  {
    selector: '繁體',
    action: '守',
    panelHeading: '如何安裝至手機',
    loadingStatus: '載入中…',
    educationStatus: '播放教育步驟 1...',
    closeButtonName: '關閉',
  },
  {
    selector: '简体',
    action: '守',
    panelHeading: '如何安装至手机',
    loadingStatus: '加载中…',
    educationStatus: '播放教育步骤 1...',
    closeButtonName: '关闭',
  },
  {
    selector: 'EN',
    action: 'STAY',
    panelHeading: 'How to Install',
    loadingStatus: 'Loading…',
    educationStatus: 'Playing education step 1...',
    closeButtonName: 'Close',
  },
];

for (const language of languageStates) {
  test(`renders localized education content and status for ${language.selector}`, async ({ page }) => {
    // The deterministic media stand-in keeps the phase assertions reproducible:
    // the playing status arrives when the test reports the media event, not
    // when a fixture recording happens to decode.
    const media = await mockPlaylistPlayer(page);
    await page.goto('/');

    await page.getByRole('button', { name: '語言' }).click();
    await page.getByRole('menuitem', { name: language.selector, exact: true }).click();
    await page.locator('.setup-guide').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: language.panelHeading })).toBeVisible();
    await page.getByRole('button', { name: language.closeButtonName }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await page.getByRole('button', { name: language.action, exact: true }).click();
    await expect(page.locator('.status')).toHaveText(language.loadingStatus);
    await media.fire('playing');
    await expect(page.locator('.status')).toHaveText(language.educationStatus);
  });
}

test('closes the setup dialog on Escape', async ({ page }) => {
  await page.goto('/');

  await page.locator('.setup-guide').click();
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('includes generated PWA assets', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest/);
  await expect(page.getByRole('heading', { name: "Be Aware n' Be Around" })).toBeVisible();
});
