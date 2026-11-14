/**
 * Watches frame times and decides when to drop to low quality (no shadows, fewer particles).
 * Pure and deterministic: feed it frame deltas in seconds.
 * Once low quality is chosen it stays (avoids flip-flopping on borderline devices).
 */
export interface QualityMonitorOptions {
  readonly lowFps: number;
  /** How long FPS must stay low before switching. */
  readonly windowSeconds: number;
  /** Ignore the first seconds (shader compilation, texture uploads). */
  readonly warmupSeconds: number;
}

const DEFAULTS: QualityMonitorOptions = { lowFps: 40, windowSeconds: 3, warmupSeconds: 2 };

export class QualityMonitor {
  private elapsed = 0;
  private lowSince = 0;
  private windowTime = 0;
  private windowFrames = 0;
  private low = false;
  private readonly options: QualityMonitorOptions;

  constructor(options: Partial<QualityMonitorOptions> = {}) {
    this.options = { ...DEFAULTS, ...options };
  }

  isLow(): boolean {
    return this.low;
  }

  /** Returns true exactly once, on the frame the monitor switches to low quality. */
  frame(dt: number): boolean {
    if (this.low || !(dt > 0)) return false;
    // Long pauses (tab hidden, inactive view) are not slow frames.
    if (dt > 0.5) {
      this.lowSince = 0;
      return false;
    }
    this.elapsed += dt;
    if (this.elapsed < this.options.warmupSeconds) return false;
    this.windowTime += dt;
    this.windowFrames += 1;
    if (this.windowTime < 0.5) return false;
    const fps = this.windowFrames / this.windowTime;
    this.lowSince = fps < this.options.lowFps ? this.lowSince + this.windowTime : 0;
    this.windowTime = 0;
    this.windowFrames = 0;
    if (this.lowSince >= this.options.windowSeconds) {
      this.low = true;
      return true;
    }
    return false;
  }

  forceLow(): void {
    this.low = true;
  }
}
