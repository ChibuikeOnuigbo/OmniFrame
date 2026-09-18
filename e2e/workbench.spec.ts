import { test, expect } from '@playwright/test';

test('landing has a separate editor entry and no page overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Edit the moment.')).toBeVisible();
  await expect(page.locator('body')).toHaveCSS('overflow-x', 'hidden');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: /Open OmniFrame/ }).click();
  await expect(page.getByText('Timeline')).toBeVisible();
});

test('editor shortcuts and command palette work', async ({ page }) => {
  await page.goto('/#editor');
  await expect(page.getByText('Omniframe Edit')).toBeVisible();
  await page.keyboard.press('Control+Shift+P');
  await expect(page.getByPlaceholder(/Search commands/)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.press('b');
  await expect(page.getByText('Timeline')).toBeVisible();
});

test('mask and tracking controls are visible', async ({ page }) => {
  await page.goto('/#editor');
  await page.getByRole('button', { name: 'Masking' }).click();
  await expect(page.getByText('Apply range')).toBeVisible();
  await page.getByRole('button', { name: 'Tracking' }).click();
  await expect(page.getByText('Backend')).toBeVisible();
  await expect(page.getByText('SAM2 option')).toBeVisible();
});
