import { describe, expect, it } from 'vitest';
import {
  EVOLVE_TRIGGER,
  PROWESS_TRIGGER,
  UNDYING_TRIGGER,
  activatedText,
  blockOptions,
  castBlocker,
  checkInvariants,
  createScenario,
  describeEvent,
  describeEventParts,
  describeState,
  eligibleAttackers,
  getCardDef,
  getKeywords,
  getLegalActions,
  getPower,
  getToughness,
  tryApplyAction,
  type CardInstance,
  type GameEvent,
  type GameState,
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
  playLand,
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
    expect(castBlocker(s, 0, 'snap')).toEqual({ code: 'notEnoughMana' });
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

describe('event text', () => {
  const s = scenario({
    players: [
      { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: [{ card: 'test_bear', id: 'bear' }, { card: 'timberland_rhino', id: 'rhino' }] },
      { hand: [{ card: 'forest', id: 'secret' }], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
    ],
  });
  const snap = { card: 'snap', name: 'Chasquido de brasas' };
  const bear = { card: 'bear', name: 'Test Bear' };
  const rhino = { card: 'rhino', name: 'Rinoceronte forestal' };
  const elf = { card: 'elf', name: 'Elfa del soto' };

  it('names each card as a mention of it, in the words of the line', () => {
    const cast: GameEvent = { t: 'cast', player: 0, card: 'snap', targets: [{ card: 'elf' }] };
    expect(describeEventParts(s, cast, 0)).toEqual(['Lanzas ', snap, ' sobre ', elf, ' del rival.']);
    expect(describeEvent(s, cast, 0)).toBe('Lanzas Chasquido de brasas sobre Elfa del soto del rival.');
    expect(describeEventParts(s, { t: 'attack', player: 0, attackers: ['bear', 'rhino'] }, 0)).toEqual(['Atacas con ', bear, ' y ', rhino, '.']);
    const blocks = [{ blocker: 'elf', attacker: 'rhino' }];
    expect(describeEventParts(s, { t: 'block', player: 1, blocks }, 0)).toEqual(['El rival bloquea: ', elf, ' → ', rhino, '.']);
    const damage: GameEvent = { t: 'damage', source: 'rhino', target: { player: 1 }, amount: 4, combat: true };
    expect(describeEventParts(s, damage, 0)).toEqual(['Tu ', rhino, ' hace 4 puntos de daño al rival.']);
    expect(describeEventParts(s, { t: 'fight', a: 'bear', b: 'elf' }, 0)).toEqual(['Tu ', bear, ' lucha contra ', elf, ' del rival.']);
    expect(describeEventParts(s, { t: 'dies', card: 'elf', player: 1 }, 0)).toEqual(['Muere ', elf, ' del rival.']);
  });

  it('keeps a line without cards in one piece, and never names a card the viewer has not seen', () => {
    expect(describeEventParts(s, { t: 'turn', turn: 3, player: 1 }, 0)).toEqual(['Turno 3 — turno del rival.']);
    expect(describeEventParts(s, { t: 'draw', player: 1, card: 'secret' }, 0)).toEqual(['El rival roba una carta.']);
    expect(describeEventParts(s, { t: 'draw', player: 0, card: 'snap' }, 0)).toEqual(['Robas ', snap, '.']);
    expect(describeEventParts(s, { t: 'resolve', item: { id: 'x', kind: 'spell', card: 'snap', controller: 0, targets: [] } }, 0)).toBeNull();
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
    expect(describeEvent(s, { t: 'addCounters', card: 'bear', amount: 2 }, 0)).toBe('Tu Test Bear recibe 2 contadores +1/+1.');
    expect(describeState(s)).toContain('Test Bear(bear) 4/4 [2 contadores +1/+1]');
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

function tokensOf(s: GameState, player: 0 | 1, def: string): string[] {
  return s.players[player].battlefield.filter((id) => s.cards[id]?.def === def);
}

describe('Brightforge: creature tokens and "whenever another creature you control enters"', () => {
  it('Raise the Banners creates two 1/1 Soldier tokens, summoning sick like any new creature', () => {
    let s = scenario({ players: [{ hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] }, {}] });
    s = resolveStack(cast(s, 'banners'));
    const tokens = tokensOf(s, 0, 'soldier_token');
    expect(tokens.map((id) => [getPower(s, id), getToughness(s, id), s.cards[id]?.summoningSick])).toEqual([
      [1, 1, true],
      [1, 1, true],
    ]);
    expect(s.events.filter((event) => event.t === 'create')).toEqual(tokens.map((card) => ({ t: 'create', player: 0, card })));
    expect(describeEvent(s, { t: 'create', player: 0, card: tokens[0] as string }, 0)).toBe('Creas una ficha de Soldado.');
  });

  it('a token that dies goes to the graveyard long enough to die, then ceases to exist; so does one returned to hand', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'undertow', id: 'undertow' }], battlefield: ['mountain', 'island', 'island'] },
        { battlefield: [{ card: 'soldier_token', id: 't1' }, { card: 'soldier_token', id: 't2' }] },
      ],
    });
    s = resolveStack(cast(s, 'snap', [{ card: 't1' }]));
    expect(s.events).toContainEqual({ t: 'dies', card: 't1', player: 1 });
    expect([zoneOf(s, 't1'), s.players[1].graveyard]).toEqual(['gone', []]);
    expect(describeEvent(s, { t: 'dies', card: 't1', player: 1 }, 0)).toBe('Muere Soldado del rival.');
    s = resolveStack(cast(s, 'undertow', [{ card: 't2' }]));
    expect([zoneOf(s, 't2'), s.players[1].hand]).toEqual(['gone', []]);
  });

  it('tokens exist only on the battlefield', () => {
    expect(() => createScenario({ players: [{ hand: ['soldier_token'] }, {}] })).toThrow(/can only be on the battlefield/);
    const s = scenario({ players: [{ hand: [{ card: 'test_bear', id: 'bear' }], battlefield: [{ card: 'soldier_token', id: 'token' }] }, {}] });
    const inHand = structuredClone(s);
    inHand.players[0].battlefield = [];
    inHand.players[0].hand.push('token');
    (inHand.cards.token as CardInstance).zone = 'hand';
    expect(checkInvariants(inHand)).toContain('token token exists outside the battlefield');
    const vanished = structuredClone(s);
    vanished.players[0].hand = [];
    (vanished.cards.bear as CardInstance).zone = 'gone';
    expect(checkInvariants(vanished)).toContain('bear ceased to exist but is not a token');
  });

  it('Forge Cadet gets a +1/+1 counter for each other creature entering under your control, tokens included', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'muster_sergeant', id: 'sergeant' }], battlefield: ['plains', 'plains', { card: 'forge_cadet', id: 'cadet' }] },
        { hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] },
      ],
    });
    s = resolveStack(cast(s, 'sergeant'));
    expect([s.cards.cadet?.counters, getPower(s, 'cadet'), tokensOf(s, 0, 'soldier_token').length]).toEqual([2, 3, 1]);
    s = resolveStack(cast(pass(s), 'banners'));
    expect([s.cards.cadet?.counters, tokensOf(s, 1, 'soldier_token').length]).toEqual([2, 2]);
  });

  it("Kindling Caller's Elemental token has haste and attacks the turn it is created", () => {
    let s = scenario({ players: [{ hand: [{ card: 'kindling_caller', id: 'caller' }], battlefield: ['mountain', 'mountain'] }, {}] });
    s = resolveStack(cast(s, 'caller'));
    const [token] = tokensOf(s, 0, 'elemental_token');
    s = passTo(s, 'declareAttackers');
    expect(eligibleAttackers(s)).toEqual([token]);
    s = finishCombat(act(s, { type: 'declareAttackers', player: 0, attackers: [token as string] }));
    expect(life(s, 1)).toBe(19);
  });

  it('Hammerfall Raider creates an Elemental whenever it attacks; the token joins the next attack, not this one', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'hammerfall_raider', id: 'raider' }] }, {}] });
    s = resolveStack(attack(s, ['raider']));
    expect([tokensOf(s, 0, 'elemental_token').length, s.combat?.attackers]).toEqual([1, ['raider']]);
    s = finishCombat(s);
    expect(life(s, 1)).toBe(18);
  });

  it('Brightforge Warlord gives each creature you control +1/+0 and haste until end of turn', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'brightforge_warlord', id: 'warlord' }],
          battlefield: ['mountain', 'mountain', 'mountain', 'plains', 'plains', { card: 'forge_cadet', id: 'cadet', sick: true }],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'warlord'));
    expect([getPower(s, 'warlord'), getToughness(s, 'warlord'), getKeywords(s, 'warlord')]).toEqual([5, 4, ['haste']]);
    expect([getPower(s, 'cadet'), getToughness(s, 'cadet')]).toEqual([3, 2]);
    s = passTo(s, 'declareAttackers');
    expect(eligibleAttackers(s)).toEqual(['cadet', 'warlord']);
    s = finishCombat(act(s, { type: 'declareAttackers', player: 0, attackers: ['cadet', 'warlord'] }));
    expect(life(s, 1)).toBe(12);
    s = passToStep(s, 'main1', s.turn + 2);
    expect([getPower(s, 'warlord'), getKeywords(s, 'warlord')]).toEqual([4, []]);
  });

  it('Charge of the Forge gives your creatures +1/+0 and first strike, so they strike before their blockers', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'charge_of_the_forge', id: 'charge' }], battlefield: ['mountain', 'plains', { card: 'soldier_token', id: 'soldier' }] },
        { battlefield: [{ card: 'test_bear', id: 'bear' }] },
      ],
    });
    s = block(attack(s, ['soldier']), [{ blocker: 'bear', attacker: 'soldier' }]);
    s = resolveStack(cast(s, 'charge'));
    expect([getPower(s, 'soldier'), getKeywords(s, 'soldier')]).toEqual([2, ['firstStrike']]);
    s = finishCombat(s);
    expect([zoneOf(s, 'bear'), zoneOf(s, 'soldier')]).toEqual(['graveyard', 'battlefield']);
  });
});

