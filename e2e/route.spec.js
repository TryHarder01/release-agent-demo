import { expect, test } from '@playwright/test';

/**
 * The critical release flow. If this fails, the candidate does not ship.
 *
 * Uses the seeded Denver -> Salt Lake City lane so the expected numbers are
 * exact rather than approximate.
 */
test('@critical calculates and displays a route', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'FleetNet' })).toBeVisible();

  await page.getByTestId('origin-input').fill('Denver');
  await page.getByTestId('destination-input').fill('Salt Lake City');
  await page.getByTestId('vehicle-select').selectOption('van');
  await page.getByTestId('calculate-button').click();

  const results = page.getByTestId('route-results');
  await expect(results).toBeVisible();

  // 312 mi / 338 min on a van -> "5h 38m".
  await expect(page.getByTestId('result-distance')).toHaveText('312 mi');
  await expect(page.getByTestId('result-duration')).toHaveText('5h 38m');
  await expect(page.getByTestId('result-status')).toHaveText('Optimized');

  // A schema regression surfaces here rather than as a blank field.
  await expect(page.getByTestId('route-error')).toHaveCount(0);
});

test('@critical reflects vehicle type in the estimate', async ({ page }) => {
  await page.goto('/');

  await page.getByTestId('origin-input').fill('Denver');
  await page.getByTestId('destination-input').fill('Salt Lake City');
  await page.getByTestId('vehicle-select').selectOption('semi');
  await page.getByTestId('calculate-button').click();

  await expect(page.getByTestId('route-results')).toBeVisible();
  await expect(page.getByTestId('result-distance')).toHaveText('312 mi');
  // 338 * 1.15 = 389 min -> "6h 29m".
  await expect(page.getByTestId('result-duration')).toHaveText('6h 29m');
});

test('system status reports healthy', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('system-status')).toHaveAttribute('data-state', 'ok');
});

test('surfaces a validation error instead of empty results', async ({ page }) => {
  await page.goto('/');

  // Bypass the browser's required-field check to exercise the API error path.
  const response = await page.request.post('/api/route', { data: { origin: 'Denver' } });
  expect(response.status()).toBe(400);
});
