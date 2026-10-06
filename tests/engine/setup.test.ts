import { describe, expect, it } from 'vitest';
import {
  applyAction,
  canAttack,
  createGame,
  expandDeck,
  getDeck,
  getLegalActions,
  tryApplyAction,
  type DeckDef,
  type GameState,
} from '../../src/engine';
import { act, expectSound, passTo, passToStep, pendingOf } from '../helpers';

function keepBoth(s: GameState): GameState {
  let state = s;
  for (let i = 0; i < 2; i++) {
    const pending = pendingOf(state, 'mulligan');
    state = act(state, { type: 'keep', player: pending.player });
  }
  return state;
}

describe('game setup', () => {
  it('deals 40-card decks and seven-card opening hands', () => {
    const s = createGame({ seed: 42 });
    expectSound(s);
    for (const ps of s.players) {
      expect(ps.hand).toHaveLength(7);
      expect(ps.library).toHaveLength(33);
      expect(ps.life).toBe(20);
    }
    expect(Object.keys(s.cards)).toHaveLength(80);
    expect(s.turn).toBe(0);
    expect(s.step).toBe('mulligan');
    expect(s.pending).toEqual({ kind: 'mulligan', player: s.startingPlayer });
  });

  it('is fully determined by the seed', () => {
    expect(createGame({ seed: 7 })).toEqual(createGame({ seed: 7 }));
    const libraryOrder = (seed: number) => {
      const s = createGame({ seed });
      return s.players[0].library.map((id) => s.cards[id]?.def);
    };
    expect(libraryOrder(7)).not.toEqual(libraryOrder(8));
  });

  it('honours an explicit starting player', () => {
    expect(createGame({ seed: 3, startingPlayer: 1 }).startingPlayer).toBe(1);
    expect(createGame({ seed: 3, startingPlayer: 0 }).startingPlayer).toBe(0);
  });

  it('deals the same game when given the starting player its coin flip picks', () => {
    const picked = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const flipped = createGame({ seed });
      picked.add(flipped.startingPlayer);
      expect(createGame({ seed, startingPlayer: flipped.startingPlayer })).toEqual(flipped);
    }
    expect(picked.size).toBe(2);
  });

  it('starts turn 1 once both players keep, and the starting player skips the first draw', () => {
    const s = keepBoth(createGame({ seed: 11, startingPlayer: 0 }));
    expect(s.turn).toBe(1);
    expect(s.step).toBe('main1');
    expect(s.activePlayer).toBe(0);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(s.players[0].hand).toHaveLength(7);
  });

  it('lets the second player draw on their first turn', () => {
    const s = passToStep(keepBoth(createGame({ seed: 11, startingPlayer: 0 })), 'main1', 2);
    expect(s.activePlayer).toBe(1);
    expect(s.players[1].hand).toHaveLength(8);
  });

  it('gives each player the deck they bring', () => {
    const s = createGame({ seed: 8, players: [{ deck: 'dawntide' }, { deck: 'duskmire' }] });
    expectSound(s);
    const defsOf = (player: 0 | 1) =>
      Object.values(s.cards)
        .filter((card) => card.owner === player)
        .map((card) => card.def)
        .sort();
    expect(defsOf(0)).toEqual(expandDeck(getDeck('dawntide')).sort());
    expect(defsOf(1)).toEqual(expandDeck(getDeck('duskmire')).sort());
    expect(() => createGame({ players: [{ deck: 'nope' }, {}] })).toThrow(/Unknown deck/);
  });

  it('can skip mulligans for tests and simulations', () => {
    const s = createGame({ seed: 5, skipMulligans: true, startingPlayer: 1 });
    expect(s.turn).toBe(1);
    expect(s.pending).toEqual({ kind: 'priority', player: 1 });
  });
});

