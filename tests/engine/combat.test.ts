import { describe, expect, it } from 'vitest';
import { blockOptions, eligibleAttackers, getLegalActions, tryApplyAction } from '../../src/engine';
import {
  attack,
  block,
  cast,
  finishCombat,
  life,
  pass,
  passTo,
  resolveStack,
  scenario,
  zoneOf,
} from '../helpers';

describe('declaring attackers', () => {
  it('taps attackers unless they have vigilance', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ember_hound', id: 'hound' }, { card: 'bramble_warden', id: 'warden' }] },
        {},
      ],
    });
    s = attack(s, ['hound', 'warden']);
    expect(s.cards.hound?.tapped).toBe(true);
    expect(s.cards.warden?.tapped).toBe(false);
    expect(s.combat?.attackers).toEqual(['hound', 'warden']);
  });

  it('never lets defenders or tapped creatures attack', () => {
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'test_wall', id: 'wall' },
            { card: 'ember_hound', id: 'tapped', tapped: true },
            { card: 'canopy_spider', id: 'spider' },
          ],
        },
        {},
      ],
    });
    s = passTo(s, 'declareAttackers');
    expect(eligibleAttackers(s)).toEqual(['spider']);
    expect(tryApplyAction(s, { type: 'declareAttackers', player: 0, attackers: ['wall'] })).toMatchObject({ ok: false });
    expect(tryApplyAction(s, { type: 'declareAttackers', player: 0, attackers: ['spider', 'spider'] })).toMatchObject({
      ok: false,
    });
  });

  it('deals combat damage to the defending player when unblocked', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, {}] });
    s = finishCombat(attack(s, ['rhino']));
    expect(life(s, 1)).toBe(16);
  });

  it('skips the rest of combat when no attackers are declared', () => {
    let s = scenario({ players: [{ battlefield: ['ember_hound'] }, { battlefield: ['canopy_spider'] }] });
    s = attack(s, []);
    expect(s.step).toBe('main2');
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
  });

  it('fires "whenever this creature attacks" triggers', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'test_attack_pump', id: 'pumper' }] }, {}] });
    s = attack(s, ['pumper']);
    expect(s.stack).toHaveLength(1);
    s = finishCombat(s);
    expect(life(s, 1)).toBe(18);
  });
});

describe('declaring blockers', () => {
  it('only lets flying attackers be blocked by flying or reach creatures', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }] },
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }, { card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    s = attack(s, ['drake']);
    s = passTo(s, 'declareBlockers');
    expect(blockOptions(s)).toEqual({ spider: ['drake'] });
    expect(tryApplyAction(s, { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'rhino', attacker: 'drake' }] }))
      .toMatchObject({ ok: false });
    s = block(s, [{ blocker: 'spider', attacker: 'drake' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'spider')).toBe('graveyard');
    expect(zoneOf(s, 'drake')).toBe('battlefield');
    expect(s.cards.drake?.damage).toBe(1);
    expect(life(s, 1)).toBe(20);
  });

  it('requires two or more blockers for menace', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ridge_marauder', id: 'marauder' }] },
        { battlefield: [{ card: 'moss_viper', id: 'viper' }, { card: 'canopy_spider', id: 'spider' }] },
      ],
    });
    s = passTo(attack(s, ['marauder']), 'declareBlockers');
    expect(tryApplyAction(s, { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'viper', attacker: 'marauder' }] }))
      .toEqual({ ok: false, error: 'marauder tiene la habilidad de amenaza y no puede ser bloqueada excepto por dos o más criaturas' });
    const legal = getLegalActions(s).map((action) => (action.type === 'declareBlockers' ? action.blocks.length : -1));
    expect(legal.sort()).toEqual([0, 2]);
    s = block(s, [
      { blocker: 'viper', attacker: 'marauder' },
      { blocker: 'spider', attacker: 'marauder' },
    ]);
    s = finishCombat(s);
    expect(zoneOf(s, 'marauder')).toBe('graveyard');
    expect(zoneOf(s, 'viper')).toBe('graveyard');
    expect(zoneOf(s, 'spider')).toBe('battlefield');
  });

  it('does not let tapped creatures block, and skips the decision if nobody can block', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
        { battlefield: [{ card: 'canopy_spider', id: 'spider', tapped: true }] },
      ],
    });
    s = attack(s, ['hound']);
    s = pass(pass(s));
    expect(s.step).toBe('declareBlockers');
    expect(s.combat?.blockersDeclared).toBe(true);
    s = finishCombat(s);
    expect(life(s, 1)).toBe(18);
  });

  it('lets one blocker block only one attacker', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ember_hound', id: 'h1' }, { card: 'ember_hound', id: 'h2' }] },
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }] },
      ],
    });
    s = passTo(attack(s, ['h1', 'h2']), 'declareBlockers');
    expect(
      tryApplyAction(s, {
        type: 'declareBlockers',
        player: 1,
        blocks: [
          { blocker: 'spider', attacker: 'h1' },
          { blocker: 'spider', attacker: 'h2' },
        ],
      }),
    ).toMatchObject({ ok: false });
  });
});

