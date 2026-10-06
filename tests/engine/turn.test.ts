import { describe, expect, it } from 'vitest';
import {
  activationBlocker,
  castBlocker,
  eligibleAttackers,
  getLegalActions,
  getPower,
  getToughness,
  tryApplyAction,
} from '../../src/engine';
import {
  act,
  activate,
  cast,
  pass,
  passTo,
  passToStep,
  passUntil,
  pendingOf,
  playLand,
  resolveStack,
  scenario,
  zoneOf,
} from '../helpers';

describe('lands', () => {
  it('allows one land per turn during your main phase', () => {
    let s = scenario({
      players: [
        {
          hand: [
            { card: 'forest', id: 'f1' },
            { card: 'forest', id: 'f2' },
          ],
        },
        {},
      ],
    });
    s = playLand(s, 'f1');
    expect(zoneOf(s, 'f1')).toBe('battlefield');
    expect(s.players[0].landsPlayedThisTurn).toBe(1);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(tryApplyAction(s, { type: 'playLand', player: 0, card: 'f2' })).toEqual({
      ok: false,
      error: 'ya has jugado una tierra este turno',
      refusal: { code: 'landPlayed' },
    });
    expect(getLegalActions(s).some((action) => action.type === 'playLand')).toBe(false);
  });

  it('cannot be played with a spell on the stack or during the opponent’s turn', () => {
    let s = scenario({
      players: [
        {
          hand: [
            { card: 'ember_snap', id: 'snap' },
            { card: 'forest', id: 'f1' },
          ],
          battlefield: ['mountain'],
        },
        {},
      ],
    });
    s = cast(s, 'snap', [{ player: 1 }]);
    expect(tryApplyAction(s, { type: 'playLand', player: 0, card: 'f1' })).toMatchObject({ ok: false });

    let theirs = scenario({ activePlayer: 1, players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    theirs = pass(theirs);
    expect(theirs.pending).toEqual({ kind: 'priority', player: 0 });
    expect(tryApplyAction(theirs, { type: 'playLand', player: 0, card: 'f1' })).toMatchObject({ ok: false });
  });

  it('resets the land drop at the start of each turn', () => {
    let s = scenario({ players: [{ hand: ['forest', 'forest'], landsPlayed: 1 }, {}] });
    expect(getLegalActions(s).some((action) => action.type === 'playLand')).toBe(false);
    s = passToStep(s, 'main1', s.turn + 2);
    expect(s.players[0].landsPlayedThisTurn).toBe(0);
    expect(getLegalActions(s).some((action) => action.type === 'playLand')).toBe(true);
  });
});

describe('timing', () => {
  it('only allows instants outside your main phase', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {
          hand: [
            { card: 'ember_hound', id: 'hound' },
            { card: 'ember_snap', id: 'snap' },
          ],
          battlefield: ['mountain', 'mountain'],
        },
        {},
      ],
    });
    s = pass(s);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(castBlocker(s, 0, 'hound')).toEqual({ code: 'sorceryTiming' });
    expect(castBlocker(s, 0, 'snap')).toBeNull();
    s = cast(s, 'snap', [{ player: 1 }]);
    s = resolveStack(s);
    expect(s.players[1].life).toBe(18);
  });

  it('lets creatures with flash be cast whenever you could cast an instant', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {
          hand: [
            { card: 'squall_skimmer', id: 'skimmer' },
            { card: 'glassreef_sentinel', id: 'sentinel' },
            { card: 'galewing_falcon', id: 'falcon' },
          ],
          battlefield: ['island', 'island', 'island', 'island', 'island'],
        },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    s = pass(cast(s, 'snap', [{ player: 0 }]));
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(castBlocker(s, 0, 'falcon')).toEqual({ code: 'sorceryTiming' });
    expect(castBlocker(s, 0, 'skimmer')).toBeNull();
    s = resolveStack(cast(s, 'skimmer'));
    expect([zoneOf(s, 'skimmer'), zoneOf(s, 'snap'), s.players[0].life]).toEqual(['battlefield', 'graveyard', 18]);
    s = pass(s);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    s = resolveStack(cast(s, 'sentinel'));
    expect(zoneOf(s, 'sentinel')).toBe('battlefield');
    expect(s.cards.sentinel?.summoningSick).toBe(true);
  });

  it('requires an empty stack for sorcery-speed spells', () => {
    let s = scenario({
      players: [
        {
          hand: [
            { card: 'ember_snap', id: 'snap' },
            { card: 'ember_hound', id: 'hound' },
          ],
          battlefield: ['mountain', 'mountain', 'mountain'],
        },
        {},
      ],
    });
    s = cast(s, 'snap', [{ player: 1 }]);
    expect(castBlocker(s, 0, 'hound')).toEqual({ code: 'sorceryTiming' });
    s = resolveStack(s);
    expect(castBlocker(s, 0, 'hound')).toBeNull();
  });
});

