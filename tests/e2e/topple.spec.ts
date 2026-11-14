import { expect, skipBrokenLocalWebkit, test, type Cell } from './support/fixtures';

skipBrokenLocalWebkit();

test.describe.configure({ timeout: 120_000 });

const COLUMN = { x: 12, z: 12 } as const;

test('big builder: smashing the bottom of a tower of 3 knocks all 3 down, one undo restores all 3', async ({
  app,
  page,
}) => {
  await app.open();
  await app.setPlayerMode('big');
  await app.newWorld('meadow');

  // Stack three blocks on a grass column.
  const ground = await app.topOf(COLUMN.x, COLUMN.z);
  const start = await app.count();
  let top: Cell = ground;
  for (let i = 1; i <= 3; i++) {
    await app.tapTopOf(top);
    const next = { ...ground, y: ground.y + i };
    await expect.poll(() => app.block(next)).not.toBeNull();
    top = next;
  }
  await expect.poll(() => app.count()).toBe(start + 3);
  const bottom: Cell = { ...ground, y: ground.y + 1 };
  const keys = await Promise.all([1, 2, 3].map((i) => app.block({ ...ground, y: ground.y + i })));

  await app.setMode('smash');
  // The bottom block's top face is covered, so tap low on its side face.
  await app.tapSideOf(bottom);

  await expect.poll(() => app.count()).toBe(start);
  for (let i = 1; i <= 3; i++) expect(await app.block({ ...ground, y: ground.y + i })).toBeNull();
  expect(await app.block(ground)).not.toBeNull(); // The island itself is untouched.

  await app.tapElement(page.getByTestId('undo'));

  await expect.poll(() => app.count()).toBe(start + 3);
  for (let i = 1; i <= 3; i++) expect(await app.block({ ...ground, y: ground.y + i })).toBe(keys[i - 1]);
});
