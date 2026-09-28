import { describe, expect, it } from 'vitest';
import {
  castBlocker,
  checkInvariants,
  describeEvent,
  describeState,
  getLegalActions,
  getPower,
  getToughness,
  tryApplyAction,
  type CardInstance,
  type GameEvent,
} from '../../src/engine';
import {
  act,
  activate,
  attack,
  block,
  cast,
  chooseTargets,
  finishCombat,
  life,
  pass,
  passTo,
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

describe('Turn the Tide (counterspell)', () => {
  const castRhinoIntoCounter = () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    s = pass(cast(s, 'rhino'));
    return s;
  };

  it('counters a creature spell, which goes to the graveyard without entering', () => {
    let s = castRhinoIntoCounter();
    expect(getLegalActions(s).filter((action) => action.type === 'cast')).toEqual([
      { type: 'cast', player: 0, card: 'tide', targets: [{ card: 'rhino' }] },
    ]);
    s = resolveStack(cast(s, 'tide', [{ card: 'rhino' }]));
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
    expect(zoneOf(s, 'tide')).toBe('graveyard');
    expect(s.players[1].battlefield).not.toContain('rhino');
    expect(s.stack).toEqual([]);
  });

  it('logs the countered spell', () => {
    const s = cast(castRhinoIntoCounter(), 'tide', [{ card: 'rhino' }]);
    const resolved = act(pass(s), { type: 'pass', player: 1 });
    expect(resolved.events).toContainEqual({ t: 'counter', card: 'rhino', player: 1 });
  });

  it('needs a spell on the stack: abilities, permanents and players are not spells', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island', { card: 'crag_dragon', id: 'dragon' }, 'mountain'] },
        {},
      ],
    });
    expect(getLegalActions(s).some((action) => action.type === 'cast')).toBe(false);
    expect(castBlocker(s, 0, 'tide')).toBeNull();
    s = activate(s, 'dragon');
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'tide', targets: [{ card: 'dragon' }] })).toMatchObject({ ok: false });
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'tide', targets: [{ player: 1 }] })).toMatchObject({ ok: false });
    expect(getLegalActions(s).some((action) => action.type === 'cast')).toBe(false);
  });

  it('can counter a counterspell, so the original spell resolves', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        {
          hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'turn_the_tide', id: 'answer' }],
          battlefield: ['mountain', 'island', 'island', 'island'],
        },
      ],
    });
    s = pass(cast(s, 'snap', [{ player: 0 }]));
    s = pass(cast(s, 'tide', [{ card: 'snap' }]));
    s = resolveStack(cast(s, 'answer', [{ card: 'tide' }]));
    expect([zoneOf(s, 'tide'), zoneOf(s, 'answer'), zoneOf(s, 'snap')]).toEqual(['graveyard', 'graveyard', 'graveyard']);
    expect(life(s, 0)).toBe(18);
  });

  it('fizzles when the spell it targets was already countered', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {
          hand: [{ card: 'turn_the_tide', id: 'first' }, { card: 'turn_the_tide', id: 'second' }],
          battlefield: ['island', 'island', 'island', 'island', 'island', 'island'],
        },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    s = pass(cast(s, 'snap', [{ player: 0 }]));
    s = cast(cast(s, 'first', [{ card: 'snap' }]), 'second', [{ card: 'snap' }]);
    const events: GameEvent[] = [];
    while (s.stack.length > 0) {
      s = pass(s);
      events.push(...s.events);
    }
    expect(events.filter((event) => event.t === 'counter')).toEqual([{ t: 'counter', card: 'snap', player: 1 }]);
    expect(events.some((event) => event.t === 'fizzle' && event.item.kind === 'spell' && event.item.card === 'first')).toBe(true);
    expect(life(s, 0)).toBe(20);
  });
});

