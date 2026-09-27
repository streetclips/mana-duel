import { describe, expect, it } from 'vitest';
import { castBlocker, getLegalActions, getPower, tryApplyAction } from '../../src/engine';
import {
  cast,
  chooseTargets,
  life,
  pass,
  passToStep,
  pendingOf,
  resolveStack,
  scenario,
  zoneOf,
} from '../helpers';

describe('Ember Snap (instant, any target)', () => {
  it('deals 2 damage to a player', () => {
    let s = scenario({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}] });
    s = resolveStack(cast(s, 'snap', [{ player: 1 }]));
    expect(life(s, 1)).toBe(18);
    expect(zoneOf(s, 'snap')).toBe('graveyard');
    expect(s.players[0].battlefield.every((id) => s.cards[id]?.tapped)).toBe(true);
  });

  it('deals 2 damage to a creature, destroying it if that is lethal', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }, { card: 'canopy_spider', id: 'spider' }] },
      ],
    });
    const killed = resolveStack(cast(s, 'snap', [{ card: 'hound' }]));
    expect(zoneOf(killed, 'hound')).toBe('graveyard');
    const survived = resolveStack(cast(s, 'snap', [{ card: 'spider' }]));
    expect(zoneOf(survived, 'spider')).toBe('battlefield');
    expect(survived.cards.spider?.damage).toBe(2);
  });

  it('fizzles when its only target is gone', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap1' }, { card: 'ember_snap', id: 'snap2' }],
          battlefield: ['mountain', 'mountain'],
        },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = cast(s, 'snap1', [{ card: 'hound' }]);
    s = cast(s, 'snap2', [{ card: 'hound' }]);
    s = resolveStack(s);
    expect(zoneOf(s, 'hound')).toBe('graveyard');
    expect(zoneOf(s, 'snap1')).toBe('graveyard');
    expect(s.events.some((event) => event.t === 'fizzle')).toBe(true);
  });

  it('cannot be cast without the right color of mana', () => {
    const s = scenario({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['forest', 'forest'] }, {}] });
    expect(castBlocker(s, 0, 'snap')).toBe('not enough mana');
  });
});

describe('Magma Lance (sorcery, target creature)', () => {
  it('deals 4 damage to a creature and cannot target players', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'forest'] },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    const casts = getLegalActions(s).filter((action) => action.type === 'cast');
    expect(casts.every((action) => action.type === 'cast' && action.targets.every((target) => 'card' in target))).toBe(true);
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'lance', targets: [{ player: 1 }] })).toMatchObject({
      ok: false,
    });
    s = resolveStack(cast(s, 'lance', [{ card: 'rhino' }]));
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
  });
});

describe('Verdant Surge (instant pump)', () => {
  it('saves a creature in response to burn', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'moss_viper', id: 'viper' }] },
      ],
    });
    s = pass(cast(s, 'snap', [{ card: 'viper' }]));
    s = resolveStack(cast(s, 'surge', [{ card: 'viper' }]));
    expect(zoneOf(s, 'viper')).toBe('battlefield');
    expect(getPower(s, 'viper')).toBe(4);
    s = passToStep(s, 'main1', s.turn + 1);
    expect(getPower(s, 'viper')).toBe(1);
  });
});

