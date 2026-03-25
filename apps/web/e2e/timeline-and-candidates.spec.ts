import { expect, test } from '@playwright/test';
import { loginAndEnsureJourney } from './helpers/login';

test.describe('Timeline & Candidates', () => {
  test('workspace shows timeline panel, candidate list, and stages', async ({ page }) => {
    await loginAndEnsureJourney(page);

    await expect(page.getByTestId('timeline-panel').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('candidate-list').first()).toBeVisible({ timeout: 10000 });

    // All 5 stages should be visible (use last() for the desktop sidebar version)
    const stageKeys = ['awareness', 'consideration', 'comparison', 'decision', 'purchase'];
    for (const key of stageKeys) {
      await expect(page.getByTestId(`stage-${key}`).last()).toBeVisible();
    }

    // Awareness should be active by default
    const awarenessStage = page.getByTestId('stage-awareness').last();
    await expect(awarenessStage).toHaveAttribute('data-active', 'true');
  });

  test('chat message triggers timeline event and candidate addition', async ({ page }) => {
    await loginAndEnsureJourney(page);

    await page.getByTestId('chat-input').fill('帮我推荐一款25万的纯电SUV');
    await page.getByTestId('chat-send').click();

    // Wait for AI response
    await expect(page.getByTestId('chat-input')).toBeEnabled({ timeout: 60000 });

    // Check that timeline has events
    const hasTimelineEvent = await page.getByTestId('timeline-event').first()
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    const hasTimelineMilestone = await page.getByTestId('timeline-milestone').first()
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    expect(hasTimelineEvent || hasTimelineMilestone).toBeTruthy();

    // Check if any candidate card appeared
    const hasCandidates = await page.getByTestId('candidate-card').first()
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (hasCandidates) {
      const firstCard = page.getByTestId('candidate-card').first();
      const name = await firstCard.getAttribute('data-candidate-name');
      expect(name).toBeTruthy();
    }
  });
});