describe('Mistgrave: skulk, discards and "whenever this creature deals combat damage to a player"', () => {
  it('skulk: creatures with greater power cannot block it, measured when blockers are declared', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'fogslip_thief', id: 'thief' }] },
        { battlefield: [{ card: 'test_bear', id: 'bear' }, { card: 'test_giant', id: 'giant' }] },
      ],
    });
    s = passTo(attack(s, ['thief']), 'declareBlockers');
    expect(blockOptions(s)).toEqual({ bear: ['thief'] });
    expect(tryApplyAction(s, { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'giant', attacker: 'thief' }] })).toEqual({
      ok: false,
      error: 'giant no puede bloquear a thief',
      refusal: { code: 'cannotBlock', blocker: 'giant', attacker: 'thief' },
    });
    let pumped = scenario({
      players: [
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'fogslip_thief', id: 'thief' }] },
        { battlefield: [{ card: 'test_giant', id: 'giant' }] },
      ],
    });
    pumped = passTo(resolveStack(cast(attack(pumped, ['thief']), 'surge', [{ card: 'thief' }])), 'declareBlockers');
    expect(blockOptions(pumped)).toEqual({ giant: ['thief'] });
  });

  it('Memory Leech makes the opponent choose a card to discard, then play goes on', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'memory_leech', id: 'leech' }], battlefield: ['swamp', 'swamp', 'swamp'] },
        { hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }] },
      ],
    });
    s = pass(pass(pass(pass(cast(s, 'leech')))));
    expect(s.pending).toEqual({ kind: 'discard', player: 1, count: 1, source: 'leech' });
    expect(getLegalActions(s)).toEqual([
      { type: 'discard', player: 1, cards: ['f'] },
      { type: 'discard', player: 1, cards: ['snap'] },
    ]);
    s = act(s, { type: 'discard', player: 1, cards: ['snap'] });
    expect([zoneOf(s, 'snap'), s.players[1].hand, s.pending]).toEqual(['graveyard', ['f'], { kind: 'priority', player: 0 }]);
    expect(describeEvent(s, { t: 'discard', player: 1, card: 'snap' }, 0)).toBe('El rival descarta Chasquido de brasas.');
  });

  it('an effect asks for no more cards than the hand holds, and for none from an empty hand', () => {
    const rob = (hand: string[]): GameState =>
      resolveStack(cast(scenario({ players: [{ hand: [{ card: 'rob_the_mind', id: 'rob' }], battlefield: ['swamp', 'swamp', 'swamp'] }, { hand }] }), 'rob'));
    expect(rob(['forest', 'forest', 'forest']).pending).toEqual({ kind: 'discard', player: 1, count: 2, source: 'rob' });
    expect(rob(['forest']).pending).toEqual({ kind: 'discard', player: 1, count: 1, source: 'rob' });
    expect(rob([]).pending).toEqual({ kind: 'priority', player: 0 });
  });

  it('Sift the Depths draws two cards, then you discard one, in the middle of your turn', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'sift_the_depths', id: 'sift' }], battlefield: ['island', 'island'], library: [{ card: 'forest', id: 'a' }, { card: 'island', id: 'b' }] }, {}],
    });
    s = resolveStack(cast(s, 'sift'));
    expect([s.pending, s.players[0].hand]).toEqual([{ kind: 'discard', player: 0, count: 1, source: 'sift' }, ['a', 'b']]);
    s = act(s, { type: 'discard', player: 0, cards: ['a'] });
    expect([s.players[0].hand, s.step, s.pending]).toEqual([['b'], 'main1', { kind: 'priority', player: 0 }]);
  });

  it('combat damage to a player: Hushwing Bat makes that player discard, Fogslip Thief draws a card', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'fogslip_thief', id: 'thief' }, { card: 'hushwing_bat', id: 'bat' }], library: [{ card: 'island', id: 'top' }] },
        { hand: [{ card: 'forest', id: 'f' }] },
      ],
    });
    s = passTo(attack(s, ['thief', 'bat']), 'discard');
    expect(s.pending).toEqual({ kind: 'discard', player: 1, count: 1, source: 'bat' });
    s = resolveStack(act(s, { type: 'discard', player: 1, cards: ['f'] }));
    expect([life(s, 1), s.players[0].hand, zoneOf(s, 'f')]).toEqual([17, ['top'], 'graveyard']);
  });

  it('triggers once per combat damage step that hits the player, so twice with double strike', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'test_double_hitter', id: 'hitter' }] }, {}] });
    s = finishCombat(attack(s, ['hitter']));
    expect([life(s, 1), s.players[0].hand.length]).toEqual([18, 2]);
  });

  it('only combat damage dealt to a player triggers it', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'fogslip_thief', id: 'thief' }] }, { battlefield: [{ card: 'test_bear', id: 'bear' }] }] });
    s = finishCombat(block(attack(s, ['thief']), [{ blocker: 'bear', attacker: 'thief' }]));
    expect([s.players[0].hand, zoneOf(s, 'thief'), zoneOf(s, 'bear')]).toEqual([[], 'graveyard', 'graveyard']);
  });

  it('Drag Below returns a creature to its owner’s hand, then that player discards a card, which may be that creature', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'drag_below', id: 'drag' }], battlefield: ['island', 'swamp', 'swamp'] },
        { hand: [{ card: 'forest', id: 'f' }], battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    s = resolveStack(cast(s, 'drag', [{ card: 'rhino' }]));
    expect([zoneOf(s, 'rhino'), s.pending]).toEqual(['hand', { kind: 'discard', player: 1, count: 1, source: 'drag' }]);
    s = act(s, { type: 'discard', player: 1, cards: ['rhino'] });
    expect([zoneOf(s, 'rhino'), s.players[1].hand]).toEqual(['graveyard', ['f']]);
  });
});

