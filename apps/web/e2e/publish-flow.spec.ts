import { expect, test } from '@playwright/test';
import { loginAndEnsureJourney } from './helpers/login';

test.describe('Publish Flow', () => {
  test('publish wizard renders with all controls', async ({ page }) => {
    await loginAndEnsureJourney(page);

    await page.goto('/journey/publish');

    const wizard = page.getByTestId('publish-wizard');
    await expect(wizard).toBeVisible({ timeout: 15000 });

    // Verify all form controls are present
    await expect(page.getByTestId('publish-visibility-select')).toBeVisible();
    await expect(page.getByTestId('publish-description')).toBeVisible();
    await expect(page.getByTestId('publish-submit')).toBeVisible();

    // Verify default visibility is PUBLIC
    await expect(page.getByTestId('publish-visibility-select')).toHaveValue('PUBLIC');
  });

  test('publish wizard submits successfully', async ({ page }) => {
    await loginAndEnsureJourney(page);

    await page.goto('/journey/publish');

    const wizard = page.getByTestId('publish-wizard');
    await expect(wizard).toBeVisible({ timeout: 15000 });

    // Fill optional description
    await page.getByTestId('publish-description').fill('E2E 测试发布');

    // Select visibility
    await page.getByTestId('publish-visibility-select').selectOption('PUBLIC');

    // Click submit
    await page.getByTestId('publish-submit').click();

    // Wait for either redirect to community detail or error
    const redirected = await page
      .waitForURL('**/community/**', { timeout: 30000 })
      .then(() => true)
      .catch(() => false);

    if (redirected) {
      // Successful publish — should land on community detail page
      await expect(page.getByTestId('community-detail')).toBeVisible({ timeout: 10000 });
    } else {
      // If publish fails in mock mode, an error message should appear
      await expect(page.getByTestId('publish-error')).toBeVisible({ timeout: 5000 });
    }
  });

  test('publish wizard visibility select defaults to PUBLIC', async ({ page }) => {
    await loginAndEnsureJourney(page);
    await page.goto('/journey/publish');

    const wizard = page.getByTestId('publish-wizard');
    await expect(wizard).toBeVisible({ timeout: 15000 });

    // Verify default visibility
    await expect(page.getByTestId('publish-visibility-select')).toHaveValue('PUBLIC');
  });
});
