import { describe, expect, it } from 'vitest';
import { createProblemLog } from '../../../src/app/problem-log';

describe('problem log', () => {
  it('keeps the latest entry per kind', () => {
    let t = 100;
    const log = createProblemLog(() => t++);
    expect(log.last('save')).toBeNull();
    log.record('save', new Error('quota'));
    log.record('thumbnail', 'lost context');
    log.record('save', new DOMException('closing', 'InvalidStateError'));
    expect(log.last('save')).toEqual({ kind: 'save', at: 102, detail: 'InvalidStateError: closing' });
    expect(log.last('thumbnail')?.detail).toBe('lost context');
  });

  it('is bounded', () => {
    const log = createProblemLog(() => 0);
    for (let i = 0; i < 50; i++) log.record('thumbnail', `e${i}`);
    log.record('save');
    expect(log.last('save')?.detail).toBe('');
    expect(log.last('thumbnail')?.detail).toBe('e49');
  });
});
