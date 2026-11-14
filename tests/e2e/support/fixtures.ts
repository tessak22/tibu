import { release } from 'node:os';
import { test as base, expect, type Locator, type Page } from '@playwright/test';
import { cdpTouchDriver, mouseDriver, syntheticTouchDriver, type Point, type TouchDriver } from './touch';

/**
 * Playwright 1.65 only ships a frozen, protocol-incompatible WebKit build for macOS 14 and
 * older: `newPage()` never resolves there. CI (Linux) and macOS 15+ run the iPad project.
 */
const darwinMajor = process.platform === 'darwin' ? Number(release().split('.')[0]) : Infinity;
export const LOCAL_WEBKIT_BROKEN = darwinMajor < 24 && process.env.TIBU_FORCE_WEBKIT !== '1';
export const LOCAL_WEBKIT_REASON =
  'Playwright 1.65 WebKit cannot open pages on macOS 14 or older (frozen mac14 build); runs in CI on Linux';

export interface Cell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

interface Fixtures {
  input: TouchDriver;
  app: TibuApp;
}

export const test = base.extend<Fixtures>({
  input: async ({ page, browserName, hasTouch }, use) => {
    if (!hasTouch) await use(mouseDriver(page));
    else if (browserName === 'chromium') await use(await cdpTouchDriver(page));
    else await use(syntheticTouchDriver(page));
  },
  app: async ({ page, input }, use) => {
    await use(new TibuApp(page, input));
  },
});

/** Skips the whole file on a local WebKit that cannot run (must be called at file top level). */
export function skipBrokenLocalWebkit(): void {
  test.skip(({ browserName }) => browserName === 'webkit' && LOCAL_WEBKIT_BROKEN, LOCAL_WEBKIT_REASON);
}

export { expect };

/** Page object for the screens a child sees. All input goes through the touch driver. */
export class TibuApp {
  constructor(
    readonly page: Page,
    readonly input: TouchDriver,
  ) {}

  async open(): Promise<void> {
    await this.page.goto('/?test');
    await this.waitForGallery();
  }

  async waitForGallery(): Promise<void> {
    await expect(this.page.locator('html')).toHaveClass(/\bready\b/);
    await expect(this.page.getByTestId('gallery-new')).toBeVisible();
  }

  async center(locator: Locator): Promise<Point> {
    await expect(locator).toBeVisible();
    const box = await locator.boundingBox();
    if (!box) throw new Error('element has no box');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async tapElement(locator: Locator): Promise<void> {
    await this.input.tap(await this.center(locator));
  }

  /** Gallery "+" -> theme picture -> play screen with the world rendered. */
  async newWorld(themeId = 'meadow'): Promise<void> {
    await this.tapElement(this.page.getByTestId('gallery-new'));
    await this.tapElement(this.page.getByTestId(`theme-${themeId}`));
    await this.waitForPlay();
  }

  async waitForPlay(): Promise<void> {
    await expect(this.page.getByTestId('hud')).toBeVisible();
    await expect.poll(() => this.count()).toBeGreaterThan(0);
    // The canvas resizes when the stage appears; wait until projection is stable.
    await expect
      .poll(async () => {
        const a = await this.cellToScreen({ x: 12, y: 1, z: 12 });
        await this.page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
        const b = await this.cellToScreen({ x: 12, y: 1, z: 12 });
        return a !== null && b !== null && a.x === b.x && a.y === b.y;
      })
      .toBe(true);
  }

  count(): Promise<number> {
    return this.page.evaluate(() => window.__tibuTest?.worldCount() ?? -1);
  }

  block(c: Cell): Promise<string | null> {
    return this.page.evaluate(({ x, y, z }) => window.__tibuTest?.getBlock(x, y, z) ?? null, c);
  }

  async cellToScreen(c: Cell): Promise<Point | null> {
    return this.page.evaluate(({ x, y, z }) => window.__tibuTest?.cellToScreen(x, y, z) ?? null, c);
  }

  /** Highest solid cell in a column (the block whose top face is visible from above). */
  async topOf(x: number, z: number): Promise<Cell> {
    const y = await this.page.evaluate(
      ({ x, z }) => {
        for (let y = 15; y >= 0; y--) if (window.__tibuTest?.getBlock(x, y, z)) return y;
        return -1;
      },
      { x, z },
    );
    if (y < 0) throw new Error(`column ${x},${z} is empty`);
    return { x, y, z };
  }

  /** Taps the center of a cell's top face. */
  async tapTopOf(c: Cell): Promise<void> {
    const p = await this.cellToScreen(c);
    if (!p) throw new Error(`cell ${JSON.stringify(c)} is behind the camera`);
    await this.input.tap(p);
  }

  async setMode(mode: 'build' | 'smash'): Promise<void> {
    await this.tapElement(this.page.getByTestId(`mode-${mode}`));
    await expect(this.page.getByTestId('hud')).toHaveAttribute('data-mode', mode);
  }
}