describe('Feral Clash (fight)', () => {
  it('makes two creatures deal damage equal to their power to each other', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'feral_clash', id: 'clash' }], battlefield: ['forest', 'forest', { card: 'timberland_rhino', id: 'rhino' }] },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    s = resolveStack(cast(s, 'clash', [{ card: 'rhino' }, { card: 'adept' }]));
    expect(zoneOf(s, 'adept')).toBe('graveyard');
    expect(s.cards.rhino?.damage).toBe(2);
  });

  it('needs a creature you control and one you do not', () => {
    const s = scenario({
      players: [
        { hand: [{ card: 'feral_clash', id: 'clash' }], battlefield: ['forest', 'forest', { card: 'timberland_rhino', id: 'rhino' }] },
        {},
      ],
    });
    expect(getLegalActions(s).some((action) => action.type === 'cast')).toBe(false);
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'clash', targets: [{ card: 'rhino' }, { card: 'rhino' }] }))
      .toMatchObject({ ok: false });
  });

  it('does not deal damage if one of the creatures is gone', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'feral_clash', id: 'clash' }], battlefield: ['forest', 'forest', { card: 'ember_hound', id: 'hound' }] },
        {
          hand: [{ card: 'ember_snap', id: 'snap' }],
          battlefield: ['mountain', { card: 'canopy_spider', id: 'spider' }],
        },
      ],
    });
    s = pass(cast(s, 'clash', [{ card: 'hound' }, { card: 'spider' }]));
    s = resolveStack(cast(s, 'snap', [{ card: 'hound' }]));
    expect(zoneOf(s, 'hound')).toBe('graveyard');
    expect(s.cards.spider?.damage).toBe(0);
  });

  it('applies deathtouch to fight damage', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'feral_clash', id: 'clash' }], battlefield: ['forest', 'forest', { card: 'moss_viper', id: 'viper' }] },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    s = resolveStack(cast(s, 'clash', [{ card: 'viper' }, { card: 'rhino' }]));
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
    expect(zoneOf(s, 'viper')).toBe('graveyard');
  });
});

describe('Read the Roots', () => {
  it('draws two cards', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'read_the_roots', id: 'roots' }],
          battlefield: ['forest', 'forest', 'forest'],
          library: ['ember_hound', 'moss_viper', 'forest'],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'roots'));
    expect(s.players[0].hand.map((id) => s.cards[id]?.def)).toEqual(['ember_hound', 'moss_viper']);
    expect(s.players[0].library).toHaveLength(1);
  });
});

describe('triggered abilities', () => {
  it('asks the controller to target Cinder Adept’s enters trigger', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    s = cast(s, 'adept');
    s = pass(pass(s));
    const decision = pendingOf(s, 'chooseTargets');
    expect(decision.player).toBe(0);
    const options = getLegalActions(s);
    expect(options).toHaveLength(4);
    s = chooseTargets(s, [{ card: 'elf' }]);
    expect(s.stack).toHaveLength(1);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    s = resolveStack(s);
    expect(zoneOf(s, 'elf')).toBe('graveyard');
  });

  it('can target players too', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] }, {}],
    });
    s = pass(pass(cast(s, 'adept')));
    s = resolveStack(chooseTargets(s, [{ player: 1 }]));
    expect(life(s, 1)).toBe(19);
  });

  it('rejects illegal trigger targets', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] }, {}],
    });
    s = pass(pass(cast(s, 'adept')));
    expect(tryApplyAction(s, { type: 'chooseTargets', player: 0, targets: [] })).toMatchObject({ ok: false });
    expect(tryApplyAction(s, { type: 'chooseTargets', player: 0, targets: [{ card: 'nope' }] })).toMatchObject({ ok: false });
  });

  it('fires "when this creature dies" triggers', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'test_dies_draw', id: 'drawer' }] },
      ],
    });
    s = resolveStack(cast(s, 'snap', [{ card: 'drawer' }]));
    expect(zoneOf(s, 'drawer')).toBe('graveyard');
    expect(s.players[1].hand).toHaveLength(1);
  });
});

describe('other effects', () => {
  it('destroys creatures and gains life', () => {
    let s = scenario({
      players: [
        {
          life: 15,
          hand: [{ card: 'test_murder', id: 'murder' }, { card: 'test_heal', id: 'heal' }],
          battlefield: ['forest', 'forest', 'forest'],
        },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    s = resolveStack(cast(s, 'murder', [{ card: 'rhino' }]));
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
    s = resolveStack(cast(s, 'heal'));
    expect(life(s, 0)).toBe(18);
  });
});
