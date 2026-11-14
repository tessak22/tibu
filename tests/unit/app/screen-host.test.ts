// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createScreenHost } from '../../../src/app/screen-host';
import type { Screen } from '../../../src/ui/screen';

/** A fake shared view, like the GameView both play sessions use. */
const sharedView = () => ({ active: false, follow: null as string | null });

const fakeSession = (name: string, view: ReturnType<typeof sharedView>, log: string[]): Screen => {
  log.push(`create ${name}`);
  view.active = true;
  view.follow = name;
  const el = document.createElement('div');
  return {
    el,
    dispose() {
      log.push(`dispose ${name}`);
      view.active = false;
      view.follow = null;
      el.remove();
    },
  };
};

describe('screen host ordering', () => {
  it('fully disposes the old session before the new one is created', () => {
    const root = document.createElement('div');
    const host = createScreenHost(root);
    const view = sharedView();
    const log: string[] = [];
    host.replace(() => fakeSession('old', view, log));
    const next = host.replace(() => fakeSession('new', view, log));
    expect(log).toEqual(['create old', 'dispose old', 'create new']);
    // The old dispose did not turn the shared view off under the new session.
    expect(view).toEqual({ active: true, follow: 'new' });
    expect(host.current()).toBe(next);
    expect(root.children).toHaveLength(1);
  });

  it('nothing stays mounted when building the next screen fails', () => {
    const root = document.createElement('div');
    const host = createScreenHost(root);
    const log: string[] = [];
    host.replace(() => fakeSession('old', sharedView(), log));
    expect(() =>
      host.replace(() => {
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(log).toEqual(['create old', 'dispose old']);
    expect(host.current()).toBeNull();
    expect(root.children).toHaveLength(0);
  });
});
