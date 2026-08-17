import { expect, test } from '@playwright/test';

/**
 * Records a short walkthrough video of the critical user flow.
 *
 *   BASE_URL=... npx playwright test --project=demo
 *
 * Runs in its own Playwright project so video recording never slows down the
 * release-gating specs. The output .webm is collected by scripts/capture-demo.mjs.
 *
 * Deliberately paced with short holds on each state so the recording is
 * watchable rather than a 400ms blur.
 */

const HOLD = Number(process.env.DEMO_HOLD_MS || 900);

test('route planner walkthrough', async ({ page }) => {
  await page.goto('/');

  // Let the viewer take in the empty state and the health indicator.
  await expect(page.getByRole('heading', { name: 'FleetNet' })).toBeVisible();
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-state', 'ok');
  await page.waitForTimeout(HOLD);

  const origin = page.getByTestId('origin-input');
  await origin.click();
  await origin.selectOption('Denver');
  await page.waitForTimeout(HOLD / 2);

  const destination = page.getByTestId('destination-input');
  await destination.click();
  await destination.selectOption('Salt Lake City');
  await page.waitForTimeout(HOLD / 2);

  await page.getByTestId('vehicle-select').selectOption('semi');
  await page.waitForTimeout(HOLD);

  await page.getByTestId('calculate-button').click();

  await expect(page.getByTestId('route-results')).toBeVisible();
  await expect(page.getByTestId('result-distance')).toHaveText('312 mi');
  await expect(page.getByTestId('result-duration')).toHaveText('6h 29m');

  // Hold on the result so the final frame is the payoff.
  await page.waitForTimeout(HOLD * 2);
});