describe('priority and the stack', () => {
  it('resolves last in, first out and returns priority to the active player', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'ember_hound', id: 'hound' }],
        },
      ],
    });
    s = cast(s, 'snap', [{ card: 'hound' }]);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    s = pass(s);
    expect(s.pending).toEqual({ kind: 'priority', player: 1 });
    s = cast(s, 'surge', [{ card: 'hound' }]);
    expect(s.stack.map((item) => (item.kind === 'spell' ? item.card : item.source))).toEqual(['snap', 'surge']);
    s = pass(s);
    s = pass(s);
    expect(s.stack).toHaveLength(1);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(getPower(s, 'hound')).toBe(5);
    expect(getToughness(s, 'hound')).toBe(4);
    s = pass(s);
    s = pass(s);
    expect(s.stack).toHaveLength(0);
    expect(zoneOf(s, 'hound')).toBe('battlefield');
    expect(s.cards.hound?.damage).toBe(2);
    expect(zoneOf(s, 'snap')).toBe('graveyard');
    expect(zoneOf(s, 'surge')).toBe('graveyard');
  });

  it('ends a step only after both players pass in succession', () => {
    let s = scenario({ players: [{}, {}] });
    s = pass(s);
    expect(s.step).toBe('main1');
    expect(s.pending).toEqual({ kind: 'priority', player: 1 });
    s = pass(s);
    expect(s.step).toBe('main2');
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
  });

  it('removes damage and "until end of turn" effects during cleanup', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'canopy_spider', id: 'spider', damage: 2 }],
        },
        {},
      ],
    });
    s = cast(s, 'surge', [{ card: 'spider' }]);
    s = resolveStack(s);
    expect(getPower(s, 'spider')).toBe(4);
    s = passToStep(s, 'main1', s.turn + 1);
    expect(getPower(s, 'spider')).toBe(1);
    expect(s.cards.spider?.damage).toBe(0);
    expect(s.effects).toEqual([]);
  });
});

describe('turn structure', () => {
  it('untaps the active player’s permanents and draws a card', () => {
    let s = scenario({
      activePlayer: 1,
      players: [{ battlefield: [{ card: 'mountain', id: 'm1', tapped: true }], library: ['forest', 'forest'] }, {}],
    });
    s = passToStep(s, 'main1', s.turn + 1);
    expect(s.activePlayer).toBe(0);
    expect(s.cards.m1?.tapped).toBe(false);
    expect(s.players[0].hand).toHaveLength(1);
    expect(s.players[0].library).toHaveLength(1);
  });

  it('makes the active player discard down to seven cards at cleanup', () => {
    let s = scenario({ step: 'main2', players: [{ hand: Array.from({ length: 9 }, () => 'forest') }, {}] });
    s = passTo(s, 'discard');
    const decision = pendingOf(s, 'discard');
    expect(decision).toMatchObject({ player: 0, count: 2 });
    expect(tryApplyAction(s, { type: 'discard', player: 0, cards: [s.players[0].hand[0] as string] })).toMatchObject({
      ok: false,
    });
    s = act(s, { type: 'discard', player: 0, cards: s.players[0].hand.slice(0, 2) });
    expect(s.players[0].hand).toHaveLength(7);
    expect(s.players[0].graveyard).toHaveLength(2);
    expect(s.activePlayer).toBe(1);
  });

  it('skips combat when no creature can attack', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'ember_hound', tapped: true }] }, {}] });
    s = pass(s);
    s = pass(s);
    expect(s.step).toBe('main2');
  });
});