describe('player setup', () => {
  it('gives a player more life, a bigger opening hand and permanents from the start', () => {
    const s = createGame({
      seed: 9,
      startingPlayer: 0,
      players: [{ life: 25, openingHand: 8, battlefield: ['soldier_token', 'mountain'] }, { life: 30 }],
    });
    expectSound(s);
    expect(s.players[0].life).toBe(25);
    expect(s.players[1].life).toBe(30);
    expect(s.players[0].hand).toHaveLength(8);
    expect(s.players[1].hand).toHaveLength(7);
    expect(s.players[0].library).toHaveLength(32);
    const [token, land] = s.players[0].battlefield.map((id) => s.cards[id]);
    expect(token).toMatchObject({
      def: 'soldier_token',
      zone: 'battlefield',
      tapped: false,
      summoningSick: false,
      owner: 0,
      controller: 0,
    });
    expect(token?.id).toMatch(/^tk\d+$/);
    expect(land).toMatchObject({ id: 'c81', def: 'mountain', zone: 'battlefield', tapped: false });
    expect(s.events.map((event) => event.t)).not.toContain('enter');
    expect(s.triggers).toEqual([]);
  });

  it('lets a starting creature attack and a starting land pay on the first turn', () => {
    let s = keepBoth(
      createGame({ seed: 4, startingPlayer: 0, players: [{ battlefield: ['soldier_token', 'mountain'] }, {}] }),
    );
    const [token, land] = s.players[0].battlefield;
    expect(canAttack(s, token ?? '')).toBe(true);
    expect(s.players[0].landsPlayedThisTurn).toBe(0);
    s = passTo(s, 'declareAttackers');
    s = act(s, { type: 'declareAttackers', player: 0, attackers: [token ?? ''] });
    expect(s.combat?.attackers).toEqual([token]);
    expect(s.cards[land ?? '']?.tapped).toBe(false);
  });

  it('lets the starting player draw on the first turn when set up to, and nobody else draws more', () => {
    const first = keepBoth(createGame({ seed: 4, startingPlayer: 0, players: [{ drawOnFirstTurn: true }, {}] }));
    expect([first.turn, first.step, first.players[0].hand.length]).toEqual([1, 'main1', 8]);
    expect(first.players[0].drawOnFirstTurn).toBe(true);
    const second = passToStep(
      keepBoth(createGame({ seed: 4, startingPlayer: 0, players: [{}, { drawOnFirstTurn: true }] })),
      'main1',
      2,
    );
    expect([first.players[1].hand.length, second.players[0].hand.length, second.players[1].hand.length]).toEqual([
      7, 7, 8,
    ]);
  });

  it('draws the bigger hand again after a mulligan', () => {
    let s = createGame({ seed: 21, startingPlayer: 0, players: [{ openingHand: 8 }, {}] });
    s = act(s, { type: 'mulligan', player: 0 });
    expect(s.players[0].hand).toHaveLength(8);
    s = act(s, { type: 'keep', player: 0 });
    expect(s.pending).toEqual({ kind: 'bottom', player: 0, count: 1 });
  });

  it('shuffles the same libraries whatever each player starts with', () => {
    const order = (s: GameState) => s.players.map((ps) => ps.library.map((id) => s.cards[id]?.def));
    const plain = createGame({ seed: 13, startingPlayer: 0 });
    const boosted = createGame({
      seed: 13,
      startingPlayer: 0,
      players: [{ life: 40, battlefield: ['forest'] }, { openingHand: 7 }],
    });
    expect(order(boosted)).toEqual(order(plain));
    expect(boosted.players[1].openingHand).toBeUndefined();
  });

  it('plays a deck given as a definition as well as one named by its id', () => {
    const base = getDeck('duskmire');
    const custom: DeckDef = {
      ...base,
      id: 'my_deck',
      name: 'Mi mazo',
      cards: [
        { card: 'swamp', count: 20 },
        { card: 'gloom_wisp', count: 20 },
      ],
    };
    const s = createGame({ seed: 8, players: [{ deck: custom }, { deck: 'duskmire' }] });
    expectSound(s);
    const defsOf = (player: 0 | 1) =>
      Object.values(s.cards)
        .filter((card) => card.owner === player)
        .map((card) => card.def)
        .sort();
    expect(defsOf(0)).toEqual(expandDeck(custom).sort());
    expect(defsOf(1)).toEqual(expandDeck(base).sort());
  });

  it('refuses a starting life or hand below one, and starting cards that are not permanents', () => {
    expect(() => createGame({ players: [{ life: 0 }, {}] })).toThrow(/Invalid starting life/);
    expect(() => createGame({ players: [{}, { openingHand: 2.5 }] })).toThrow(/Invalid opening hand/);
    expect(() => createGame({ players: [{ battlefield: ['ember_snap'] }, {}] })).toThrow(/not a permanent/);
    expect(() => createGame({ players: [{ battlefield: ['nope'] }, {}] })).toThrow(/Unknown card definition/);
  });
});

describe('London mulligan', () => {
  it('draws a new seven and puts one card on the bottom per mulligan', () => {
    let s = createGame({ seed: 21, startingPlayer: 0 });
    const firstHand = [...s.players[0].hand];
    s = act(s, { type: 'mulligan', player: 0 });
    expect(s.players[0].mulligans).toBe(1);
    expect(s.players[0].hand).toHaveLength(7);
    expect(s.players[0].hand).not.toEqual(firstHand);
    expect(s.pending).toEqual({ kind: 'mulligan', player: 0 });

    s = act(s, { type: 'keep', player: 0 });
    const decision = pendingOf(s, 'bottom');
    expect(decision.count).toBe(1);
    const bottomed = s.players[0].hand[0] as string;
    s = act(s, { type: 'bottom', player: 0, cards: [bottomed] });
    expect(s.players[0].hand).toHaveLength(6);
    expect(s.players[0].library.at(-1)).toBe(bottomed);
    expect(s.pending).toEqual({ kind: 'mulligan', player: 1 });
  });

  it('validates the cards put on the bottom', () => {
    let s = createGame({ seed: 21, startingPlayer: 0 });
    s = act(s, { type: 'mulligan', player: 0 });
    s = act(s, { type: 'keep', player: 0 });
    const hand = s.players[0].hand;
    expect(tryApplyAction(s, { type: 'bottom', player: 0, cards: [] })).toMatchObject({ ok: false });
    expect(tryApplyAction(s, { type: 'bottom', player: 0, cards: ['c999'] })).toMatchObject({ ok: false });
    expect(
      tryApplyAction(s, { type: 'bottom', player: 0, cards: [hand[0] as string, hand[0] as string] }),
    ).toMatchObject({ ok: false });
    expect(getLegalActions(s)).toHaveLength(7);
  });

  it('allows at most six mulligans', () => {
    let s = createGame({ seed: 2, startingPlayer: 1 });
    for (let i = 0; i < 6; i++) s = applyAction(s, { type: 'mulligan', player: 1 });
    expect(getLegalActions(s).map((action) => action.type)).toEqual(['keep']);
    expect(tryApplyAction(s, { type: 'mulligan', player: 1 })).toMatchObject({ ok: false });
  });

  it('only accepts decisions from the player who has to decide', () => {
    const s = createGame({ seed: 2, startingPlayer: 1 });
    expect(tryApplyAction(s, { type: 'keep', player: 0 })).toMatchObject({ ok: false });
  });
});
