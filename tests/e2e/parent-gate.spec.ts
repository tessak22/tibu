import type { Page } from '@playwright/test';
import { expect, skipBrokenLocalWebkit, test } from './support/fixtures';

skipBrokenLocalWebkit();

const HOLD_MS = 3000;

/** Records whether the corner wiggled (its "no" response to a plain tap). */
async function watchWiggle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const corner = document.querySelector('[data-testid="parent-corner"]');
    const w = window as unknown as { __wiggled: boolean };
    w.__wiggled = false;
    if (!corner) return;
    new MutationObserver(() => {
      if (corner.classList.contains('wiggle')) w.__wiggled = true;
    }).observe(corner, { attributes: true, attributeFilter: ['class'] });
  });
}

test.beforeEach(async ({ app }) => {
  await app.open();
});

test('a plain tap on the grown-up corner does not open anything', async ({ app, page }) => {
  await watchWiggle(page);
  await app.tapElement(page.getByTestId('parent-corner'));

  await expect.poll(() => page.evaluate(() => (window as unknown as { __wiggled: boolean }).__wiggled)).toBe(true);
  // Negative check over the full hold window: nothing may open later either.
  await page.waitForTimeout(HOLD_MS + 500);
  await expect(page.locator('.gate-overlay')).toHaveCount(0);
  await expect(page.getByTestId('parent-area')).toHaveCount(0);
  await expect(page.getByTestId('gallery-new')).toBeVisible();
});

test('a 3 second hold and the right sum open the grown-up area', async ({ app, page }) => {
  const corner = await app.center(page.getByTestId('parent-corner'));
  const startedAt = Date.now();
  const lift = await app.input.press(corner);
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible({ timeout: HOLD_MS + 5000 });
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(HOLD_MS - 100);
  await lift();

  // A sum alone is not enough: the area stays closed until it is answered.
  await expect(page.getByTestId('parent-area')).toHaveCount(0);
  const text = (await question.textContent()) ?? '';
  const match = /(\d+)\s*\+\s*(\d+)/.exec(text);
  expect(match, `sum text: ${text}`).not.toBeNull();
  const answer = String(Number(match![1]) + Number(match![2]));

  const pad = page.locator('.gate-pad');
  for (const digit of answer) await app.tapElement(pad.locator(`[data-key="${digit}"]`));
  await expect(page.getByTestId('gate-display')).toHaveText(answer);
  await app.tapElement(pad.locator('[data-key="ok"]'));

  await expect(page.getByTestId('parent-area')).toBeVisible();
});

test('a wrong sum keeps the grown-up area closed', async ({ app, page }) => {
  const lift = await app.input.press(await app.center(page.getByTestId('parent-corner')));
  const question = page.getByTestId('gate-question');
  await expect(question).toBeVisible({ timeout: HOLD_MS + 5000 });
  await lift();
  const match = /(\d+)\s*\+\s*(\d+)/.exec((await question.textContent()) ?? '');
  const wrong = String(Number(match![1]) + Number(match![2]) + 1);

  const pad = page.locator('.gate-pad');
  for (const digit of wrong) await app.tapElement(pad.locator(`[data-key="${digit}"]`));
  await app.tapElement(pad.locator('[data-key="ok"]'));

  await expect(page.getByTestId('gate-display')).toHaveText(/^\s*$/);
  await expect(page.getByTestId('parent-area')).toHaveCount(0);
});
