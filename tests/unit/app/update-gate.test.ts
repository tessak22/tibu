import { describe, expect, it, vi } from 'vitest';
import { createUpdateGate } from '../../../src/app/update-gate';

const setup = () => {
  const activate = vi.fn();
  const reload = vi.fn();
  return { activate, reload, gate: createUpdateGate({ activate, reload }) };
};

describe('update gate', () => {
  it('holds a waiting update while playing and applies it on a calm screen', () => {
    const { activate, reload, gate } = setup();
    gate.setSafe(false);
    gate.updateWaiting();
    expect(activate).not.toHaveBeenCalled();
    gate.setSafe(true);
    expect(activate).toHaveBeenCalledTimes(1);
    gate.reloadNeeded();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('applies a cold-start update once the first calm screen mounts', () => {
    const { activate, gate } = setup();
    gate.updateWaiting();
    expect(activate).not.toHaveBeenCalled();
    gate.setSafe(true);
    expect(activate).toHaveBeenCalledTimes(1);
    gate.setSafe(true);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('never reloads while unsafe, even if another tab activated the update', () => {
    const { reload, gate } = setup();
    gate.setSafe(true);
    gate.setSafe(false);
    gate.reloadNeeded();
    expect(reload).not.toHaveBeenCalled();
    gate.setSafe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
