import { expect, test } from '@playwright/test';

const languageStates = [
  {
    selector: '繁體',
    action: '守',
    shortLabel: '教育模式',
    panelHeading: '如何安裝至手機',
    educationStatus: '播放教育步驟 1...',
    closeButtonName: '關閉',
  },
  {
    selector: '简体',
    action: '守',
    shortLabel: '教育模式',
    panelHeading: '如何安装至手机',
    educationStatus: '播放教育步骤 1...',
    closeButtonName: '关闭',
  },
  {
    selector: 'EN',
    action: 'STAY',
    shortLabel: 'Education Mode',
    panelHeading: 'How to Install',
    educationStatus: 'Playing education step 1...',
    closeButtonName: 'Close',
  },
];

for (const language of languageStates) {
  test(`renders localized education content and status for ${language.selector}`, async ({ page }) => {
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

    await page.getByRole('button', { name: language.selector, exact: true }).click();
    await expect(page.locator('#modeSelect')).toContainText(language.shortLabel);
    await page.locator('.setup-guide').click();
    await expect(page.locator('dialog[open]')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: language.panelHeading })).toBeVisible();
    await page.getByRole('button', { name: language.closeButtonName }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await page.getByRole('button', { name: language.action, exact: true }).click();
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

test('switches language and opens the toy controls', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('button', { name: 'STAY' })).toBeVisible();

  await page.locator('#modeSelect').selectOption('toy');
  await expect(page.getByRole('button', { name: 'Record Mode: OFF' })).toBeVisible();
});

test('includes generated PWA assets', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', /manifest/);
  await expect(page.getByRole('heading', { name: "Be Aware n' Be Around" })).toBeVisible();
});
