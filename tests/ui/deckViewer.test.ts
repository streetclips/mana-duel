import { describe, expect, it } from 'vitest';
import { DECK_LIST, EMBERWILD, deckSize, getCardDef, getCost, manaValue } from '../../src/engine';
import { deckGroups, manaCurve } from '../../src/ui/components/DeckViewer';

describe('deck viewer data', () => {
  it('counts the nonland cards of Emberwild by mana value, 5 and above together', () => {
    expect(manaCurve(EMBERWILD)).toEqual([8, 6, 6, 3, 1]);
  });

  for (const deck of DECK_LIST) {
    it(`groups every card of ${deck.name} by type, cheapest first`, () => {
      const groups = deckGroups(deck);
      expect(groups.map((group) => group.title)).toEqual(['Criaturas', 'Instantáneos y conjuros', 'Tierras']);
      expect(groups.flatMap((group) => group.entries).reduce((sum, entry) => sum + entry.count, 0)).toBe(deckSize(deck));
      const lands = groups[2]?.entries.reduce((sum, entry) => sum + entry.count, 0) ?? 0;
      expect(manaCurve(deck).reduce((sum, count) => sum + count, 0)).toBe(deckSize(deck) - lands);
      for (const group of groups) {
        const costs = group.entries.map((entry) => manaValue(getCost(entry.card)));
        expect(costs).toEqual([...costs].sort((a, b) => a - b));
      }
      expect(groups[0]?.entries.every((entry) => getCardDef(entry.card).types.includes('creature'))).toBe(true);
    });
  }
});
