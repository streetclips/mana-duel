import { describe, expect, it } from 'vitest';
import { CHECKS, runChecks } from '../../src/app/checks';

describe('built-in feature checks', () => {
  it('have unique ids', () => {
    expect(new Set(CHECKS.map((check) => check.id)).size).toBe(CHECKS.length);
  });

  for (const check of CHECKS) {
    it(`${check.id}: ${check.title}`, () => {
      const [result] = runChecks([check.id]);
      expect(result?.detail).toBe('ok');
    });
  }
});
