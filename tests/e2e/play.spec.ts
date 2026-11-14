import { expect, skipBrokenLocalWebkit, test, type Cell } from './support/fixtures';

skipBrokenLocalWebkit();

/** A grass column near the island center, in view of the default camera. */
const COLUMN = { x: 12, z: 12 } as const;

test.beforeEach(async ({ app }) => {
  await app.open();
  await app.newWorld('meadow');
});

test('a tap places exactly one block on the tapped face', async ({ app }) => {
  const top = await app.topOf(COLUMN.x, COLUMN.z);
  const above: Cell = { ...top, y: top.y + 1 };
  const before = await app.count();
  expect(await app.block(above)).toBeNull();

  await app.tapTopOf(top);

  await expect.poll(() => app.count()).toBe(before + 1);
  expect(await app.block(above)).not.toBeNull();
});

test('a drag turns the camera and places nothing', async ({ app }) => {
  const top = await app.topOf(COLUMN.x, COLUMN.z);
  // A cell near the island rim moves a lot when the camera orbits around the center.
  const rim: Cell = { x: 4, y: 1, z: 12 };
  const before = await app.count();
  const start = await app.cellToScreen(top);
  const rimBefore = await app.cellToScreen(rim);
  if (!start || !rimBefore) throw new Error('cells not on screen');

  await app.input.drag(start, { x: start.x + 220, y: start.y + 40 });

  const rimAfter = await app.cellToScreen(rim);
  expect(rimAfter).not.toBeNull();
  expect(Math.hypot(rimAfter!.x - rimBefore.x, rimAfter!.y - rimBefore.y)).toBeGreaterThan(60);
  expect(await app.count()).toBe(before);
  expect(await app.block({ ...top, y: top.y + 1 })).toBeNull();
});

test('smash removes one block and undo puts it back', async ({ app, page }) => {
  const top = await app.topOf(COLUMN.x, COLUMN.z);
  expect(top.y).toBeGreaterThan(0); // the y=0 floor cannot be smashed
  const key = await app.block(top);
  const before = await app.count();

  await app.setMode('smash');
  await app.tapTopOf(top);

  await expect.poll(() => app.count()).toBe(before - 1);
  expect(await app.block(top)).toBeNull();

  await app.tapElement(page.getByTestId('undo'));

  await expect.poll(() => app.count()).toBe(before);
  expect(await app.block(top)).toBe(key);
});

for (const mode of ['build', 'smash'] as const) {
  test(`a pinch in ${mode} mode zooms and never places or smashes`, async ({ app }) => {
    await app.setMode(mode);
    const top = await app.topOf(COLUMN.x, COLUMN.z);
    const near = await app.cellToScreen(top);
    const far = await app.cellToScreen({ ...top, x: top.x - 4 });
    if (!near || !far) throw new Error('cells not on screen');
    const spanBefore = Math.hypot(near.x - far.x, near.y - far.y);
    const before = await app.count();
    const keyBefore = await app.block(top);

    // Center the pinch on the tapped column so a stray tap would hit a block.
    await app.input.pinch(near, 120, 320);

    const near2 = await app.cellToScreen(top);
    const far2 = await app.cellToScreen({ ...top, x: top.x - 4 });
    const spanAfter = Math.hypot(near2!.x - far2!.x, near2!.y - far2!.y);
    expect(spanAfter).toBeGreaterThan(spanBefore * 1.2); // zoomed in
    expect(await app.count()).toBe(before);
    expect(await app.block(top)).toBe(keyBefore);
    expect(await app.block({ ...top, y: top.y + 1 })).toBeNull();
  });
}
