import { expect, test } from '@playwright/test';

test('loads sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('TaskForge')).toBeVisible();
  await expect(page.getByPlaceholder('you@example.com')).toBeVisible();
});
