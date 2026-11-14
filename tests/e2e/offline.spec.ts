import { expect, skipBrokenLocalWebkit, test } from './support/fixtures';

skipBrokenLocalWebkit();

test('after the first visit the app loads and plays with the network off', async ({ app, page, context, browserName }) => {
  await app.open();
  // The service worker precaches everything during install; once it controls the page it is done.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.state ?? null)).toBe('activated');

  await context.setOffline(true);
  const reachedNetwork: string[] = [];
  if (browserName === 'chromium') {
    // Chromium also routes requests made by the service worker: any that leave it fail loudly.
    await context.route('**/*', (route) => {
      reachedNetwork.push(route.request().url());
      return route.abort('internetdisconnected');
    });
  }

  const response = await page.reload();
  if (browserName === 'chromium') expect(response?.fromServiceWorker()).toBe(true);
  await app.waitForGallery();

  await app.newWorld('meadow');
  const top = await app.topOf(12, 12);
  const before = await app.count();
  await app.tapTopOf(top);
  await expect.poll(() => app.count()).toBe(before + 1);
  expect(await app.block({ ...top, y: top.y + 1 })).not.toBeNull();
  expect(reachedNetwork).toEqual([]);

  // Sanity check that the network really is off: an uncached URL cannot be fetched.
  const probe = await page.evaluate(() =>
    fetch(`./offline-probe-${Date.now()}.txt`, { cache: 'no-store' }).then(
      (r) => `status ${r.status}`,
      () => 'failed',
    ),
  );
  expect(probe).toBe('failed');
});
