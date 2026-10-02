import { describe, expect, it } from 'vitest';
import { DECK_LIST } from '../../src/engine';
import { DEFAULT_CHOICE, RANDOM_DECK, chosenDeck, deckOptions, isDeckChoice, resolveMatchup, seatDeck, withSeatDeck } from '../../src/ui/deckChoice';

describe('deck choice', () => {
  it('offers both seats Random first, then every deck in deck order', () => {
    expect(deckOptions()).toEqual([RANDOM_DECK, ...DECK_LIST.map((deck) => deck.id)]);
  });

  it('accepts Random or a known deck for either seat', () => {
    expect(isDeckChoice({ deck: RANDOM_DECK, opponent: RANDOM_DECK })).toBe(true);
    expect(isDeckChoice({ deck: RANDOM_DECK, opponent: 'duskmire' })).toBe(true);
    expect(isDeckChoice({ deck: 'nope', opponent: RANDOM_DECK })).toBe(false);
    expect(isDeckChoice({ deck: 'duskmire' })).toBe(false);
  });

  it('reads and changes one seat without touching the other', () => {
    const choice = withSeatDeck(withSeatDeck(DEFAULT_CHOICE, 0, 'mistgrave'), 1, 'sunmeadow');
    expect(choice).toEqual({ deck: 'mistgrave', opponent: 'sunmeadow' });
    expect([seatDeck(choice, 0), seatDeck(choice, 1)]).toEqual(['mistgrave', 'sunmeadow']);
    expect(DEFAULT_CHOICE).toEqual({ deck: 'emberwild', opponent: RANDOM_DECK });
  });

  it('names no deck for Random, which is drawn when the game starts', () => {
    expect(chosenDeck(RANDOM_DECK)).toBeNull();
    expect(chosenDeck('duskmire')?.name).toBe('Fangoscuro');
    expect(resolveMatchup({ deck: 'dawntide', opponent: RANDOM_DECK }, () => 'gloamwood')).toEqual(['dawntide', 'gloamwood']);
    expect(resolveMatchup({ deck: RANDOM_DECK, opponent: 'duskmire' }, () => 'gloamwood')).toEqual(['gloamwood', 'duskmire']);
    const draws = ['stormglass', 'mistgrave'];
    expect(resolveMatchup({ deck: RANDOM_DECK, opponent: RANDOM_DECK }, () => draws.shift() ?? '')).toEqual(['stormglass', 'mistgrave']);
  });
});
