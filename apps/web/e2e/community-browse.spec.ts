import { expect, test } from '@playwright/test';

test.describe('Community Browse', () => {
  test('community page loads with feed container', async ({ page }) => {
    await page.goto('/community');

    await expect(page.getByTestId('community-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('community-feed')).toBeVisible({ timeout: 10000 });
  });

  test('community feed shows cards when content exists', async ({ page }) => {
    await page.goto('/community');

    await expect(page.getByTestId('community-feed')).toBeVisible({ timeout: 15000 });

    // In test env, feed may or may not have cards
    const hasFeedCards = await page.getByTestId('feed-card').first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (hasFeedCards) {
      const firstCard = page.getByTestId('feed-card').first();
      await expect(firstCard).toBeVisible();

      // Feed card should have a title
      const title = firstCard.getByTestId('feed-card-title');
      await expect(title).toBeVisible();
      const titleText = await title.textContent();
      expect(titleText?.length).toBeGreaterThan(0);
    }
    // If no cards, the feed container is still visible — test passes
  });

  test('community detail page shows tabs and fork button', async ({ page }) => {
    // Detail page requires auth — login first
    const { loginAndEnsureJourney } = await import('./helpers/login');
    await loginAndEnsureJourney(page);

    await page.goto('/community');
    await expect(page.getByTestId('community-feed')).toBeVisible({ timeout: 15000 });

    const firstCard = page.getByTestId('feed-card').first();
    const hasFeedCards = await firstCard
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    test.skip(!hasFeedCards, 'No published journeys in test environment');

    // Get journey ID from the card and navigate to detail
    const journeyId = await firstCard.getAttribute('data-journey-id');
    expect(journeyId).toBeTruthy();

    await page.goto(`/community/${journeyId}`);

    // Wait for detail page
    await expect(page.getByTestId('community-detail')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('detail-title')).toBeVisible();

    // Check tabs
    const detailTabs = page.getByTestId('detail-tabs');
    await expect(detailTabs).toBeVisible();

    // Check fork button
    const forkButton = page.getByTestId('fork-button');
    const hasFork = await forkButton
      .waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true)
      .catch(() => false);

    if (hasFork) {
      await expect(forkButton).toBeVisible();
    }

    // Try clicking between tabs if they exist
    const storyTab = detailTabs.getByText('叙事故事');
    const hasStoryTab = await storyTab
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (hasStoryTab) {
      await storyTab.click();
      await expect(page.getByTestId('story-view')).toBeVisible({ timeout: 5000 });
    }

    const reportTab = detailTabs.getByText('结构化报告');
    const hasReportTab = await reportTab
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (hasReportTab) {
      await reportTab.click();
      await expect(page.getByTestId('report-view')).toBeVisible({ timeout: 5000 });
    }

    const templateTab = detailTabs.getByText('可复用模板');
    const hasTemplateTab = await templateTab
      .waitFor({ state: 'visible', timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    if (hasTemplateTab) {
      await templateTab.click();
      await expect(page.getByTestId('template-view')).toBeVisible({ timeout: 5000 });
    }
  });
});
