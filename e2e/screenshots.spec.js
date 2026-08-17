import { expect, test } from '@playwright/test';

/**
 * Visual evidence for the release report / PR comment.
 *
 * Tagged @screenshot so it can be run on its own:
 *   BASE_URL=... npx playwright test --grep @screenshot
 *
 * These assert as well as capture — a screenshot of a broken page is not
 * evidence that the candidate is healthy.
 */

const SHOT_DIR = 'media';

test.use({ viewport: { width: 1280, height: 800 } });

test('@screenshot captures the route planner states', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-state', 'ok');

  await page.screenshot({ path: `${SHOT_DIR}/01-empty-state.png`, fullPage: true });

  await page.getByTestId('origin-input').fill('Denver');
  await page.getByTestId('destination-input').fill('Salt Lake City');
  await page.getByTestId('vehicle-select').selectOption('van');
  await page.screenshot({ path: `${SHOT_DIR}/02-form-filled.png`, fullPage: true });

  await page.getByTestId('calculate-button').click();
  await expect(page.getByTestId('route-results')).toBeVisible();

  // The money shot: the calculated route as a user sees it.
  await page.screenshot({ path: `${SHOT_DIR}/03-route-results.png`, fullPage: true });

  // Tight crop of just the results card, useful for embedding in a PR comment.
  await page.getByTestId('route-results').screenshot({ path: `${SHOT_DIR}/04-results-card.png` });

  await testInfo.attach('route-results', {
    path: `${SHOT_DIR}/03-route-results.png`,
    contentType: 'image/png',
  });
});

test('@screenshot captures the mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await page.getByTestId('origin-input').fill('Dallas');
  await page.getByTestId('destination-input').fill('Houston');
  await page.getByTestId('calculate-button').click();
  await expect(page.getByTestId('route-results')).toBeVisible();

  await page.screenshot({ path: `${SHOT_DIR}/05-mobile-results.png`, fullPage: true });
});