describe('Undertow (bounce)', () => {
  it('returns a creature to its owner’s hand without its damage or pumps', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'undertow', id: 'undertow' }], battlefield: ['island', 'island'] },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino', damage: 2, tapped: true }] },
      ],
    });
    s = resolveStack(cast(s, 'undertow', [{ card: 'rhino' }]));
    expect(zoneOf(s, 'rhino')).toBe('hand');
    expect(s.players[1].hand).toEqual(['rhino']);
    expect(s.cards.rhino).toMatchObject({ controller: 1, tapped: false, damage: 0, summoningSick: false });
    expect(s.events).toContainEqual({ t: 'bounce', card: 'rhino', player: 1 });
  });

  it('removes an attacker from combat before it deals damage', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        { hand: [{ card: 'undertow', id: 'undertow' }], battlefield: ['island', 'island'] },
      ],
    });
    s = attack(s, ['rhino']);
    s = pass(s);
    s = resolveStack(cast(s, 'undertow', [{ card: 'rhino' }]));
    s = passToStep(s, 'main2');
    expect(life(s, 1)).toBe(20);
    expect(zoneOf(s, 'rhino')).toBe('hand');
  });
});

describe('Withering Touch (-2/-2)', () => {
  it('kills a creature with 2 toughness and shrinks a bigger one until end of turn', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'withering_touch', id: 't1' }, { card: 'withering_touch', id: 't2' }], battlefield: ['swamp', 'swamp'] },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }, { card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    s = resolveStack(cast(s, 't1', [{ card: 'adept' }]));
    expect(zoneOf(s, 'adept')).toBe('graveyard');
    s = resolveStack(cast(s, 't2', [{ card: 'rhino' }]));
    expect([getPower(s, 'rhino'), getToughness(s, 'rhino')]).toEqual([2, 2]);
    s = passToStep(s, 'main1', s.turn + 1);
    expect([getPower(s, 'rhino'), getToughness(s, 'rhino')]).toEqual([4, 4]);
  });

  it('adds up with damage already marked', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'withering_touch', id: 'touch' }], battlefield: ['swamp'] },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino', damage: 2 }] },
      ],
    });
    s = resolveStack(cast(s, 'touch', [{ card: 'rhino' }]));
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
  });
});

describe("Dawn's Verdict (destroy target tapped creature)", () => {
  it('can only target tapped creatures', () => {
    const s = scenario({
      players: [
        { hand: [{ card: 'dawns_verdict', id: 'verdict' }], battlefield: ['plains', 'plains', 'plains'] },
        { battlefield: [{ card: 'timberland_rhino', id: 'tapped', tapped: true }, { card: 'crag_dragon', id: 'untapped' }] },
      ],
    });
    expect(getLegalActions(s).filter((action) => action.type === 'cast')).toEqual([
      { type: 'cast', player: 0, card: 'verdict', targets: [{ card: 'tapped' }] },
    ]);
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'verdict', targets: [{ card: 'untapped' }] })).toMatchObject({ ok: false });
    expect(zoneOf(resolveStack(cast(s, 'verdict', [{ card: 'tapped' }])), 'tapped')).toBe('graveyard');
  });

  it('destroys an attacker that tapped to attack, but not a vigilant one', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }, { card: 'bramble_warden', id: 'warden' }] },
        { hand: [{ card: 'dawns_verdict', id: 'verdict' }], battlefield: ['plains', 'plains', 'plains'] },
      ],
    });
    s = pass(attack(s, ['rhino', 'warden']));
    const targets = getLegalActions(s).flatMap((action) => (action.type === 'cast' ? action.targets : []));
    expect(targets).toEqual([{ card: 'rhino' }]);
    s = resolveStack(cast(s, 'verdict', [{ card: 'rhino' }]));
    s = passToStep(s, 'main2');
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
    expect(life(s, 1)).toBe(18);
  });
});