describe('combat damage', () => {
  it('has blocked creatures deal damage to each other and not to the player', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    s = block(attack(s, ['hound']), [{ blocker: 'adept', attacker: 'hound' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'hound')).toBe('graveyard');
    expect(zoneOf(s, 'adept')).toBe('graveyard');
    expect(life(s, 1)).toBe(20);
  });

  it('assigns trample damage beyond lethal to the player', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
      ],
    });
    s = block(attack(s, ['rhino']), [{ blocker: 'hound', attacker: 'rhino' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'hound')).toBe('graveyard');
    expect(life(s, 1)).toBe(17);
  });

  it('counts damage already marked on a blocker when trampling over it', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        { battlefield: [{ card: 'bramble_warden', id: 'warden', damage: 3 }] },
      ],
    });
    s = block(attack(s, ['rhino']), [{ blocker: 'warden', attacker: 'rhino' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'warden')).toBe('graveyard');
    expect(life(s, 1)).toBe(17);
  });

  it('needs only one damage per blocker with deathtouch and trample', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'test_deathtouch_trampler', id: 'dt' }] },
        { battlefield: [{ card: 'bramble_warden', id: 'w1' }, { card: 'bramble_warden', id: 'w2' }] },
      ],
    });
    s = block(attack(s, ['dt']), [
      { blocker: 'w1', attacker: 'dt' },
      { blocker: 'w2', attacker: 'dt' },
    ]);
    s = finishCombat(s);
    expect(zoneOf(s, 'w1')).toBe('graveyard');
    expect(zoneOf(s, 'w2')).toBe('graveyard');
    expect(zoneOf(s, 'dt')).toBe('graveyard');
    expect(life(s, 1)).toBe(18);
  });

  it('destroys any creature dealt damage by a deathtouch source', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        { battlefield: [{ card: 'moss_viper', id: 'viper' }] },
      ],
    });
    s = block(attack(s, ['rhino']), [{ blocker: 'viper', attacker: 'rhino' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'rhino')).toBe('graveyard');
    expect(zoneOf(s, 'viper')).toBe('graveyard');
    expect(life(s, 1)).toBe(17);
  });

  it('lets first strikers kill blockers before they deal damage', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ashen_duelist', id: 'duelist' }] },
        { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
      ],
    });
    s = block(attack(s, ['duelist']), [{ blocker: 'adept', attacker: 'duelist' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'adept')).toBe('graveyard');
    expect(zoneOf(s, 'duelist')).toBe('battlefield');
    expect(s.cards.duelist?.damage).toBe(0);
  });

  it('makes first strike irrelevant when the first striker does not kill', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ashen_duelist', id: 'duelist' }] },
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }] },
      ],
    });
    s = block(attack(s, ['duelist']), [{ blocker: 'spider', attacker: 'duelist' }]);
    s = finishCombat(s);
    expect(zoneOf(s, 'duelist')).toBe('graveyard');
    expect(zoneOf(s, 'spider')).toBe('battlefield');
  });

  it('deals damage twice with double strike', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'test_double_striker', id: 'ds' }] }, {}] });
    s = finishCombat(attack(s, ['ds']));
    expect(life(s, 1)).toBe(16);
  });

  it('gains life with lifelink', () => {
    let s = scenario({ players: [{ life: 10, battlefield: [{ card: 'test_lifelinker', id: 'll' }] }, {}] });
    s = finishCombat(attack(s, ['ll']));
    expect(life(s, 1)).toBe(18);
    expect(life(s, 0)).toBe(12);
  });

  it('splits an attacker’s damage among several blockers, killing as many as possible', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        {
          battlefield: [
            { card: 'canopy_spider', id: 'spider' },
            { card: 'grove_tender', id: 'elf' },
          ],
        },
      ],
    });
    s = block(attack(s, ['rhino']), [
      { blocker: 'spider', attacker: 'rhino' },
      { blocker: 'elf', attacker: 'rhino' },
    ]);
    s = finishCombat(s);
    expect(zoneOf(s, 'spider')).toBe('graveyard');
    expect(zoneOf(s, 'elf')).toBe('graveyard');
    expect(zoneOf(s, 'rhino')).toBe('battlefield');
    expect(s.cards.rhino?.damage).toBe(2);
    expect(life(s, 1)).toBe(20);
  });

  it('keeps an attacker blocked even if its blocker leaves combat', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain', { card: 'ember_hound', id: 'hound' }] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    s = block(attack(s, ['hound']), [{ blocker: 'elf', attacker: 'hound' }]);
    s = resolveStack(cast(s, 'snap', [{ card: 'elf' }]));
    expect(zoneOf(s, 'elf')).toBe('graveyard');
    s = finishCombat(s);
    expect(zoneOf(s, 'hound')).toBe('battlefield');
    expect(life(s, 1)).toBe(20);
  });

  it('lets a trampler whose blockers are all gone assign all its damage to the player', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap' }],
          battlefield: ['mountain', { card: 'timberland_rhino', id: 'rhino' }],
        },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    s = block(attack(s, ['rhino']), [{ blocker: 'elf', attacker: 'rhino' }]);
    s = resolveStack(cast(s, 'snap', [{ card: 'elf' }]));
    s = finishCombat(s);
    expect(life(s, 1)).toBe(16);
  });

  it('lets combat tricks change the outcome after blocks', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'ember_hound', id: 'hound' }] },
        { battlefield: [{ card: 'bramble_warden', id: 'warden' }] },
      ],
    });
    s = block(attack(s, ['hound']), [{ blocker: 'warden', attacker: 'hound' }]);
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    s = resolveStack(cast(s, 'surge', [{ card: 'hound' }]));
    s = finishCombat(s);
    expect(zoneOf(s, 'warden')).toBe('graveyard');
    expect(zoneOf(s, 'hound')).toBe('battlefield');
  });

  it('removes creatures from combat when it ends', () => {
    let s = scenario({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, {}] });
    s = finishCombat(attack(s, ['hound']));
    expect(s.combat).toBeNull();
  });
});