describe('Gloamwood: undying, sacrifice and "whenever another creature you control dies"', () => {
  it('an undying creature returns with a +1/+1 counter the first time it dies, and stays dead the second time', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 's1' }, { card: 'ember_snap', id: 's2' }], battlefield: ['mountain', 'mountain'] },
        { battlefield: [{ card: 'gravebloom_sprout', id: 'sprout' }] },
      ],
    });
    s = pass(pass(cast(s, 's1', [{ card: 'sprout' }])));
    expect([zoneOf(s, 'sprout'), s.stack.map((item) => (item.kind === 'trigger' ? item.ability : item.kind))]).toEqual(['graveyard', [UNDYING_TRIGGER]]);
    s = resolveStack(s);
    expect([zoneOf(s, 'sprout'), s.cards.sprout?.counters, getPower(s, 'sprout'), s.cards.sprout?.summoningSick]).toEqual([
      'battlefield',
      1,
      2,
      true,
    ]);
    expect(describeEvent(s, { t: 'return', player: 1, card: 'sprout' }, 0)).toBe('Retoño de la tumba del rival regresa al campo de batalla.');
    s = resolveStack(cast(s, 's2', [{ card: 'sprout' }]));
    expect([zoneOf(s, 'sprout'), s.stack, s.cards.sprout?.counters]).toEqual(['graveyard', [], 0]);
  });

  it('Bloodspore Thrall is sacrificed as the cost: its undying trigger resolves before the ability', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'bloodspore_thrall', id: 'thrall' }] }, {}] });
    s = activate(s, 'thrall');
    expect([zoneOf(s, 'thrall'), s.stack.map((item) => item.kind)]).toEqual(['graveyard', ['activated', 'trigger']]);
    s = pass(pass(s));
    expect([zoneOf(s, 'thrall'), s.cards.thrall?.counters, life(s, 1)]).toEqual(['battlefield', 1, 20]);
    s = resolveStack(s);
    expect(life(s, 1)).toBe(19);
    s = resolveStack(activate(s, 'thrall'));
    expect([zoneOf(s, 'thrall'), life(s, 1)]).toEqual(['graveyard', 18]);
  });

  it('a creature that leaves the battlefield and returns is a new object: a spell aimed at it fizzles', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'grave_sentence', id: 'sentence' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp'] },
        { battlefield: [{ card: 'bloodspore_thrall', id: 'thrall' }] },
      ],
    });
    s = activate(pass(cast(s, 'sentence', [{ card: 'thrall' }])), 'thrall');
    expect(s.stack.map((item) => item.lost ?? [])).toEqual([[0], [], []]);
    s = resolveStack(s);
    expect(s.events).toContainEqual({ t: 'fizzle', item: expect.objectContaining({ kind: 'spell', card: 'sentence' }) });
    expect([zoneOf(s, 'thrall'), s.cards.thrall?.counters, life(s, 0), zoneOf(s, 'sentence')]).toEqual(['battlefield', 1, 19, 'graveyard']);
  });

  it('Bonewood Stalker sacrifices itself to give a creature -2/-2, and the ability resolves without its source', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'bonewood_stalker', id: 'stalker' }] }, { battlefield: [{ card: 'test_bear', id: 'bear' }] }] });
    s = resolveStack(activate(s, 'stalker', 0, [{ card: 'bear' }]));
    expect([zoneOf(s, 'stalker'), zoneOf(s, 'bear')]).toEqual(['graveyard', 'graveyard']);
    expect(activatedText(getCardDef('bonewood_stalker'), 0)).toBe('Sacrificar esta criatura: La criatura objetivo obtiene -2/-2 hasta el final del turno.');
  });

  it('Rotwing Crow drains the opponent for each other creature of yours that dies, one dying at the same time included', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'rotwing_crow', id: 'crowA' }, { card: 'rotwing_crow', id: 'crowB' }] },
        { battlefield: [{ card: 'test_giant', id: 'giant' }] },
      ],
    });
    s = block(attack(s, ['giant']), [
      { blocker: 'crowA', attacker: 'giant' },
      { blocker: 'crowB', attacker: 'giant' },
    ]);
    s = finishCombat(s);
    expect([zoneOf(s, 'crowA'), zoneOf(s, 'crowB'), life(s, 1)]).toEqual(['graveyard', 'graveyard', 18]);
  });

  it('Rootgnaw Boar grows when another creature of yours dies, not when the opponent’s does', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 's1' }, { card: 'ember_snap', id: 's2' }],
          battlefield: ['mountain', 'mountain', { card: 'test_bear', id: 'mine' }, { card: 'rootgnaw_boar', id: 'boar' }],
        },
        { battlefield: [{ card: 'test_bear', id: 'theirs' }] },
      ],
    });
    s = resolveStack(cast(s, 's1', [{ card: 'theirs' }]));
    s = resolveStack(cast(s, 's2', [{ card: 'mine' }]));
    expect([s.cards.boar?.counters, getPower(s, 'boar')]).toEqual([1, 2]);
  });

  it('Sporecap Shambler leaves two Saprolings, and Gloamwood Elder plants one more for it', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        { battlefield: [{ card: 'sporecap_shambler', id: 'shambler' }, { card: 'gloamwood_elder', id: 'elder' }] },
      ],
    });
    s = resolveStack(cast(s, 'snap', [{ card: 'shambler' }]));
    expect(tokensOf(s, 1, 'saproling_token')).toHaveLength(3);
  });

  it('Venom Duel gives your creature deathtouch before it fights, so a 1/1 Saproling kills a 5/5', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'venom_duel', id: 'duel' }], battlefield: ['swamp', 'forest', 'forest', { card: 'saproling_token', id: 'sap' }] },
        { battlefield: [{ card: 'test_giant', id: 'giant' }] },
      ],
    });
    s = resolveStack(cast(s, 'duel', [{ card: 'sap' }, { card: 'giant' }]));
    expect([zoneOf(s, 'giant'), zoneOf(s, 'sap')]).toEqual(['graveyard', 'gone']);
  });

  it('Nightshade Tonic grants +1/+1 and deathtouch until end of turn', () => {
    let s = scenario({ players: [{ hand: [{ card: 'nightshade_tonic', id: 'tonic' }], battlefield: ['forest', 'forest', { card: 'test_bear', id: 'bear' }] }, {}] });
    s = resolveStack(cast(s, 'tonic', [{ card: 'bear' }]));
    const pump: GameEvent = { t: 'pump', card: 'bear', power: 1, toughness: 1, keywords: ['deathtouch'] };
    expect([getPower(s, 'bear'), getKeywords(s, 'bear'), s.events]).toEqual([3, ['deathtouch'], expect.arrayContaining([pump])]);
    expect(describeEvent(s, pump, 0)).toBe('Tu Test Bear obtiene +1/+1 y gana la habilidad de toque mortal hasta el final del turno.');
    expect(describeState(s)).toContain('Test Bear(bear) 3/3');
    s = passToStep(s, 'main1', s.turn + 2);
    expect([getPower(s, 'bear'), getKeywords(s, 'bear')]).toEqual([2, []]);
  });
});

