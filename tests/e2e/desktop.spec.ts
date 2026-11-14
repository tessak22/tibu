import { expect, test } from './support/fixtures';

/** Desktop browsers have no touch: the mouse must work end to end. */
test('mouse only: create a world from the gallery and place a block', async ({ app, page, hasTouch }) => {
  expect(hasTouch).toBe(false);
  expect(app.input.kind).toBe('mouse');
  await app.open();
  await page.getByTestId('gallery-new').click();
  await page.getByTestId('theme-meadow').click();
  await app.waitForPlay();

  const top = await app.topOf(12, 12);
  const before = await app.count();
  await app.tapTopOf(top);
  await expect.poll(() => app.count()).toBe(before + 1);
  expect(await app.block({ ...top, y: top.y + 1 })).not.toBeNull();

  const start = await app.cellToScreen(top);
  await app.input.drag(start!, { x: start!.x + 200, y: start!.y });
  expect(await app.count()).toBe(before + 1);
});
