import { skipBrokenLocalWebkit, test } from './support/fixtures';
skipBrokenLocalWebkit();
test('debug drift', async ({ app, page }) => {
  await app.open();
  await app.setPlayerMode('big');
  await app.tapElement(page.getByTestId('gallery-new'));
  await app.tapElement(page.getByTestId('theme-meadow-explore'));
  await page.waitForTimeout(3000);
  for (let i = 0; i < 10; i++) {
    const c = await app.characterCell();
    const p = await app.cellToScreen(c!);
    const fixed = await app.cellToScreen({ x: 48, y: 1, z: 48 });
    const pend = await page.evaluate(() => window.__tibuTest?.pendingChunks?.());
    console.log(JSON.stringify({ c, p, fixed, pend }));
    await page.waitForTimeout(300);
  }
});
