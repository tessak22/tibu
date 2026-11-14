/** A full-screen view. The app mounts one at a time. */
export interface Screen {
  readonly el: HTMLElement;
  dispose(): void;
}
