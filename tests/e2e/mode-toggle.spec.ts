import type { Locator, Page } from '@playwright/test';
import { expect, skipBrokenLocalWebkit, test } from './support/fixtures';

skipBrokenLocalWebkit();

// Makes one big adventure world, which renders slowly with software WebGL.
test.describe.configure({ timeout: 240_000 });

const tiles = (page: Page): Locator => page.getByTestId('gallery-item');

async function backToGallery(app: { tapElement(l: Locator): Promise<void>; waitForGallery(): Promise<void> }, page: Page) {
  await app.tapElement(page.getByTestId('back'));
  await app.waitForGallery();
}

test('the Little / Big toggle sits clear of the grown-up corner with big picture targets', async ({ app, page }) => {
  await app.open();
  const corner = await page.getByTestId('parent-corner').boundingBox();
  for (const mode of ['little', 'big'] as const) {
    const box = await page.getByTestId(`mode-toggle-${mode}`).boundingBox();
    if (!box || !corner) throw new Error('no box');
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(64);
    const overlaps =
      box.x < corner.x + corner.width && corner.x < box.x + box.width &&
      box.y < corner.y + corner.height && corner.y < box.y + box.height;
    expect(overlaps, `${mode} overlaps the grown-up corner`).toBe(false);
  }
  await expect(page.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'little');
});

test('Big "+" shows each theme once, as adventures only', async ({ app, page }) => {
  await app.open();
  await app.setPlayerMode('big');
  await app.tapElement(page.getByTestId('gallery-new'));
  const overlay = page.locator('.theme-overlay');
  await expect(overlay.locator('.picture-btn[data-kind="explore"]')).toHaveCount(5);
  await expect(overlay.locator('.picture-btn[data-kind="island"]')).toHaveCount(0);
});

test('switching the toggle changes which worlds are listed, and no worlds are lost', async ({ app, page }) => {
  await app.open();
  // Little: make an island.
  await app.newWorld('meadow');
  await backToGallery(app, page);
  await expect(tiles(page)).toHaveCount(1);
  await expect(tiles(page).first()).toHaveAttribute('data-kind', 'island');

  // Big: the island is hidden (not gone); make an adventure.
  await app.setPlayerMode('big');
  await expect(tiles(page)).toHaveCount(0);
  await app.newAdventure('beach');
  await expect(page.getByTestId('hud')).toHaveAttribute('data-world', 'explore');
  await backToGallery(app, page);
  await expect(page.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'big');
  await expect(tiles(page)).toHaveCount(1);
  await expect(tiles(page).first()).toHaveAttribute('data-kind', 'explore');

  // Back to Little: the island is still there and still opens.
  await app.setPlayerMode('little');
  await expect(tiles(page)).toHaveCount(1);
  await expect(tiles(page).first()).toHaveAttribute('data-kind', 'island');

  // The choice is saved with the player (the same setting as the grown-up area), and both worlds survive a reload.
  await page.reload();
  await app.waitForGallery();
  await expect(page.getByTestId('mode-toggle')).toHaveAttribute('data-mode', 'little');
  await expect(tiles(page)).toHaveCount(1);
  await app.tapElement(tiles(page).first());
  await app.waitForPlay();
  await expect(page.getByTestId('hud')).toHaveAttribute('data-world', 'island');
  await backToGallery(app, page);
  await app.setPlayerMode('big');
  await expect(tiles(page)).toHaveCount(1);
  await expect(tiles(page).first()).toHaveAttribute('data-kind', 'explore');
});

test('the grown-up area mode setting is the same as the gallery toggle', async ({ app, page }) => {
  await app.open();
  await app.setPlayerModeInGrownUps('big');
  await expect(page.getByTestId('mode-toggle-big')).toHaveAttribute('aria-pressed', 'true');
  await app.setPlayerMode('little');
  await app.openGrownUps();
  await expect(page.locator('.profile-list li').first().locator('.mode-choice[data-mode="little"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});