describe('Vesperhall: "whenever you gain life", lifelink and life drain', () => {
  it('Vesper Novice gets a +1/+1 counter each time you gain life', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'penance', id: 'penance' }], battlefield: ['plains', 'swamp', { card: 'vesper_novice', id: 'novice' }] },
        { battlefield: [{ card: 'test_bear', id: 'bear' }] },
      ],
    });
    s = resolveStack(cast(s, 'penance', [{ card: 'bear' }]));
    expect([zoneOf(s, 'bear'), life(s, 0), s.cards.novice?.counters, getPower(s, 'novice')]).toEqual(['graveyard', 22, 1, 2]);
  });

  it('is not triggered when the opponent gains life', () => {
    let s = scenario({
      activePlayer: 1,
      players: [{ battlefield: [{ card: 'vesper_novice', id: 'novice' }] }, { hand: [{ card: 'test_heal', id: 'heal' }], battlefield: ['forest'] }],
    });
    s = resolveStack(cast(s, 'heal'));
    expect([life(s, 1), s.cards.novice?.counters]).toEqual([23, 0]);
  });

  it('lifelink damage dealt at the same time is one life gain, so it triggers once', () => {
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'chantry_guard', id: 'guard' },
            { card: 'ghostlit_penitent', id: 'penitent' },
            { card: 'vesper_novice', id: 'novice' },
          ],
        },
        {},
      ],
    });
    s = finishCombat(attack(s, ['guard', 'penitent']));
    expect([life(s, 0), life(s, 1), s.cards.novice?.counters]).toEqual([23, 17, 1]);
  });

  it('Sanguine Chorister drains the opponent whenever you gain life, so Tithe Collector drains twice', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'tithe_collector', id: 'collector' }], battlefield: ['swamp', 'swamp', { card: 'sanguine_chorister', id: 'chorister' }] },
        {},
      ],
    });
    s = resolveStack(cast(s, 'collector'));
    expect([life(s, 0), life(s, 1)]).toEqual([21, 18]);
  });

  it('Vesperhall Matriarch grows when Blood Tithe drains the opponent', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'blood_tithe', id: 'tithe' }], battlefield: ['swamp', 'swamp', 'swamp', { card: 'vesperhall_matriarch', id: 'matriarch' }] },
        {},
      ],
    });
    s = resolveStack(cast(s, 'tithe'));
    expect([life(s, 0), life(s, 1), s.players[0].hand.length, s.cards.matriarch?.counters]).toEqual([22, 18, 1, 1]);
  });

  it('Censer Bearer and Rite of Lanterns create white and black Spirit tokens with flying', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'censer_bearer', id: 'censer' }, { card: 'rite_of_lanterns', id: 'rite' }],
          battlefield: ['plains', 'plains', 'plains', 'plains', 'plains', 'plains'],
        },
        {},
      ],
    });
    s = resolveStack(cast(resolveStack(cast(s, 'censer')), 'rite'));
    const spirits = tokensOf(s, 0, 'spirit_token');
    expect(spirits).toHaveLength(3);
    expect(spirits.map((id) => getKeywords(s, id))).toEqual([['flying'], ['flying'], ['flying']]);
    expect(getCardDef('spirit_token').colors).toEqual(['W', 'B']);
  });
});

