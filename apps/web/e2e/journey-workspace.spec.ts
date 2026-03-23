import { expect, test } from '@playwright/test';

function makePhone() {
  return `138${Date.now().toString().slice(-8)}`;
}

test('user can log in, create a journey, and add a candidate from chat', async ({ page }) => {
  const phone = makePhone();

  await page.goto('/login');
  await page.getByTestId('login-phone-input').fill(phone);
  await page.getByTestId('send-otp-button').click();

  const otpHint = page.getByTestId('otp-hint');
  await expect(otpHint).toBeVisible();
  const otpText = await otpHint.textContent();
  const otp = otpText?.match(/(\d{6})/)?.[1];
  expect(otp).toBeTruthy();

  await page.getByTestId('login-otp-input').fill(String(otp));
  await page.getByTestId('verify-otp-button').click();

  await page.waitForURL('**/journey');

  const titleInput = page.getByTestId('journey-title-input');
  const needsJourneyCreation = await titleInput
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (needsJourneyCreation) {
    await titleInput.fill(`E2E 家用增程 SUV ${Date.now()}`);
    await page.getByTestId('start-journey-button').click();
    await expect(titleInput).toBeHidden({ timeout: 20000 });
  }

  await expect(page.getByRole('heading', { name: '旅程工作台' })).toBeVisible();
  await expect(page.getByTestId('chat-panel')).toBeVisible();
  await expect(page.getByTestId('chat-input')).toBeEnabled({ timeout: 20000 });

  await page.getByTestId('chat-input').fill('我预算25万以内，家用为主，想要增程SUV，先推荐3款，再把理想L6加入候选。');
  await page.getByTestId('chat-send').click();

  await expect(page.getByText(/已按你的需求更新旅程画像/)).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('stage-comparison')).toHaveAttribute('data-active', 'true', { timeout: 20000 });
  await expect(page.getByTestId('candidate-list')).toContainText('理想 L6', { timeout: 20000 });
});
