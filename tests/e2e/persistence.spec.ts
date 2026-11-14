import type { Page } from '@playwright/test';
import { expect, skipBrokenLocalWebkit, test, type Cell } from './support/fixtures';

skipBrokenLocalWebkit();

/** True once IndexedDB holds a saved world with a block at `cell` (autosave finished). */
function savedHasBlock(page: Page, cell: Cell): Promise<boolean> {
  return page.evaluate(
    (c) =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open('tibu');
        req.onerror = () => resolve(false);
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction('worlds', 'readonly').objectStore('worlds').getAll();
          all.onerror = () => {
            db.close();
            resolve(false);
          };
          all.onsuccess = () => {
            db.close();
            const worlds = all.result as { data: { blocks: number[][] } }[];
            resolve(worlds.some((w) => w.data.blocks.some(([x, y, z]) => x === c.x && y === c.y && z === c.z)));
          };
        };
      }),
    cell,
  );
}

test('reload keeps the world: autosave, then reopen it from the gallery', async ({ app, page }) => {
  await app.open();
  await app.newWorld('meadow');
  const top = await app.topOf(12, 12);
  const placed: Cell = { ...top, y: top.y + 1 };
  expect(await savedHasBlock(page, placed)).toBe(false);

  await app.tapTopOf(top);
  await expect.poll(() => app.block(placed)).not.toBeNull();
  const key = await app.block(placed);
  const count = await app.count();
  // Wait for the debounced autosave to reach IndexedDB rather than sleeping.
  await expect.poll(() => savedHasBlock(page, placed)).toBe(true);

  await page.reload();
  await app.waitForGallery();
  const worlds = page.getByTestId('gallery-item');
  await expect(worlds).toHaveCount(1);
  await app.tapElement(worlds.first());
  await app.waitForPlay();

  expect(await app.block(placed)).toBe(key);
  expect(await app.count()).toBe(count);
});
