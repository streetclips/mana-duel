import { describe, expect, it } from 'vitest';
import { choosePayment, costSymbols, formatCost, manaValue, parseCost, type ManaSource } from '../../src/engine/mana';

const forest = (id: string): ManaSource => ({ id, colors: ['G'], isCreature: false });
const mountain = (id: string): ManaSource => ({ id, colors: ['R'], isCreature: false });

describe('mana costs', () => {
  it('parses generic and colored symbols', () => {
    const cost = parseCost('{2}{R}{R}');
    expect(cost).toEqual({ generic: 2, W: 0, U: 0, B: 0, R: 2, G: 0 });
    expect(manaValue(cost)).toBe(4);
    expect(costSymbols(cost)).toEqual(['2', 'R', 'R']);
    expect(formatCost(cost)).toBe('{2}{R}{R}');
  });

  it('treats a missing cost as zero', () => {
    expect(manaValue(parseCost(undefined))).toBe(0);
    expect(manaValue(parseCost(''))).toBe(0);
    expect(formatCost(parseCost(''))).toBe('{0}');
  });

  it('rejects malformed costs', () => {
    expect(() => parseCost('{X}')).toThrow(/Unknown mana symbol/);
    expect(() => parseCost('2R')).toThrow(/Invalid mana cost/);
  });
});

describe('choosePayment', () => {
  it('pays colored pips with matching sources and generic with the rest', () => {
    const payment = choosePayment([forest('f1'), mountain('m1'), mountain('m2')], parseCost('{1}{R}'));
    expect(payment).toHaveLength(2);
    expect(payment?.some((id) => id.startsWith('m'))).toBe(true);
  });

  it('returns null when a color is missing or there is not enough mana', () => {
    expect(choosePayment([forest('f1'), forest('f2')], parseCost('{R}'))).toBeNull();
    expect(choosePayment([mountain('m1')], parseCost('{1}{R}'))).toBeNull();
  });

  it('prefers lands over creatures', () => {
    const elf: ManaSource = { id: 'e1', colors: ['G'], isCreature: true };
    expect(choosePayment([elf, forest('f1')], parseCost('{G}'))).toEqual(['f1']);
  });

  it('keeps the colors that other cards in hand need', () => {
    expect(choosePayment([forest('f1'), mountain('m1')], parseCost('{1}'), { R: 2 })).toEqual(['f1']);
    expect(choosePayment([forest('f1'), mountain('m1')], parseCost('{1}'), { G: 2 })).toEqual(['m1']);
  });

  it('backtracks to use flexible sources correctly', () => {
    const redGreen: ManaSource = { id: 'd1', colors: ['R', 'G'], isCreature: false };
    const redWhite: ManaSource = { id: 'd2', colors: ['R', 'W'], isCreature: false };
    expect(choosePayment([redGreen, redWhite], parseCost('{R}{G}'))?.sort()).toEqual(['d1', 'd2']);
    expect(choosePayment([redGreen, redWhite], parseCost('{G}{W}'))?.sort()).toEqual(['d1', 'd2']);
    expect(choosePayment([redGreen, redWhite], parseCost('{G}{G}'))).toBeNull();
  });

  it('costs nothing for a zero cost', () => {
    expect(choosePayment([], parseCost('{0}'))).toEqual([]);
  });
});