describe('Cindermaw: "if an opponent was dealt damage this turn"', () => {
  it('Blistering Hellion enters with two +1/+1 counters once the opponent was dealt damage this turn, and as a 3/2 before', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'blistering_hellion', id: 'h1' }, { card: 'blistering_hellion', id: 'h2' }, { card: 'bloodfire_bolt', id: 'bolt' }],
          battlefield: ['mountain', 'mountain', 'mountain', 'mountain', 'mountain', 'mountain', 'swamp', 'swamp', 'swamp'],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'h1'));
    expect([s.cards.h1?.counters, s.players[1].damagedThisTurn]).toEqual([0, false]);
    s = resolveStack(cast(s, 'bolt', [{ player: 1 }]));
    expect([life(s, 1), s.players[1].damagedThisTurn]).toEqual([17, true]);
    s = pass(pass(cast(s, 'h2')));
    expect(s.stack.map((item) => item.kind)).toEqual(['trigger']);
    s = resolveStack(s);
    expect([s.cards.h2?.counters, getPower(s, 'h2'), getToughness(s, 'h2'), s.cards.h1?.counters]).toEqual([2, 5, 4, 0]);
  });

  it('losing life is not being dealt damage, and damage to yourself does not count', () => {
    let s = scenario({
      players: [
        {
          damagedThisTurn: true,
          hand: [{ card: 'bloodhungry_ghoul', id: 'ghoul' }],
          battlefield: ['swamp', 'swamp', { card: 'bloodspore_thrall', id: 'thrall' }],
        },
        {},
      ],
    });
    s = resolveStack(activate(s, 'thrall'));
    expect([life(s, 1), s.players[1].damagedThisTurn]).toEqual([19, false]);
    s = resolveStack(cast(s, 'ghoul'));
    expect(s.cards.ghoul?.counters).toBe(0);
  });

  it('combat damage counts, and the wound is forgotten when the next turn begins', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'bloodhungry_ghoul', id: 'ghoul' }], battlefield: ['swamp', 'swamp', { card: 'test_bear', id: 'bear' }] }, {}],
    });
    s = finishCombat(attack(s, ['bear']));
    expect([life(s, 1), s.players[1].damagedThisTurn]).toEqual([18, true]);
    s = resolveStack(cast(s, 'ghoul'));
    expect([s.cards.ghoul?.counters, getPower(s, 'ghoul'), getToughness(s, 'ghoul')]).toEqual([1, 3, 2]);
    s = passToStep(s, 'main1', s.turn + 1);
    expect([s.activePlayer, s.players[1].damagedThisTurn]).toEqual([1, false]);
  });

  it('Brimstone Skirmisher deals 1 damage to the opponent as it attacks, even when it is blocked', () => {
    let s = attack(
      scenario({
        players: [
          { hand: [{ card: 'bloodhungry_ghoul', id: 'ghoul' }], battlefield: ['swamp', 'swamp', { card: 'brimstone_skirmisher', id: 'skirmisher' }] },
          { battlefield: [{ card: 'test_wall', id: 'wall' }] },
        ],
      }),
      ['skirmisher'],
    );
    pendingOf(s, 'chooseTargets');
    s = block(chooseTargets(s, [{ player: 1 }]), [{ blocker: 'wall', attacker: 'skirmisher' }]);
    s = resolveStack(cast(finishCombat(s), 'ghoul'));
    expect([life(s, 1), zoneOf(s, 'skirmisher'), s.cards.ghoul?.counters]).toEqual([19, 'battlefield', 1]);
  });

  it('Splitting Flame still burns the opponent when its creature target is gone', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'splitting_flame', id: 'flame' }], battlefield: ['mountain', 'mountain'] },
        { hand: [{ card: 'undertow', id: 'undertow' }], battlefield: ['island', 'island', { card: 'test_bear', id: 'bear' }] },
      ],
    });
    s = resolveStack(cast(pass(cast(s, 'flame', [{ card: 'bear' }, { player: 1 }])), 'undertow', [{ card: 'bear' }]));
    expect([zoneOf(s, 'bear'), life(s, 1), s.players[1].damagedThisTurn]).toEqual(['hand', 18, true]);
  });

  it('Pyre Ghast deals 2 damage to any target when it dies', () => {
    let s = scenario({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain', { card: 'pyre_ghast', id: 'ghast' }] }, {}],
    });
    s = pass(pass(cast(s, 'snap', [{ card: 'ghast' }])));
    expect(zoneOf(s, 'ghast')).toBe('graveyard');
    s = resolveStack(chooseTargets(s, [{ player: 1 }]));
    expect(life(s, 1)).toBe(18);
  });
});

