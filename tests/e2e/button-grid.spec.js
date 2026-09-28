import { expect, test } from '@playwright/test';

// The grid is a static-width anchor (255px) that the button size, gap, and
// font are derived from. These tests pin the shipped geometry (255/100/15/32)
// and assert the derivation: overriding the grid width scales everything.

test.describe('button grid geometry', () => {
  test('preserves the current size and spacing at the static width', async ({ page }) => {
    await page.goto('/');

    const grid = await page.locator('.grid').boundingBox();
    expect(grid.width).toBeCloseTo(255, 1);
    expect(grid.height).toBeCloseTo(255, 1);

    const buttons = page.locator('.btn-toy');
    expect(await buttons.count()).toBe(4);
    for (let i = 0; i < 4; i++) {
      const box = await buttons.nth(i).boundingBox();
      expect(box.width).toBeCloseTo(100, 1);
      expect(box.height).toBeCloseTo(100, 1);
    }

    // Used gaps, derived from positions (the computed `gap` value changes
    // representation when the CSS changes from px to %).
    const stay = await buttons.nth(0).boundingBox();
    const safe = await buttons.nth(1).boundingBox();
    const side = await buttons.nth(2).boundingBox();
    expect(safe.x - stay.x - stay.width).toBeCloseTo(15, 1);
    expect(side.y - stay.y - stay.height).toBeCloseTo(15, 1);

    const fontSize = await page.evaluate(() => getComputedStyle(document.querySelector('.btn-toy')).fontSize);
    expect(parseFloat(fontSize)).toBeCloseTo(32, 1);
  });

  test('scales the buttons, gaps, and font relative to the grid width', async ({ page }) => {
    await page.goto('/');

    // The width override must not be animated: the buttons transition
    // `all` for 0.1s, which would race the measurement.
    await page.evaluate(() => {
      document.querySelectorAll('.btn-toy').forEach((button) => { button.style.transition = 'none'; });
      document.querySelector('.grid').style.width = '300px';
    });

    const grid = await page.locator('.grid').boundingBox();
    expect(grid.width).toBeCloseTo(300, 1);

    // 300px - 40px padding = 260px content; gap 15/215 of content = 18.14px;
    // each 1fr cell = (260 - 18.14) / 2 = 120.94px; font 32/215 of content.
    const stay = await page.locator('.btn-toy').first().boundingBox();
    expect(stay.width).toBeCloseTo(120.94, 1);
    expect(stay.height).toBeCloseTo(120.94, 1);

    const safe = await page.locator('.btn-toy').nth(1).boundingBox();
    expect(safe.x - stay.x - stay.width).toBeCloseTo(18.14, 1);

    const fontSize = await page.evaluate(() => getComputedStyle(document.querySelector('.btn-toy')).fontSize);
    expect(parseFloat(fontSize)).toBeCloseTo(38.7, 1);
  });
});
