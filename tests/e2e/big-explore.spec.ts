import { expect, skipBrokenLocalWebkit, test, type Cell } from './support/fixtures';

skipBrokenLocalWebkit();

/** Neighbouring columns to try as a walk target, a few steps from the character. */
const OFFSETS: readonly (readonly [number, number])[] = [
  [3, 0], [-3, 0], [0, 3], [0, -3], [3, 3], [-3, -3], [3, -3], [-3, 3], [2, 0], [0, 2], [-2, 0], [0, -2],
];

test.beforeEach(async ({ app }) => {
  await app.open();
  await app.setPlayerMode('big');
});

test('big builder: an adventure world starts in walk mode and a tap walks the character there', async ({ app, page }) => {
  await app.newAdventure('meadow');
  const hud = page.getByTestId('hud');
  await expect(hud).toHaveAttribute('data-mode', 'walk');
  await expect(hud).toHaveAttribute('data-world', 'explore');
  for (const id of ['mode-walk', 'mode-build', 'mode-smash', 'builds', 'sticker-book']) {
    await expect(page.getByTestId(id)).toBeVisible();
  }

  const start = await app.characterCell();
  if (!start) throw new Error('no character');
  const before = await app.count();

  // A nearby walkable column (about the same height as where the character stands) on screen.
  let target: Cell | null = null;
  for (const [dx, dz] of OFFSETS) {
    const x = start.x + dx;
    const z = start.z + dz;
    const top = await app.topYOf(x, z);
    if (top < 0 || Math.abs(top + 1 - start.y) > 1) continue;
    if (!(await app.cellToScreen({ x, y: top, z }))) continue;
    target = { x, y: top + 1, z };
    break;
  }
  if (!target) throw new Error(`no walkable ground near ${JSON.stringify(start)}`);

  await app.tapTopOf({ ...target, y: target.y - 1 });

  await expect
    .poll(async () => {
      const at = await app.characterCell();
      return at ? Math.abs(at.x - target!.x) + Math.abs(at.z - target!.z) : 99;
    }, { timeout: 20_000 })
    .toBe(0);
  // Walking never builds or smashes.
  expect(await app.count()).toBe(before);
});

test('big builder HUD is all pictures and the sticker book opens with silhouettes', async ({ app, page }) => {
  await app.newAdventure('meadow');
  const info = await page.locator('[data-testid="hud"] button').evaluateAll((els) =>
    els
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({
        text: (el as HTMLElement).innerText.trim(),
        pic: el.querySelector('svg, canvas, img') !== null,
        box: el.getBoundingClientRect(),
      })),
  );
  expect(info.length).toBeGreaterThan(8);
  for (const b of info) {
    expect(b.text).toBe('');
    expect(b.pic).toBe(true);
    expect(Math.min(b.box.width, b.box.height)).toBeGreaterThanOrEqual(63.5);
  }

  await app.tapElement(page.getByTestId('sticker-book'));
  await expect(page.getByTestId('sticker-grid')).toBeVisible();
  await expect(page.locator('.sticker-cell.not-yet').first()).toBeVisible();
});

test('the home button brings the character back into view', async ({ app, page }) => {
  await app.newAdventure('meadow');
  const start = await app.characterCell();
  const center = await app.cellToScreen(start!);
  if (!center) throw new Error('character not on screen');
  await app.input.drag(center, { x: center.x + 260, y: center.y + 30 });
  await app.tapElement(page.getByTestId('hud').locator('.home-btn'));
  await app.waitForStableCamera();
  const after = await app.cellToScreen((await app.characterCell())!);
  const viewport = page.viewportSize()!;
  expect(after).not.toBeNull();
  expect(after!.x).toBeGreaterThan(0);
  expect(after!.x).toBeLessThan(viewport.width);
  expect(after!.y).toBeGreaterThan(0);
  expect(after!.y).toBeLessThan(viewport.height);
});
