import { describe, expect, it } from 'vitest';
import { buildDeck } from '../../src/app/deckBuilding';
import { DECK_LIST, getDeck } from '../../src/engine';
import {
  DEFAULT_CHOICE,
  RANDOM_DECK,
  chosenDeck,
  deckOptions,
  isDeckChoice,
  knownChoice,
  resolveMatchup,
  seatDeck,
  withSeatDeck,
} from '../../src/ui/deckChoice';

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

  it('offers your own decks after the fourteen, and plays them by their definition', () => {
    const mine = buildDeck({ id: null, name: 'Mi mazo', featured: null, cards: getDeck('duskmire').cards }, 'mine-1');
    expect(deckOptions([mine])).toEqual([RANDOM_DECK, ...DECK_LIST.map((deck) => deck.id), 'mine-1']);
    expect(isDeckChoice({ deck: 'mine-1', opponent: RANDOM_DECK })).toBe(false);
    expect(isDeckChoice({ deck: 'mine-1', opponent: RANDOM_DECK }, [mine])).toBe(true);
    expect(chosenDeck('mine-1', [mine])).toBe(mine);
    expect(chosenDeck('mine-1')).toBeNull();
    expect(resolveMatchup({ deck: 'mine-1', opponent: 'mine-1' }, () => 'gloamwood', [mine])).toEqual([mine, mine]);
    expect(knownChoice({ deck: 'mine-1', opponent: 'mine-2' }, [mine])).toEqual({ deck: 'mine-1', opponent: RANDOM_DECK });
    expect(knownChoice({ deck: 'mine-1', opponent: 'duskmire' }, [])).toEqual({ deck: 'emberwild', opponent: 'duskmire' });
  });
});
