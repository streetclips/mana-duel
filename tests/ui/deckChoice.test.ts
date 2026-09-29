import { describe, expect, it } from 'vitest';
import { DECK_LIST } from '../../src/engine';
import { DEFAULT_CHOICE, RANDOM_DECK, chosenDeck, deckOptions, resolveMatchup, seatDeck, withSeatDeck } from '../../src/ui/deckChoice';

describe('deck choice', () => {
  it('offers every deck to both seats in deck order, and Random only to the AI, first', () => {
    const ids = DECK_LIST.map((deck) => deck.id);
    expect(deckOptions(0)).toEqual(ids);
    expect(deckOptions(1)).toEqual([RANDOM_DECK, ...ids]);
  });

  it('reads and changes one seat without touching the other', () => {
    const choice = withSeatDeck(withSeatDeck(DEFAULT_CHOICE, 0, 'mistgrave'), 1, 'sunmeadow');
    expect(choice).toEqual({ deck: 'mistgrave', opponent: 'sunmeadow' });
    expect([seatDeck(choice, 0), seatDeck(choice, 1)]).toEqual(['mistgrave', 'sunmeadow']);
    expect(DEFAULT_CHOICE).toEqual({ deck: 'emberwild', opponent: RANDOM_DECK });
  });

  it('names no deck for Random, which is drawn when the game starts', () => {
    expect(chosenDeck(RANDOM_DECK)).toBeNull();
    expect(chosenDeck('duskmire')?.name).toBe('Duskmire');
    expect(resolveMatchup({ deck: 'dawntide', opponent: RANDOM_DECK }, () => 'gloamwood')).toEqual(['dawntide', 'gloamwood']);
  });
});
