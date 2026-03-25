import { expect, Page } from '@playwright/test';

function makePhone() {
  return `138${Date.now().toString().slice(-8)}`;
}

/**
 * Logs in with a random phone number and ensures a journey exists.
 * After this helper returns, the page is on /journey with a workspace visible.
 */
export async function loginAndEnsureJourney(page: Page, journeyTitle?: string) {
  const phone = makePhone();

  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill(phone);
  await page.getByTestId('send-otp-button').click();

  const otpHint = page.getByTestId('otp-hint');
  await expect(otpHint).toBeVisible({ timeout: 10000 });
  const otpText = await otpHint.textContent();
  const otp = otpText?.match(/(\d{6})/)?.[1];
  expect(otp).toBeTruthy();

  await page.getByTestId('login-otp-input').fill(String(otp));
  await page.getByTestId('verify-otp-button').click();

  // Wait for login API call to complete and redirect
  await page.waitForURL('**/journey', { timeout: 30000 });

  const titleInput = page.getByTestId('journey-title-input');
  const needsJourneyCreation = await titleInput
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (needsJourneyCreation) {
    const title = journeyTitle || `E2E 测试旅程 ${Date.now()}`;
    await titleInput.fill(title);
    await page.getByTestId('start-journey-button').click();
    await expect(titleInput).toBeHidden({ timeout: 20000 });
  }

  // Wait for workspace to be ready
  await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('chat-input')).toBeEnabled({ timeout: 20000 });
}