describe('summoning sickness', () => {
  it('stops new creatures from attacking unless they have haste', () => {
    let s = scenario({
      players: [
        {
          hand: [
            { card: 'ember_hound', id: 'hound' },
            { card: 'canopy_spider', id: 'spider' },
          ],
          battlefield: ['mountain', 'mountain', 'forest', 'forest'],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'hound'));
    s = resolveStack(cast(s, 'spider'));
    s = passTo(s, 'declareAttackers');
    expect(eligibleAttackers(s)).toEqual(['hound']);
  });

  it('stops new mana creatures from tapping for mana', () => {
    const sick = scenario({
      players: [
        { hand: [{ card: 'moss_viper', id: 'viper' }], battlefield: [{ card: 'grove_tender', sick: true }] },
        {},
      ],
    });
    expect(castBlocker(sick, 0, 'viper')).toEqual({ code: 'notEnoughMana' });
    let ready = scenario({
      players: [
        { hand: [{ card: 'moss_viper', id: 'viper' }], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
        {},
      ],
    });
    ready = cast(ready, 'viper');
    expect(ready.cards.elf?.tapped).toBe(true);
  });
});

describe('activated abilities', () => {
  it('uses the stack and can be activated repeatedly (Crag Dragon)', () => {
    let s = scenario({
      players: [{ battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain', 'mountain'] }, {}],
    });
    s = activate(s, 'dragon');
    expect(s.stack).toHaveLength(1);
    expect(getPower(s, 'dragon')).toBe(4);
    s = resolveStack(s);
    expect(getPower(s, 'dragon')).toBe(5);
    s = resolveStack(activate(s, 'dragon'));
    expect(getPower(s, 'dragon')).toBe(6);
    expect(activationBlocker(s, 0, 'dragon', 0)).toEqual({ code: 'notEnoughMana' });
    s = passToStep(s, 'main1', s.turn + 1);
    expect(getPower(s, 'dragon')).toBe(4);
  });

  it('respects {T} costs and summoning sickness', () => {
    const sick = scenario({
      players: [{ battlefield: [{ card: 'test_pinger', id: 'pinger', sick: true }, 'mountain'] }, {}],
    });
    expect(activationBlocker(sick, 0, 'pinger', 0)).toEqual({ code: 'summoningSick' });
    let s = scenario({ players: [{ battlefield: [{ card: 'test_pinger', id: 'pinger' }, 'mountain'] }, {}] });
    s = activate(s, 'pinger', 0, [{ player: 1 }]);
    expect(s.cards.pinger?.tapped).toBe(true);
    s = resolveStack(s);
    expect(s.players[1].life).toBe(19);
    expect(activationBlocker(s, 0, 'pinger', 0)).toEqual({ code: 'tapped' });
  });
});

describe('passing through a whole turn', () => {
  it('moves through every step in order', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, {}] });
    const steps: string[] = [];
    s = passUntil(s, (state) => {
      if (state.pending?.kind === 'declareAttackers') return true;
      steps.push(state.step);
      return false;
    });
    s = act(s, { type: 'declareAttackers', player: 0, attackers: ['hound'] });
    expect(s.step).toBe('declareAttackers');
    s = passUntil(s, (state) => state.step === 'main2');
    expect(s.players[1].life).toBe(18);
    expect(steps).toEqual(['main1', 'main1']);
  });
});