describe('Deepgrove: evolve, hexproof and a creature that bites', () => {
  it('evolve: a creature entering with greater power or toughness gives a +1/+1 counter, an equal or smaller one does not', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'kelpweaver_druid', id: 'druid' }, { card: 'shoal_hatchling', id: 'second' }, { card: 'mossfin_lurker', id: 'lurker' }],
          battlefield: ['forest', 'forest', 'forest', 'forest', 'forest', 'forest', { card: 'shoal_hatchling', id: 'first' }],
        },
        {},
      ],
    });
    s = pass(pass(cast(s, 'druid')));
    expect(s.stack.map((item) => (item.kind === 'trigger' ? [item.source, item.ability] : item.kind))).toEqual([['first', EVOLVE_TRIGGER]]);
    s = resolveStack(s);
    expect([s.cards.first?.counters, getPower(s, 'first'), getToughness(s, 'first')]).toEqual([1, 2, 2]);
    s = resolveStack(cast(s, 'second'));
    expect([s.cards.first?.counters, s.cards.second?.counters]).toEqual([1, 0]);
    s = resolveStack(cast(s, 'lurker'));
    expect([s.cards.first?.counters, s.cards.second?.counters]).toEqual([2, 1]);
  });

  it('evolve ignores creatures that enter under the opponent’s control', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'shoal_hatchling', id: 'hatchling' }] },
        { hand: [{ card: 'test_giant', id: 'giant' }], battlefield: ['forest', 'forest', 'forest', 'forest', 'forest'] },
      ],
    });
    s = resolveStack(cast(s, 'giant'));
    expect([zoneOf(s, 'giant'), s.cards.hatchling?.counters]).toEqual(['battlefield', 0]);
  });

  it('hexproof: the opponent’s spells cannot target the creature, its controller’s can', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain', { card: 'test_bear', id: 'bear' }] },
        { hand: [{ card: 'adaptive_bloom', id: 'bloom' }], battlefield: ['forest', 'island', { card: 'mossfin_lurker', id: 'lurker' }] },
      ],
    });
    const snapTargets = getLegalActions(s).flatMap((action) => (action.type === 'cast' && action.card === 'snap' ? action.targets : []));
    expect(snapTargets).toEqual([{ player: 0 }, { player: 1 }, { card: 'bear' }]);
    expect(tryApplyAction(s, { type: 'cast', player: 0, card: 'snap', targets: [{ card: 'lurker' }] })).toEqual({
      ok: false,
      error: 'el objetivo 0 (lurker) no es legal',
      refusal: { code: 'illegalTarget', index: 0, target: 'lurker' },
    });
    s = resolveStack(cast(pass(cast(s, 'snap', [{ player: 1 }])), 'bloom', [{ card: 'lurker' }]));
    expect([s.cards.lurker?.counters, life(s, 1)]).toEqual([1, 18]);
  });

  it('a creature that gains hexproof in response makes the opponent’s spell lose its target', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'mountain'] },
        { hand: [{ card: 'shell_of_the_deep', id: 'shell' }], battlefield: ['forest', { card: 'tanglejaw_croc', id: 'croc' }] },
      ],
    });
    s = resolveStack(cast(pass(cast(s, 'lance', [{ card: 'croc' }])), 'shell', [{ card: 'croc' }]));
    expect(s.events).toContainEqual({ t: 'fizzle', item: expect.objectContaining({ kind: 'spell', card: 'lance' }) });
    expect([zoneOf(s, 'croc'), s.cards.croc?.damage, getPower(s, 'croc'), getKeywords(s, 'croc')]).toEqual(['battlefield', 0, 4, ['hexproof']]);
  });

  it('Snapjaw Strike: your creature deals damage equal to its power and takes none back, deathtouch included', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'snapjaw_strike', id: 'strike' }, { card: 'snapjaw_strike', id: 'strike2' }],
          battlefield: ['forest', 'forest', 'forest', 'forest', { card: 'mossfin_lurker', id: 'lurker' }, { card: 'moss_viper', id: 'viper' }],
        },
        { battlefield: [{ card: 'test_bear', id: 'bear' }, { card: 'test_giant', id: 'giant' }] },
      ],
    });
    s = resolveStack(cast(s, 'strike', [{ card: 'lurker' }, { card: 'bear' }]));
    expect([zoneOf(s, 'bear'), s.cards.lurker?.damage]).toEqual(['graveyard', 0]);
    expect(s.events).toContainEqual({ t: 'bite', a: 'lurker', b: 'bear' });
    expect(describeEvent(s, { t: 'damage', source: 'lurker', target: { card: 'bear' }, amount: 3, combat: false }, 0)).toBe(
      'Tu Pez musgoso hace 3 puntos de daño a Test Bear del rival.',
    );
    s = resolveStack(cast(s, 'strike2', [{ card: 'viper' }, { card: 'giant' }]));
    expect([zoneOf(s, 'giant'), zoneOf(s, 'viper')]).toEqual(['graveyard', 'battlefield']);
  });

  it('Kelpweaver Druid taps for green or blue', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'riptide_recall', id: 'recall' }, { card: 'forest', id: 'land' }], battlefield: [{ card: 'kelpweaver_druid', id: 'druid' }] },
        { battlefield: [{ card: 'test_bear', id: 'bear' }] },
      ],
    });
    expect(castBlocker(s, 0, 'recall')).toBeNull();
    s = resolveStack(cast(playLand(s, 'land'), 'recall', [{ card: 'bear' }]));
    expect([zoneOf(s, 'bear'), s.cards.druid?.tapped]).toEqual(['hand', true]);
  });
});