describe('life drain and life payment', () => {
  it("Night's Bargain draws two cards and costs 2 life", () => {
    let s = scenario({
      players: [{ hand: [{ card: 'nights_bargain', id: 'bargain' }], battlefield: ['swamp', 'swamp'], library: ['forest', 'forest', 'forest'] }, {}],
    });
    s = resolveStack(cast(s, 'bargain'));
    expect(s.players[0].hand).toHaveLength(2);
    expect(life(s, 0)).toBe(18);
    expect(s.events).toContainEqual({ t: 'loseLife', player: 0, amount: 2 });
  });

  it("paying life can lose the game: Night's Bargain at 2 life", () => {
    let s = scenario({ players: [{ life: 2, hand: [{ card: 'nights_bargain', id: 'bargain' }], battlefield: ['swamp', 'swamp'] }, {}] });
    s = resolveStack(cast(s, 'bargain'));
    expect(s.pending).toEqual({ kind: 'gameOver', winner: 1, reason: 'life' });
  });

  it('Soul Siphon deals 2 damage and gains 2 life', () => {
    let s = scenario({
      players: [{ life: 10, hand: [{ card: 'soul_siphon', id: 'siphon' }], battlefield: ['swamp', 'swamp', 'swamp'] }, {}],
    });
    s = resolveStack(cast(s, 'siphon', [{ player: 1 }]));
    expect([life(s, 0), life(s, 1)]).toEqual([12, 18]);
  });

  it('Radiant Blessing pumps a creature and gains 2 life', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'radiant_blessing', id: 'blessing' }], battlefield: ['plains', { card: 'beacon_squire', id: 'squire' }] }, {}],
    });
    s = resolveStack(cast(s, 'blessing', [{ card: 'squire' }]));
    expect(getPower(s, 'squire')).toBe(4);
    expect(life(s, 0)).toBe(22);
  });

  it('Grave Sentence destroys any creature at instant speed', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'grave_sentence', id: 'sentence' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp'] },
        { battlefield: [{ card: 'crag_dragon', id: 'dragon' }] },
      ],
    });
    s = pass(s);
    s = resolveStack(cast(s, 'sentence', [{ card: 'dragon' }]));
    expect(zoneOf(s, 'dragon')).toBe('graveyard');
  });
});

describe('Dawntide and Duskmire creature abilities', () => {
  it('Reef Scholar draws a card when it enters', () => {
    let s = scenario({ players: [{ hand: [{ card: 'reef_scholar', id: 'scholar' }], battlefield: ['island', 'island', 'island'] }, {}] });
    s = resolveStack(cast(s, 'scholar'));
    expect(zoneOf(s, 'scholar')).toBe('battlefield');
    expect(s.players[0].hand).toHaveLength(1);
  });

  it('Gloom Wisp draws its controller a card when it dies', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'gloom_wisp', id: 'wisp' }] },
      ],
    });
    s = resolveStack(cast(s, 'snap', [{ card: 'wisp' }]));
    expect(zoneOf(s, 'wisp')).toBe('graveyard');
    expect(s.players[1].hand).toHaveLength(1);
  });

  it('Crypt Ghoul and Nightveil Wraith deal damage to the opponent when they die', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'magma_lance', id: 'lance' }],
          battlefield: ['mountain', 'mountain', 'mountain', 'mountain', { card: 'grove_tender', id: 'elf' }],
        },
        { battlefield: [{ card: 'crypt_ghoul', id: 'ghoul', damage: 1 }, { card: 'nightveil_wraith', id: 'wraith' }] },
      ],
    });
    s = pass(cast(s, 'snap', [{ card: 'ghoul' }]));
    s = act(s, { type: 'pass', player: 1 });
    expect(getLegalActions(s)).toEqual([{ type: 'chooseTargets', player: 1, targets: [{ player: 0 }] }]);
    s = resolveStack(chooseTargets(s, [{ player: 0 }]));
    expect([zoneOf(s, 'ghoul'), zoneOf(s, 'elf'), life(s, 0)]).toEqual(['graveyard', 'battlefield', 19]);
    s = pass(cast(s, 'lance', [{ card: 'wraith' }]));
    s = act(s, { type: 'pass', player: 1 });
    s = resolveStack(chooseTargets(s, [{ player: 0 }]));
    expect([zoneOf(s, 'wraith'), life(s, 0)]).toEqual(['graveyard', 17]);
  });

  it('Grave Hexer shrinks a creature it does not control when it enters, and only such a creature', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'grave_hexer', id: 'hexer' }], battlefield: ['swamp', 'swamp', 'swamp', { card: 'gloom_wisp', id: 'wisp' }] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = pass(pass(cast(s, 'hexer')));
    expect(getLegalActions(s)).toEqual([{ type: 'chooseTargets', player: 0, targets: [{ card: 'hound' }] }]);
    s = resolveStack(chooseTargets(s, [{ card: 'hound' }]));
    expect(zoneOf(s, 'hound')).toBe('graveyard');
    expect(zoneOf(s, 'wisp')).toBe('battlefield');
  });

  it('Grave Hexer’s trigger is skipped when the opponent has no creature', () => {
    let s = scenario({ players: [{ hand: [{ card: 'grave_hexer', id: 'hexer' }], battlefield: ['swamp', 'swamp', 'swamp'] }, {}] });
    s = resolveStack(cast(s, 'hexer'));
    expect(zoneOf(s, 'hexer')).toBe('battlefield');
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
  });

  it('Dread Tyrant costs its controller 2 life when it enters', () => {
    let s = scenario({ players: [{ hand: [{ card: 'dread_tyrant', id: 'tyrant' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp', 'swamp'] }, {}] });
    s = resolveStack(cast(s, 'tyrant'));
    expect(zoneOf(s, 'tyrant')).toBe('battlefield');
    expect(life(s, 0)).toBe(18);
  });

  it('Duskmire Shade grows +1/+1 for each {B}', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'duskmire_shade', id: 'shade' }, 'swamp', 'swamp', 'swamp'] }, {}] });
    for (let i = 0; i < 3; i++) s = resolveStack(activate(s, 'shade'));
    expect([getPower(s, 'shade'), getToughness(s, 'shade')]).toEqual([4, 4]);
  });

  it('Reefshell Crab has defender and cannot attack', () => {
    const s = passTo(scenario({ players: [{ battlefield: [{ card: 'reefshell_crab', id: 'crab' }, { card: 'beacon_squire', id: 'squire' }] }, {}] }), 'declareAttackers');
    expect(getLegalActions(s).map((action) => (action.type === 'declareAttackers' ? action.attackers : null))).toEqual([[], ['squire']]);
  });
});

