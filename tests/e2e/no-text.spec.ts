import type { Locator } from '@playwright/test';
import { expect, skipBrokenLocalWebkit, test } from './support/fixtures';

skipBrokenLocalWebkit();

/** Every visible button is a picture: no rendered text, but a spoken/accessible name. */
async function expectPictureButtons(buttons: Locator): Promise<void> {
  const info = await buttons.evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({
        label: el.getAttribute('aria-label') ?? '',
        text: (el as HTMLElement).innerText.trim(),
        hasPicture: el.querySelector('svg, canvas, img') !== null,
      })),
  );
  expect(info.length).toBeGreaterThan(0);
  for (const b of info) {
    expect(b.text, `button "${b.label}" shows text`).toBe('');
    expect(b.hasPicture, `button "${b.label}" has no picture`).toBe(true);
    expect(b.label, 'button has no accessible name').not.toBe('');
  }
}

test('playing needs no reading: gallery, theme picker and play HUD are pictures only', async ({ app, page }) => {
  await app.open();
  await expectPictureButtons(page.locator('.gallery-screen button:not(.install-banner button)'));
  // The install hint is for grown-ups and only on iOS Safari; it is not needed to play.

  await app.tapElement(page.getByTestId('gallery-new'));
  await expectPictureButtons(page.locator('.theme-overlay button'));
  await app.tapElement(page.getByTestId('theme-meadow'));
  await app.waitForPlay();

  await expectPictureButtons(page.locator('[data-testid="hud"] button'));
  const hudText = await page.getByTestId('hud').evaluate((el) => (el as HTMLElement).innerText.trim());
  expect(hudText).toBe('');
});
