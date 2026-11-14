import { expect, skipBrokenLocalWebkit, test } from './support/fixtures';

skipBrokenLocalWebkit();

test.describe.configure({ timeout: 120_000 });

test('big builder: a step-by-step build shows ghosts and tapping a ghost places that block', async ({ app, page }) => {
  await app.open();
  await app.setPlayerMode('big');
  await app.newWorld('meadow');
  const before = await app.count();

  await app.tapElement(page.getByTestId('builds'));
  const first = page.locator('.blueprint-overlay .blueprint-btn').first();
  await expect(first).toBeVisible();
  // Easiest build first, with star dots and no text.
  await expect(first.locator('.bp-star.on')).toHaveCount(1);
  await app.tapElement(first);

  await expect(page.getByTestId('blueprint-steps')).toBeVisible();
  await expect.poll(async () => (await app.ghosts()).length).toBeGreaterThan(0);

  // The tray already holds the block the build needs next.
  const selected = await page.locator('.tray-item.selected').getAttribute('data-key');
  const ghosts = await app.ghosts();
  const resting = [];
  for (const g of ghosts) {
    if (g.block !== selected) continue;
    if (!(await app.block({ ...g.cell, y: g.cell.y - 1 }))) continue;
    if (!(await app.cellToScreen({ ...g.cell, y: g.cell.y - 1 }))) continue;
    resting.push(g);
  }
  const ghost = resting[0];
  if (!ghost) throw new Error(`no tappable ghost for ${selected}: ${JSON.stringify(ghosts)}`);

  // Tap where the ghost sits (it rests on the top face below it).
  await app.tapTopOf({ ...ghost.cell, y: ghost.cell.y - 1 });

  await expect.poll(() => app.block(ghost.cell)).toBe(ghost.block);
  expect(await app.count()).toBe(before + 1);
  await expect.poll(async () => (await app.ghosts()).some((g) => g.cell.x === ghost.cell.x && g.cell.y === ghost.cell.y && g.cell.z === ghost.cell.z)).toBe(false);

  // The small x stops following the build; the placed block stays.
  await app.tapElement(page.getByTestId('blueprint-stop'));
  await expect(page.getByTestId('blueprint-steps')).toBeHidden();
  await expect.poll(async () => (await app.ghosts()).length).toBe(0);
  expect(await app.block(ghost.cell)).toBe(ghost.block);
});