describe('Flamecrest: prowess', () => {
  it('an instant gives each creature with prowess +1/+1 until end of turn, and the trigger resolves before the spell', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'flame_cut', id: 'cut' }], battlefield: ['mountain', 'mountain', { card: 'cloister_lancer', id: 'lancer' }] },
        { battlefield: [{ card: 'test_bear', id: 'bear' }] },
      ],
    });
    s = cast(s, 'cut', [{ card: 'bear' }]);
    expect(s.stack.map((item) => (item.kind === 'trigger' ? [item.source, item.ability] : item.kind))).toEqual(['spell', ['lancer', PROWESS_TRIGGER]]);
    s = pass(pass(s));
    expect([getPower(s, 'lancer'), getToughness(s, 'lancer'), s.stack.length]).toEqual([2, 3, 1]);
    s = resolveStack(s);
    expect(zoneOf(s, 'bear')).toBe('graveyard');
    s = passToStep(s, 'main1', s.turn + 1);
    expect([getPower(s, 'lancer'), getToughness(s, 'lancer')]).toEqual([1, 2]);
  });

  it('creature spells and the opponent’s spells do not trigger it', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'temple_blade', id: 'blade' }], battlefield: ['mountain', 'mountain', { card: 'arc_initiate', id: 'initiate' }] },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    s = cast(pass(cast(s, 'blade')), 'snap', [{ player: 0 }]);
    expect(s.stack.map((item) => item.kind)).toEqual(['spell', 'spell']);
  });

  it('Flamecrest Mentor makes a Monk with prowess for each instant or sorcery, and the Monk grows with the next one', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'spark_volley', id: 'v1' }, { card: 'spark_volley', id: 'v2' }],
          battlefield: ['mountain', 'mountain', { card: 'flamecrest_mentor', id: 'mentor' }],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'v1', [{ player: 1 }]));
    const monk = s.players[0].battlefield.find((id) => s.cards[id]?.def === 'monk_token') as string;
    expect([getPower(s, 'mentor'), getToughness(s, 'mentor'), getKeywords(s, monk), getPower(s, monk), life(s, 1)]).toEqual([4, 3, ['prowess'], 2, 19]);
    s = resolveStack(cast(s, 'v2', [{ player: 1 }]));
    expect([getPower(s, monk), getToughness(s, monk), s.players[0].battlefield.filter((id) => s.cards[id]?.def === 'monk_token')]).toEqual([4, 2, [monk, expect.any(String)]]);
  });

  it('Brazier Disciple gains first strike with every instant, on top of its prowess', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'palm_strike', id: 'palm' }], battlefield: ['mountain', { card: 'brazier_disciple', id: 'disciple' }] },
        {},
      ],
    });
    s = resolveStack(cast(s, 'palm', [{ card: 'disciple' }]));
    expect([getPower(s, 'disciple'), getToughness(s, 'disciple'), getKeywords(s, 'disciple'), s.players[0].hand.length]).toEqual([
      3,
      3,
      ['prowess', 'firstStrike'],
      1,
    ]);
  });

  it('Lava Fist bites with the power prowess just gave, and Twin Strike makes a creature deal its damage twice', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'lava_fist', id: 'fist' }, { card: 'twin_strike', id: 'twin' }],
          battlefield: ['mountain', 'mountain', 'mountain', 'mountain', { card: 'temple_blade', id: 'blade' }],
        },
        { battlefield: [{ card: 'test_wall', id: 'wall' }] },
      ],
    });
    s = resolveStack(cast(s, 'fist', [{ card: 'blade' }, { card: 'wall' }]));
    expect([s.cards.wall?.damage, s.cards.blade?.damage]).toEqual([3, 0]);
    s = resolveStack(cast(s, 'twin', [{ card: 'blade' }]));
    expect([getPower(s, 'blade'), getKeywords(s, 'blade')]).toEqual([4, ['firstStrike', 'prowess', 'doubleStrike']]);
  });
});