describe('Stormglass: flash and "whenever you cast an instant or sorcery spell"', () => {
  it('puts the trigger above the spell, so it resolves first', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'static_jolt', id: 'jolt' }], battlefield: ['mountain', { card: 'arc_initiate', id: 'initiate' }] }, {}],
    });
    s = cast(s, 'jolt', [{ player: 1 }]);
    expect(s.stack.map((item) => item.kind)).toEqual(['spell', 'trigger']);
    s = pass(pass(s));
    expect([getPower(s, 'initiate'), getToughness(s, 'initiate'), s.stack.length]).toEqual([3, 3, 1]);
    s = resolveStack(s);
    expect([life(s, 1), s.players[0].hand.length]).toEqual([19, 1]);
    s = passToStep(s, 'main1', s.turn + 1);
    expect([getPower(s, 'initiate'), getToughness(s, 'initiate')]).toEqual([2, 2]);
  });

  it('ignores creature spells and the opponent’s spells', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'kiln_sprite', id: 'sprite' }], battlefield: ['mountain', { card: 'arc_initiate', id: 'initiate' }] },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    s = cast(pass(cast(s, 'sprite')), 'snap', [{ player: 0 }]);
    expect(s.stack.map((item) => item.kind)).toEqual(['spell', 'spell']);
  });

  it('Galvanic Channeler deals 1 damage to the opponent for each instant or sorcery', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'stormflare', id: 'flare' }], battlefield: ['mountain', 'mountain', { card: 'galvanic_channeler', id: 'channeler' }] }, {}],
    });
    s = cast(s, 'flare', [{ player: 1 }]);
    expect(getLegalActions(s)).toEqual([{ type: 'chooseTargets', player: 0, targets: [{ player: 1 }] }]);
    s = resolveStack(chooseTargets(s, [{ player: 1 }]));
    expect(life(s, 1)).toBe(16);
  });

  it('Stormglass Drake keeps a +1/+1 counter for each instant or sorcery', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'static_jolt', id: 'j1' }, { card: 'static_jolt', id: 'j2' }],
          battlefield: ['mountain', 'mountain', { card: 'stormglass_drake', id: 'drake' }],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'j1', [{ player: 1 }]));
    s = resolveStack(cast(s, 'j2', [{ player: 1 }]));
    expect([s.cards.drake?.counters, getPower(s, 'drake'), getToughness(s, 'drake')]).toEqual([2, 4, 5]);
    s = passToStep(s, 'main1', s.turn + 2);
    expect([getPower(s, 'drake'), getToughness(s, 'drake')]).toEqual([4, 5]);
  });

  it('a creature with flash cast after attackers are declared can block', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'glassreef_sentinel', id: 'sentinel' }], battlefield: ['island', 'island', 'island'] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = pass(attack(s, ['hound']));
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    s = resolveStack(cast(s, 'sentinel'));
    s = finishCombat(block(s, [{ blocker: 'sentinel', attacker: 'hound' }]));
    expect([zoneOf(s, 'hound'), zoneOf(s, 'sentinel'), life(s, 0)]).toEqual(['graveyard', 'battlefield', 20]);
  });

  it('Wavecrest Mystic flashes in and returns an attacker to its owner’s hand', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'wavecrest_mystic', id: 'mystic' }], battlefield: ['island', 'island', 'island', 'island'] },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }, { card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = pass(attack(s, ['rhino', 'hound']));
    s = pass(pass(cast(s, 'mystic')));
    expect(getLegalActions(s)).toEqual([
      { type: 'chooseTargets', player: 0, targets: [{ card: 'rhino' }] },
      { type: 'chooseTargets', player: 0, targets: [{ card: 'hound' }] },
    ]);
    s = resolveStack(chooseTargets(s, [{ card: 'rhino' }]));
    expect([zoneOf(s, 'rhino'), s.combat?.attackers]).toEqual(['hand', ['hound']]);
  });
});

