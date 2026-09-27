import { describe, expect, it } from 'vitest';
import { fitCardScale } from '../../src/ui/layout';

const upright = (count: number) => Array.from({ length: count }, () => ({ sideways: false }));

describe('fitCardScale', () => {
  it('keeps full size when the cards fit', () => {
    expect(fitCardScale(340, 120, upright(4), 68, 94)).toBe(1);
  });

  it('shrinks cards so a crowded row still fits', () => {
    const scale = fitCardScale(340, 110, upright(7), 68, 94);
    expect(scale).toBeLessThan(1);
    expect(7 * 68 * scale + 6 * 8 * scale).toBeLessThanOrEqual(340);
  });

  it('uses two rows when there is height for them', () => {
    expect(fitCardScale(340, 220, upright(7), 68, 94)).toBe(1);
  });

  it('accounts for tapped cards being sideways', () => {
    const tapped = [...upright(4), { sideways: true }];
    expect(fitCardScale(340, 110, tapped, 68, 94)).toBeLessThan(fitCardScale(340, 110, upright(5), 68, 94));
  });

  it('never goes below the minimum scale', () => {
    expect(fitCardScale(100, 40, upright(20), 68, 94)).toBe(0.5);
  });
});