describe('Wildland: landfall, land searches and extra land plays', () => {
  it('landfall: each land that enters under your control triggers it, the opponent’s lands do not', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'forest', id: 'land' }], battlefield: [{ card: 'cliff_lynx', id: 'lynx' }, { card: 'quake_boar', id: 'boar' }] },
        { battlefield: [{ card: 'cliff_lynx', id: 'theirs' }] },
      ],
    });
    s = playLand(s, 'land');
    expect(s.stack.map((item) => (item.kind === 'trigger' ? item.source : item.kind)).sort()).toEqual(['boar', 'lynx']);
    s = resolveStack(s);
    expect([getPower(s, 'lynx'), getToughness(s, 'lynx'), s.cards.boar?.counters, getPower(s, 'theirs')]).toEqual([3, 3, 1, 1]);
    s = passToStep(s, 'main1', s.turn + 1);
    expect([getPower(s, 'lynx'), s.cards.boar?.counters]).toEqual([1, 1]);
  });

  it('Trail Scout puts a basic Forest from the library onto the battlefield tapped, shuffles, and the Forest triggers landfall', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'trail_scout', id: 'scout' }],
          battlefield: ['forest', 'forest', { card: 'quake_boar', id: 'boar' }],
          library: ['mountain', 'mountain', { card: 'forest', id: 'deep' }, 'mountain', 'mountain', 'mountain'],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'scout'));
    expect([zoneOf(s, 'deep'), s.cards.deep?.tapped, s.players[0].library.length, s.cards.boar?.counters]).toEqual(['battlefield', true, 5, 1]);
    expect(describeEvent(s, { t: 'search', player: 0, card: 'deep', to: 'battlefield' }, 0)).toBe(
      'Buscas en tu biblioteca y pones Bosque en el campo de batalla.',
    );
    expect(describeEvent(s, { t: 'search', player: 0, card: 'deep', to: 'battlefield' }, 1)).toBe(
      'El rival busca en su biblioteca y pone Bosque en el campo de batalla.',
    );
  });

  it('Deep Sowing puts one Forest onto the battlefield tapped and another into your hand; with none left it only shuffles', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'deep_sowing', id: 'sowing' }, { card: 'deep_sowing', id: 'again' }],
          battlefield: ['forest', 'forest', 'forest', 'forest', 'forest', 'forest'],
          library: [{ card: 'forest', id: 'f1' }, 'mountain', { card: 'forest', id: 'f2' }, 'mountain'],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'sowing'));
    expect([zoneOf(s, 'f1'), s.cards.f1?.tapped, zoneOf(s, 'f2'), s.players[0].library.length]).toEqual(['battlefield', true, 'hand', 2]);
    expect(describeEvent(s, { t: 'search', player: 1, card: 'f2', to: 'hand' }, 0)).toBe(
      'El rival busca en su biblioteca y pone Bosque en su mano.',
    );
    const before = s.players[0].battlefield.length;
    s = resolveStack(cast(s, 'again'));
    expect([s.players[0].battlefield.length, s.players[0].library.length]).toEqual([before, 2]);
  });

  it('Open Path lets you play one more land this turn only', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'open_path', id: 'path' }, { card: 'forest', id: 'f1' }, { card: 'forest', id: 'f2' }, { card: 'forest', id: 'f3' }],
          battlefield: ['forest'],
          library: ['forest', 'forest', 'forest', 'forest', 'forest', 'forest'],
        },
        {},
      ],
    });
    s = playLand(s, 'f1');
    expect(tryApplyAction(s, { type: 'playLand', player: 0, card: 'f2' })).toEqual({ ok: false, error: 'ya has jugado una tierra este turno', refusal: { code: 'landPlayed' } });
    s = resolveStack(cast(s, 'path'));
    expect([s.players[0].extraLandsThisTurn, s.players[0].hand.length]).toEqual([1, 3]);
    expect(s.events).toContainEqual({ t: 'extraLands', player: 0, amount: 1 });
    expect(describeEvent(s, { t: 'extraLands', player: 0, amount: 1 }, 0)).toBe('Puedes jugar una tierra adicional este turno.');
    expect(describeEvent(s, { t: 'extraLands', player: 0, amount: 1 }, 1)).toBe('El rival puede jugar una tierra adicional este turno.');
    s = playLand(s, 'f2');
    expect(tryApplyAction(s, { type: 'playLand', player: 0, card: 'f3' })).toEqual({
      ok: false,
      error: 'ya has jugado todas las tierras que puedes este turno',
      refusal: { code: 'allLandsPlayed' },
    });
    s = passToStep(s, 'main1', s.turn + 2);
    expect(s.players[0].extraLandsThisTurn).toBe(0);
    s = playLand(s, 'f3');
    expect(s.players[0].landsPlayedThisTurn).toBe(1);
  });

  it('Tribe Elder sacrifices itself at instant speed to fetch a Forest, which triggers landfall in combat', () => {
    let s = scenario({
      players: [
        {
          battlefield: [{ card: 'tribe_elder', id: 'elder' }, { card: 'territorial_beast', id: 'beast' }],
          library: [{ card: 'forest', id: 'fetched' }, 'mountain', 'mountain'],
        },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    s = block(attack(s, ['beast']), [{ blocker: 'rhino', attacker: 'beast' }]);
    s = resolveStack(activate(s, 'elder'));
    expect([zoneOf(s, 'elder'), zoneOf(s, 'fetched'), s.cards.fetched?.tapped, getPower(s, 'beast'), getToughness(s, 'beast')]).toEqual([
      'graveyard',
      'battlefield',
      true,
      5,
      5,
    ]);
    s = finishCombat(s);
    expect([zoneOf(s, 'beast'), zoneOf(s, 'rhino')]).toEqual(['battlefield', 'graveyard']);
  });

  it('Wildland Colossus makes a 3/3 Beast for each land that enters, and Herd Roar pumps and gives trample to all of them', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'forest', id: 'land' }, { card: 'herd_roar', id: 'roar' }],
          battlefield: ['forest', 'forest', 'forest', { card: 'wildland_colossus', id: 'colossus' }],
        },
        {},
      ],
    });
    s = resolveStack(playLand(s, 'land'));
    const beast = s.players[0].battlefield.find((id) => s.cards[id]?.def === 'beast_token') as string;
    expect([getPower(s, beast), getToughness(s, beast)]).toEqual([3, 3]);
    s = resolveStack(cast(s, 'roar'));
    expect([getPower(s, beast), getKeywords(s, beast), getPower(s, 'colossus')]).toEqual([5, ['trample'], 7]);
  });
});

describe('Crossroads: lands that enter tapped and mana of three or five colors', () => {
  it('a tri-land enters tapped, so it cannot pay this turn, and untaps with the others next turn', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'silver_spire', id: 'spire' }, { card: 'sky_messenger', id: 'messenger' }], battlefield: ['plains'] },
        {},
      ],
    });
    s = playLand(s, 'spire');
    expect([s.cards.spire?.tapped, castBlocker(s, 0, 'messenger')]).toEqual([true, { code: 'notEnoughMana' }]);
    s = passToStep(s, 'main1', s.turn + 2);
    expect([s.cards.spire?.tapped, castBlocker(s, 0, 'messenger')]).toEqual([false, null]);
    s = resolveStack(cast(s, 'messenger'));
    expect(zoneOf(s, 'messenger')).toBe('battlefield');
  });

  it('tri-lands, the Prismatic Fount and Wayfarer Druid pay any of their colors', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'prismatic_dragon', id: 'dragon' }],
          battlefield: [
            { card: 'silver_spire', id: 'spire' },
            { card: 'ash_harbor', id: 'harbor' },
            { card: 'misty_meadow', id: 'meadow' },
            { card: 'prismatic_fount', id: 'fount' },
            { card: 'wayfarer_druid', id: 'druid' },
          ],
        },
        {},
      ],
    });
    expect(castBlocker(s, 0, 'dragon')).toBeNull();
    s = resolveStack(cast(s, 'dragon'));
    expect([zoneOf(s, 'dragon'), ['spire', 'harbor', 'meadow', 'fount', 'druid'].every((id) => s.cards[id]?.tapped)]).toEqual(['battlefield', true]);
  });

  it('a Forest that a search puts onto the battlefield tapped stays tapped until your next untap step', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'fertile_rift', id: 'rift' }],
          battlefield: ['forest', 'forest'],
          library: [{ card: 'forest', id: 'found' }, 'mountain', 'mountain'],
        },
        {},
      ],
    });
    s = resolveStack(cast(s, 'rift'));
    expect([zoneOf(s, 'found'), s.cards.found?.tapped]).toEqual(['battlefield', true]);
    s = passToStep(s, 'main1', s.turn + 2);
    expect(s.cards.found?.tapped).toBe(false);
  });
});