describe('Sunmeadow: +1/+1 counters and team pumps', () => {
  it('Wild Blossom puts two +1/+1 counters that last until the creature leaves the battlefield', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'wild_blossom', id: 'blossom' }, { card: 'undertow', id: 'undertow' }],
          battlefield: ['forest', 'forest', 'island', 'island', { card: 'test_bear', id: 'bear' }],
        },
        {},
      ],
    });
    s = pass(cast(s, 'blossom', [{ card: 'bear' }]));
    s = act(s, { type: 'pass', player: 1 });
    expect(s.events).toContainEqual({ t: 'addCounters', card: 'bear', amount: 2 });
    expect(describeEvent(s, { t: 'addCounters', card: 'bear', amount: 2 }, 0)).toBe('Your Test Bear gets 2 +1/+1 counters.');
    expect(describeState(s)).toContain('Test Bear(bear) 4/4 [2 +1/+1 counters]');
    s = passToStep(s, 'main1', s.turn + 2);
    expect([s.cards.bear?.counters, getPower(s, 'bear'), getToughness(s, 'bear')]).toEqual([2, 4, 4]);
    s = resolveStack(cast(s, 'undertow', [{ card: 'bear' }]));
    expect([zoneOf(s, 'bear'), s.cards.bear?.counters]).toEqual(['hand', 0]);
  });

  it('counts counters against damage and -N/-N like printed power and toughness', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'withering_touch', id: 'touch' }, { card: 'ember_snap', id: 'snap' }], battlefield: ['swamp', 'mountain'] },
        { battlefield: [{ card: 'test_bear', id: 'bear', counters: 2 }] },
      ],
    });
    s = resolveStack(cast(s, 'touch', [{ card: 'bear' }]));
    expect([getPower(s, 'bear'), getToughness(s, 'bear')]).toEqual([2, 2]);
    s = resolveStack(cast(s, 'snap', [{ card: 'bear' }]));
    expect([zoneOf(s, 'bear'), s.cards.bear?.counters]).toEqual(['graveyard', 0]);
  });

  it('reports counters left on a card off the battlefield', () => {
    const s = scenario({ players: [{ hand: [{ card: 'test_bear', id: 'bear' }] }, {}] });
    const broken = structuredClone(s);
    (broken.cards.bear as CardInstance).counters = 1;
    expect(checkInvariants(broken)).toContain('bear keeps battlefield state outside the battlefield');
  });

  it('Bloomcaller Druid grows itself or another creature you control, never the opponent’s', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'bloomcaller_druid', id: 'druid' }], battlefield: ['forest', 'forest', { card: 'test_bear', id: 'bear' }] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = pass(pass(cast(s, 'druid')));
    expect(getLegalActions(s)).toEqual([
      { type: 'chooseTargets', player: 0, targets: [{ card: 'bear' }] },
      { type: 'chooseTargets', player: 0, targets: [{ card: 'druid' }] },
    ]);
    s = resolveStack(chooseTargets(s, [{ card: 'bear' }]));
    expect([getPower(s, 'bear'), getToughness(s, 'bear'), getPower(s, 'druid')]).toEqual([3, 3, 1]);
  });

  it('Hopeful Squire gets its counter when it attacks, before blockers are declared', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'hopeful_squire', id: 'squire' }] }, { battlefield: [{ card: 'test_bear', id: 'bear' }] }] });
    s = passTo(attack(s, ['squire']), 'declareBlockers');
    expect([getPower(s, 'squire'), getToughness(s, 'squire')]).toEqual([2, 2]);
    s = finishCombat(block(s, [{ blocker: 'bear', attacker: 'squire' }]));
    expect([zoneOf(s, 'squire'), zoneOf(s, 'bear')]).toEqual(['graveyard', 'graveyard']);
  });

  it('Warren Hare passes a counter on when it dies, and its trigger is skipped with no creature left', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 's1' }, { card: 'ember_snap', id: 's2' }], battlefield: ['mountain', 'mountain'] },
        { battlefield: [{ card: 'warren_hare', id: 'hare' }, { card: 'warren_hare', id: 'last' }] },
      ],
    });
    s = pass(pass(cast(s, 's1', [{ card: 'hare' }])));
    expect(getLegalActions(s)).toEqual([{ type: 'chooseTargets', player: 1, targets: [{ card: 'last' }] }]);
    s = resolveStack(chooseTargets(s, [{ card: 'last' }]));
    expect([getPower(s, 'last'), getToughness(s, 'last')]).toEqual([2, 2]);
    s = resolveStack(cast(s, 's2', [{ card: 'last' }]));
    expect([zoneOf(s, 'last'), s.pending]).toEqual(['graveyard', { kind: 'priority', player: 0 }]);
  });

  it('Sunantler Monarch and Harvest Hymn put a counter on each creature you control', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'sunantler_monarch', id: 'monarch' }, { card: 'harvest_hymn', id: 'hymn' }],
          battlefield: [...Array(5).fill('forest'), ...Array(5).fill('plains'), { card: 'test_bear', id: 'bear' }],
        },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = resolveStack(cast(s, 'monarch'));
    expect(['bear', 'monarch', 'hound'].map((id) => s.cards[id]?.counters)).toEqual([1, 1, 0]);
    s = resolveStack(cast(s, 'hymn'));
    expect(['bear', 'monarch', 'hound'].map((id) => s.cards[id]?.counters)).toEqual([2, 2, 0]);
    expect([getPower(s, 'monarch'), life(s, 0)]).toEqual([6, 22]);
  });

  it('Pack Pounce grows your creature before it fights, so it survives', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'pack_pounce', id: 'pounce' }], battlefield: ['forest', 'forest', { card: 'test_bear', id: 'bear' }] },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    s = resolveStack(cast(s, 'pounce', [{ card: 'bear' }, { card: 'adept' }]));
    expect([zoneOf(s, 'bear'), zoneOf(s, 'adept'), s.cards.bear?.damage, getToughness(s, 'bear')]).toEqual(['battlefield', 'graveyard', 2, 3]);
  });

  it('Rally the Meadow pumps only your creatures, until end of turn', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'rally_the_meadow', id: 'rally' }], battlefield: ['plains', 'plains', { card: 'test_bear', id: 'bear' }, { card: 'warren_hare', id: 'hare' }] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = resolveStack(cast(s, 'rally'));
    expect(['bear', 'hare', 'hound'].map((id) => [getPower(s, id), getToughness(s, id)])).toEqual([[3, 3], [2, 2], [2, 1]]);
    s = passToStep(s, 'main1', s.turn + 1);
    expect(['bear', 'hare'].map((id) => [getPower(s, id), getToughness(s, id)])).toEqual([[2, 2], [1, 1]]);
  });

  it('Sunmeadow Herald gives every creature you control +1/+0 when it attacks', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'sunmeadow_herald', id: 'herald' }, { card: 'test_bear', id: 'bear' }] }, {}] });
    s = finishCombat(attack(s, ['herald']));
    expect([getPower(s, 'herald'), getPower(s, 'bear'), getToughness(s, 'bear'), life(s, 1)]).toEqual([3, 3, 2, 17]);
  });
});
