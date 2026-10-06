import { describe, expect, it } from 'vitest';
import { chooseAction, chooseAttackers, chooseBlocks, rollout } from '../../src/ai';
import { DECK_LIST, applyAction, createGame, getLegalActions, type Action } from '../../src/engine';
import {
  act,
  attack,
  block,
  cast,
  finishCombat,
  lcg,
  life,
  pass,
  passTo,
  scenario,
  scrambleHiddenInformation,
} from '../helpers';

describe('AI main-phase decisions', () => {
  it('plays a land first', () => {
    const s = scenario({
      activePlayer: 1,
      players: [{}, { hand: [{ card: 'forest', id: 'f' }, 'ember_hound'], battlefield: ['mountain'] }],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'playLand', player: 1, card: 'f' });
  });

  it('plays the land color its hand needs', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'forest', id: 'f' }, { card: 'mountain', id: 'm' }, 'ember_hound', 'ember_snap'],
          battlefield: ['forest'],
        },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'playLand', player: 1, card: 'm' });
  });

  it('casts burn at the opponent when it is lethal', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        { life: 2, battlefield: ['canopy_spider'] },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'snap', targets: [{ player: 0 }] });
  });

  it('uses burn to kill a valuable creature', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }] },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'snap', targets: [{ card: 'drake' }] });
  });

  it('does not waste burn on a creature it cannot kill', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'pass', player: 1 });
  });

  it('casts creatures after combat', () => {
    const s = scenario({
      activePlayer: 1,
      step: 'main2',
      players: [
        {},
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'rhino', targets: [] });
  });

  it('keeps combat tricks for combat', () => {
    const s = scenario({
      activePlayer: 1,
      players: [{}, { hand: ['verdant_surge'], battlefield: ['forest', 'ember_hound'] }],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'pass', player: 1 });
  });

  it('removes a creature with Cinder Adept’s trigger instead of pinging face', () => {
    let s = scenario({
      activePlayer: 1,
      step: 'main2',
      players: [
        { battlefield: [{ card: 'moss_viper', id: 'viper' }] },
        { hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] },
      ],
    });
    s = pass(pass(cast(s, 'adept')));
    expect(s.pending?.kind).toBe('chooseTargets');
    expect(chooseAction(s, 1)).toEqual({ type: 'chooseTargets', player: 1, targets: [{ card: 'viper' }] });
  });
});

describe('AI instant-speed decisions', () => {
  it('saves its creature from burn with a pump spell', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'cinderwing_drake', id: 'drake' }],
        },
      ],
    });
    s = pass(cast(s, 'snap', [{ card: 'drake' }]));
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'surge', targets: [{ card: 'drake' }] });
  });

  it('uses a pump spell to win a combat after blockers are declared', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'bramble_warden', id: 'warden' }] },
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'ember_hound', id: 'hound' }],
        },
      ],
    });
    s = attack(s, ['hound']);
    s = passTo(s, 'declareBlockers');
    s = act(s, { type: 'declareBlockers', player: 0, blocks: [{ blocker: 'warden', attacker: 'hound' }] });
    expect(s.pending).toEqual({ kind: 'priority', player: 1 });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'surge', targets: [{ card: 'hound' }] });
  });

  it('does not waste a pump spell at the end of the opponent’s turn, even when it is in danger', () => {
    const s = pass(
      scenario({
        activePlayer: 1,
        step: 'main2',
        players: [
          {
            life: 5,
            hand: [{ card: 'verdant_surge', id: 'surge' }],
            battlefield: ['forest', { card: 'timberland_rhino', id: 'rhino' }],
          },
          { battlefield: ['ember_hound', 'ember_hound', 'ember_hound', 'ember_hound'] },
        ],
      }),
    );
    expect(s.pending).toEqual({ kind: 'priority', player: 0 });
    expect(chooseAction(s, 0)).toEqual({ type: 'pass', player: 0 });
  });

  it('pumps its Crag Dragon when the damage gets through', () => {
    let s = scenario({
      activePlayer: 1,
      players: [{ life: 6 }, { battlefield: ['mountain', 'mountain', { card: 'crag_dragon', id: 'dragon' }] }],
    });
    s = attack(s, ['dragon']);
    s = pass(pass(s));
    expect(s.step).toBe('declareBlockers');
    expect(chooseAction(s, 1)).toEqual({ type: 'activate', player: 1, card: 'dragon', ability: 0, targets: [] });
  });
});

describe('AI with the Dawntide and Duskmire answers', () => {
  it('counters a big creature spell', () => {
    const s = pass(
      cast(
        scenario({
          players: [
            {
              hand: [{ card: 'timberland_rhino', id: 'rhino' }],
              battlefield: ['forest', 'forest', 'forest', 'forest'],
            },
            { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
          ],
        }),
        'rhino',
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'tide', targets: [{ card: 'rhino' }] });
  });

  it('lets a harmless spell resolve instead of spending a counterspell on it', () => {
    const s = pass(
      cast(
        scenario({
          players: [
            { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
            { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
          ],
        }),
        'snap',
        [{ player: 1 }],
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'pass', player: 1 });
  });

  it('returns a lethal attacker to its owner’s hand', () => {
    const s = pass(
      attack(
        scenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            { life: 4, hand: [{ card: 'undertow', id: 'undertow' }], battlefield: ['island', 'island'] },
          ],
        }),
        ['rhino'],
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'undertow', targets: [{ card: 'rhino' }] });
  });

  it("destroys a tapped attacker with Dawn's Verdict", () => {
    const s = pass(
      attack(
        scenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            { hand: [{ card: 'dawns_verdict', id: 'verdict' }], battlefield: ['plains', 'plains', 'plains'] },
          ],
        }),
        ['rhino'],
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'verdict', targets: [{ card: 'rhino' }] });
  });

  it('kills a creature with Withering Touch and aims Grave Sentence at the biggest threat', () => {
    const touch = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
        { hand: [{ card: 'withering_touch', id: 'touch' }], battlefield: ['swamp'] },
      ],
    });
    expect(chooseAction(touch, 1)).toEqual({ type: 'cast', player: 1, card: 'touch', targets: [{ card: 'hound' }] });
    const sentence = scenario({
      activePlayer: 1,
      players: [
        {
          battlefield: [
            { card: 'grove_tender', id: 'elf' },
            { card: 'crag_dragon', id: 'dragon' },
          ],
        },
        { hand: [{ card: 'grave_sentence', id: 'sentence' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp'] },
      ],
    });
    expect(chooseAction(sentence, 1)).toEqual({
      type: 'cast',
      player: 1,
      card: 'sentence',
      targets: [{ card: 'dragon' }],
    });
  });

  it("pays life for Night's Bargain only when it can afford to", () => {
    const bargain = (life: number) =>
      scenario({
        activePlayer: 1,
        step: 'main2',
        players: [{}, { life, hand: [{ card: 'nights_bargain', id: 'bargain' }], battlefield: ['swamp', 'swamp'] }],
      });
    expect(chooseAction(bargain(20), 1)).toEqual({ type: 'cast', player: 1, card: 'bargain', targets: [] });
    expect(chooseAction(bargain(2), 1)).toEqual({ type: 'pass', player: 1 });
  });
});

describe('AI with the Stormglass and Sunmeadow cards', () => {
  it('flashes in a blocker when the opponent attacks', () => {
    const s = pass(
      attack(
        scenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            {
              life: 3,
              hand: [{ card: 'glassreef_sentinel', id: 'sentinel' }],
              battlefield: ['island', 'island', 'island'],
            },
          ],
        }),
        ['rhino'],
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'sentinel', targets: [] });
  });

  it('finds lethal damage through Galvanic Channeler’s trigger', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        { life: 2, battlefield: [{ card: 'test_bear', id: 'bear' }] },
        {
          hand: [{ card: 'static_jolt', id: 'jolt' }],
          battlefield: ['mountain', { card: 'galvanic_channeler', id: 'channeler' }],
        },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'jolt', targets: [{ player: 0 }] });
  });

  it('puts a +1/+1 counter where it is worth the most', () => {
    const s = pass(
      pass(
        cast(
          scenario({
            activePlayer: 1,
            step: 'main2',
            players: [
              {},
              {
                hand: [{ card: 'bloomcaller_druid', id: 'druid' }],
                battlefield: [
                  'forest',
                  'forest',
                  { card: 'test_bear', id: 'bear' },
                  { card: 'skyguard_griffin', id: 'griffin' },
                ],
              },
            ],
          }),
          'druid',
        ),
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'chooseTargets', player: 1, targets: [{ card: 'griffin' }] });
  });

  it('casts Rally the Meadow after blockers to win every combat', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {
          battlefield: [
            { card: 'test_bear', id: 'b0' },
            { card: 'test_bear', id: 'b1' },
          ],
        },
        {
          hand: [{ card: 'rally_the_meadow', id: 'rally' }],
          battlefield: ['plains', 'plains', { card: 'test_bear', id: 'a0' }, { card: 'test_bear', id: 'a1' }],
        },
      ],
    });
    s = passTo(attack(s, ['a0', 'a1']), 'declareBlockers');
    s = act(s, {
      type: 'declareBlockers',
      player: 0,
      blocks: [
        { blocker: 'b0', attacker: 'a0' },
        { blocker: 'b1', attacker: 'a1' },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'rally', targets: [] });
  });

  it('answers burn with Wild Blossom, and grows its creature before a fight with Pack Pounce', () => {
    const burn = pass(
      cast(
        scenario({
          players: [
            { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
            {
              hand: [{ card: 'wild_blossom', id: 'blossom' }],
              battlefield: ['forest', 'forest', { card: 'skyguard_griffin', id: 'griffin' }],
            },
          ],
        }),
        'snap',
        [{ card: 'griffin' }],
      ),
    );
    expect(chooseAction(burn, 1)).toEqual({ type: 'cast', player: 1, card: 'blossom', targets: [{ card: 'griffin' }] });
    const fight = scenario({
      activePlayer: 1,
      players: [
        {
          battlefield: [
            { card: 'cinder_adept', id: 'adept' },
            { card: 'grove_tender', id: 'elf' },
          ],
        },
        {
          hand: [{ card: 'pack_pounce', id: 'pounce' }],
          battlefield: ['forest', 'forest', { card: 'test_bear', id: 'bear' }],
        },
      ],
    });
    expect(chooseAction(fight, 1)).toEqual({
      type: 'cast',
      player: 1,
      card: 'pounce',
      targets: [{ card: 'bear' }, { card: 'adept' }],
    });
  });
});

describe('AI with the Brightforge, Mistgrave and Gloamwood cards', () => {
  it('casts Brightforge Warlord before combat, so the whole army attacks with haste', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'brightforge_warlord', id: 'warlord' }],
          battlefield: [
            'mountain',
            'mountain',
            'mountain',
            'plains',
            'plains',
            { card: 'sunsteel_lancer', id: 'lancer' },
            { card: 'soldier_token', id: 'soldier', sick: true },
          ],
        },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'warlord', targets: [] });
  });

  it('casts its creatures before combat while Forge Cadet grows with each of them', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'muster_sergeant', id: 'sergeant' }],
          battlefield: [
            'plains',
            'plains',
            { card: 'forge_cadet', id: 'cadet' },
            { card: 'sunsteel_lancer', id: 'lancer' },
          ],
        },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'sergeant', targets: [] });
  });

  it('makes blockers with Raise the Banners when an attack would be lethal, and blocks the trampler with both', () => {
    const s = pass(
      attack(
        scenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            { life: 3, hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] },
          ],
        }),
        ['rhino'],
      ),
    );
    const action = chooseAction(s, 1);
    expect(action).toEqual({ type: 'cast', player: 1, card: 'banners', targets: [] });

    const blocking = passTo(act(s, action), 'declareBlockers');
    const soldiers = blocking.players[1].battlefield.filter((id) => blocking.cards[id]?.def === 'soldier_token');
    const blocks = chooseBlocks(blocking, 1);
    expect(blocks.map((chump) => chump.blocker).sort()).toEqual([...soldiers].sort());
    expect(new Set(blocks.map((chump) => chump.attacker))).toEqual(new Set(['rhino']));
    expect(life(finishCombat(block(blocking, blocks)), 1)).toBe(1);
  });

  it('casts Rob the Mind while the opponent holds cards, not into an empty hand', () => {
    const rob = (hand: string[]) =>
      scenario({
        activePlayer: 1,
        step: 'main2',
        players: [{ hand }, { hand: [{ card: 'rob_the_mind', id: 'rob' }], battlefield: ['swamp', 'swamp', 'swamp'] }],
      });
    expect(chooseAction(rob(['timberland_rhino', 'ember_snap', 'forest']), 1)).toEqual({
      type: 'cast',
      player: 1,
      card: 'rob',
      targets: [],
    });
    expect(chooseAction(rob([]), 1)).toEqual({ type: 'pass', player: 1 });
  });

  it('discards the card it needs least when an effect makes it discard', () => {
    const s = passTo(
      cast(
        scenario({
          players: [
            { hand: [{ card: 'rob_the_mind', id: 'rob' }], battlefield: ['swamp', 'swamp', 'swamp'] },
            {
              hand: [
                { card: 'forest', id: 'f1' },
                { card: 'forest', id: 'f2' },
                { card: 'timberland_rhino', id: 'rhino' },
              ],
              battlefield: ['forest', 'forest', 'forest', 'forest', 'forest'],
            },
          ],
        }),
        'rob',
      ),
      'discard',
    );
    const action = chooseAction(s, 1);
    expect(action.type === 'discard' ? [...action.cards].sort() : action).toEqual(['f1', 'f2']);
  });

  it('sacrifices Bonewood Stalker to kill a creature worth more', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }] },
        { battlefield: [{ card: 'bonewood_stalker', id: 'stalker' }] },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({
      type: 'activate',
      player: 1,
      card: 'stalker',
      ability: 0,
      targets: [{ card: 'drake' }],
    });
  });

  it('attacks with a skulking creature that no blocker is allowed to stop', () => {
    const s = passTo(
      scenario({
        activePlayer: 1,
        players: [
          { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
          { battlefield: [{ card: 'fogslip_thief', id: 'thief' }] },
        ],
      }),
      'declareAttackers',
    );
    expect(chooseAttackers(s, 1)).toEqual(['thief']);
  });
});

describe('AI with the Vesperhall, Cindermaw and Deepgrove cards', () => {
  it('waits until after combat to cast a bloodthirsty creature, which then arrives with its counters', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'blistering_hellion', id: 'hellion' }],
          battlefield: ['mountain', 'mountain', 'mountain', { card: 'test_bear', id: 'bear' }],
        },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'pass', player: 1 });
    for (let i = 0; i < 40 && (s.cards.hellion?.zone !== 'battlefield' || s.stack.length > 0); i++) {
      const pending = s.pending;
      if (!pending || pending.kind === 'gameOver') break;
      s = act(s, chooseAction(s, pending.player));
    }
    expect([s.step, s.players[0].life, s.cards.hellion?.zone, s.cards.hellion?.counters]).toEqual([
      'main2',
      18,
      'battlefield',
      2,
    ]);
  });

  it('casts a creature before combat when it makes an evolving attacker grow', () => {
    const s = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'mossfin_lurker', id: 'lurker' }],
          battlefield: ['forest', 'forest', 'forest', { card: 'shoal_hatchling', id: 'hatchling' }],
        },
      ],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'lurker', targets: [] });
  });

  it('answers removal by giving its creature hexproof', () => {
    const s = pass(
      cast(
        scenario({
          players: [
            { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'mountain'] },
            {
              hand: [{ card: 'shell_of_the_deep', id: 'shell' }],
              battlefield: ['forest', { card: 'tanglejaw_croc', id: 'croc' }],
            },
          ],
        }),
        'lance',
        [{ card: 'croc' }],
      ),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'shell', targets: [{ card: 'croc' }] });
  });
});

describe('AI with the Flamecrest, Wildland and Crossroads cards', () => {
  it('plays an untapped land when it casts a spell this turn, and a land that enters tapped when it would cast nothing', () => {
    const now = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'silver_spire', id: 'spire' }, { card: 'plains', id: 'plains' }, 'sky_messenger'],
          battlefield: ['island'],
        },
      ],
    });
    expect(chooseAction(now, 1)).toEqual({ type: 'playLand', player: 1, card: 'plains' });
    const later = scenario({
      activePlayer: 1,
      players: [
        {},
        {
          hand: [{ card: 'silver_spire', id: 'spire' }, { card: 'plains', id: 'plains' }, 'test_giant'],
          battlefield: ['island'],
        },
      ],
    });
    expect(chooseAction(later, 1)).toEqual({ type: 'playLand', player: 1, card: 'spire' });
  });

  it('casts Open Path when it holds another land to play, and not otherwise', () => {
    const withLand = scenario({
      activePlayer: 1,
      players: [
        {},
        { hand: [{ card: 'open_path', id: 'path' }, 'forest'], battlefield: ['forest', 'forest'], landsPlayed: 1 },
      ],
    });
    expect(chooseAction(withLand, 1)).toEqual({ type: 'cast', player: 1, card: 'path', targets: [] });
    const withoutLand = scenario({
      activePlayer: 1,
      players: [{}, { hand: [{ card: 'open_path', id: 'path' }], battlefield: ['forest', 'forest'], landsPlayed: 1 }],
    });
    expect(chooseAction(withoutLand, 1)).toEqual({ type: 'pass', player: 1 });
  });

  it('casts an instant after blockers so prowess wins the fight', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'test_bear', id: 'bear' }] },
        {
          hand: [{ card: 'palm_strike', id: 'palm' }],
          battlefield: ['mountain', { card: 'cloister_lancer', id: 'lancer' }],
        },
      ],
    });
    s = act(passTo(attack(s, ['lancer']), 'declareBlockers'), {
      type: 'declareBlockers',
      player: 0,
      blocks: [{ blocker: 'bear', attacker: 'lancer' }],
    });
    expect(chooseAction(s, 1)).toEqual({ type: 'cast', player: 1, card: 'palm', targets: [{ card: 'lancer' }] });
  });

  it('sacrifices Tribe Elder for a Forest when it blocks and would die anyway, and keeps it otherwise', () => {
    const idle = scenario({
      activePlayer: 1,
      players: [
        {},
        { battlefield: [{ card: 'tribe_elder', id: 'elder' }], library: Array.from({ length: 8 }, () => 'forest') },
      ],
    });
    expect(chooseAction(idle, 1)).toEqual({ type: 'pass', player: 1 });
    let s = scenario({
      players: [
        { battlefield: [{ card: 'test_bear', id: 'bear' }] },
        { battlefield: [{ card: 'tribe_elder', id: 'elder' }], library: Array.from({ length: 8 }, () => 'forest') },
      ],
    });
    s = pass(
      act(passTo(attack(s, ['bear']), 'declareBlockers'), {
        type: 'declareBlockers',
        player: 1,
        blocks: [{ blocker: 'elder', attacker: 'bear' }],
      }),
    );
    expect(chooseAction(s, 1)).toEqual({ type: 'activate', player: 1, card: 'elder', ability: 0, targets: [] });
  });
});

describe('AI rollouts', () => {
  it('aim a death trigger at the most valuable target it can kill, not at its own controller', () => {
    let s = scenario({
      players: [
        {
          hand: [{ card: 'ember_snap', id: 'snap' }],
          battlefield: ['mountain', { card: 'grove_tender', id: 'elf' }, { card: 'timberland_rhino', id: 'rhino' }],
        },
        { battlefield: [{ card: 'test_dies_pinger', id: 'pinger' }] },
      ],
    });
    s = act(pass(cast(s, 'snap', [{ card: 'pinger' }])), { type: 'pass', player: 1 });
    expect(s.pending).toMatchObject({ kind: 'chooseTargets', player: 1 });
    const after = rollout(s, 1);
    expect(after.cards.elf?.zone).toBe('graveyard');
    expect(after.players[1].life).toBe(20);
  });
});

describe('AI activated abilities', () => {
  it('pumps its Crag Dragon as many times as needed to trade instead of dying for nothing', () => {
    let s = scenario({
      activePlayer: 1,
      players: [
        {
          hand: [{ card: 'verdant_surge', id: 'surge' }],
          battlefield: ['forest', { card: 'canopy_spider', id: 'spider' }],
        },
        { battlefield: ['mountain', 'mountain', { card: 'crag_dragon', id: 'dragon' }] },
      ],
    });
    s = attack(s, ['dragon']);
    s = passTo(s, 'declareBlockers');
    s = act(s, { type: 'declareBlockers', player: 0, blocks: [{ blocker: 'spider', attacker: 'dragon' }] });
    s = pass(s);
    s = cast(s, 'surge', [{ card: 'spider' }]);
    s = pass(s);
    const response = chooseAction(s, 1);
    expect(response).toEqual({ type: 'activate', player: 1, card: 'dragon', ability: 0, targets: [] });
    s = act(s, response);
    let activations = 1;
    while (s.pending?.kind === 'priority' && s.step === 'declareBlockers') {
      const player = s.pending.player;
      const action = player === 1 ? chooseAction(s, 1) : ({ type: 'pass', player: 0 } as const);
      if (action.type === 'activate') activations += 1;
      s = act(s, action);
    }
    expect(activations).toBe(2);
    expect(s.step).toBe('main2');
    expect(s.cards.spider?.zone).toBe('graveyard');
  });
});

describe('AI combat', () => {
  it('attacks when nothing can block', () => {
    const s = passTo(
      scenario({ activePlayer: 1, players: [{}, { battlefield: [{ card: 'ember_hound', id: 'hound' }] }] }),
      'declareAttackers',
    );
    expect(chooseAttackers(s, 1)).toEqual(['hound']);
  });

  it('does not attack into a blocker that would eat its attacker for free', () => {
    const s = passTo(
      scenario({
        activePlayer: 1,
        players: [{ battlefield: ['canopy_spider'] }, { battlefield: [{ card: 'ember_hound', id: 'hound' }] }],
      }),
      'declareAttackers',
    );
    expect(chooseAttackers(s, 1)).toEqual([]);
  });

  it('goes all in when the attack is lethal', () => {
    const s = passTo(
      scenario({
        activePlayer: 1,
        players: [
          { life: 5, battlefield: ['canopy_spider'] },
          {
            battlefield: [
              { card: 'ember_hound', id: 'h1' },
              { card: 'ember_hound', id: 'h2' },
              { card: 'ember_hound', id: 'h3' },
            ],
          },
        ],
      }),
      'declareAttackers',
    );
    expect(chooseAttackers(s, 1).sort()).toEqual(['h1', 'h2', 'h3']);
  });

  it('blocks when its blocker kills the attacker and survives', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }] },
      ],
    });
    s = passTo(attack(s, ['hound']), 'declareBlockers');
    expect(chooseBlocks(s, 1)).toEqual([{ blocker: 'spider', attacker: 'hound' }]);
  });

  it('chump blocks to survive lethal damage', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'test_giant', id: 'giant' }] },
        { life: 5, battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    s = passTo(attack(s, ['giant']), 'declareBlockers');
    expect(chooseBlocks(s, 1)).toEqual([{ blocker: 'elf', attacker: 'giant' }]);
  });

  it('does not throw creatures away when it is not in danger', () => {
    let s = scenario({
      players: [
        { battlefield: [{ card: 'test_giant', id: 'giant' }] },
        { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
      ],
    });
    s = passTo(attack(s, ['giant']), 'declareBlockers');
    expect(chooseBlocks(s, 1)).toEqual([]);
  });

  it('chumps with several creatures when one is not enough', () => {
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'test_giant', id: 'g1' },
            { card: 'test_giant', id: 'g2' },
          ],
        },
        {
          life: 6,
          battlefield: [
            { card: 'grove_tender', id: 'e1' },
            { card: 'moss_viper', id: 'v1' },
          ],
        },
      ],
    });
    s = passTo(attack(s, ['g1', 'g2']), 'declareBlockers');
    const blocks = chooseBlocks(s, 1);
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((chump) => chump.attacker))).toEqual(new Set(['g1', 'g2']));
  });

  it('chumps with its cheapest creature when that is enough, and keeps the better one for another block', () => {
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'bog_lurker', id: 'lurker' },
            { card: 'mist_sprite', id: 'sprite' },
          ],
        },
        {
          life: 3,
          battlefield: [
            { card: 'reefshell_crab', id: 'crab' },
            { card: 'cloudrider_knight', id: 'knight' },
          ],
        },
      ],
    });
    s = passTo(attack(s, ['lurker', 'sprite']), 'declareBlockers');
    expect(chooseBlocks(s, 1)).toEqual([
      { blocker: 'crab', attacker: 'lurker' },
      { blocker: 'knight', attacker: 'sprite' },
    ]);
  });

  it('stacks chump blockers on tramplers until what tramples over is no longer lethal', () => {
    const soldiers = ['t1', 't2', 't3', 't4'].map((id) => ({ card: 'soldier_token', id }));
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'timberland_rhino', id: 'r1' },
            { card: 'timberland_rhino', id: 'r2' },
          ],
        },
        { life: 6, battlefield: soldiers },
      ],
    });
    s = passTo(attack(s, ['r1', 'r2']), 'declareBlockers');
    const blocks = chooseBlocks(s, 1);
    expect(blocks.length).toBeGreaterThanOrEqual(3);
    expect(life(finishCombat(block(s, blocks)), 1)).toBeGreaterThan(0);
  });

  it('keeps its only flying blocker for the flying attacker when both attackers must be blocked', () => {
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'sunantler_monarch', id: 'monarch' },
            { card: 'crag_dragon', id: 'dragon' },
          ],
        },
        {
          life: 4,
          battlefield: [
            { card: 'spirit_token', id: 'spirit' },
            { card: 'bramble_warden', id: 'warden' },
          ],
        },
      ],
    });
    s = passTo(attack(s, ['monarch', 'dragon']), 'declareBlockers');
    expect(chooseBlocks(s, 1)).toEqual([
      { blocker: 'warden', attacker: 'monarch' },
      { blocker: 'spirit', attacker: 'dragon' },
    ]);
  });

  it('still blocks to take as little damage as it can when the attack is lethal anyway', () => {
    let s = scenario({
      players: [
        {
          battlefield: [
            { card: 'timberland_rhino', id: 'r1' },
            { card: 'timberland_rhino', id: 'r2' },
          ],
        },
        {
          life: 3,
          battlefield: [
            { card: 'soldier_token', id: 't1' },
            { card: 'soldier_token', id: 't2' },
          ],
        },
      ],
    });
    s = passTo(attack(s, ['r1', 'r2']), 'declareBlockers');
    expect(chooseBlocks(s, 1)).toHaveLength(2);
  });

  it('blocks to survive the combat damage even when any dying blocker would drain the attacker out', () => {
    let s = scenario({
      players: [
        {
          life: 1,
          battlefield: [
            { card: 'timberland_rhino', id: 'rhino' },
            { card: 'bramble_warden', id: 'warden' },
          ],
        },
        { life: 5, relics: ['urn'], battlefield: [{ card: 'soldier_token', id: 's1' }] },
      ],
    });
    s = passTo(attack(s, ['rhino', 'warden']), 'declareBlockers');
    const blocks = chooseBlocks(s, 1);
    expect(blocks).toEqual([{ blocker: 's1', attacker: 'warden' }]);
    expect(passTo(block(s, blocks), 'gameOver').pending).toMatchObject({ kind: 'gameOver', winner: 1 });
  });

  it('stacks chump blockers on a trampler even when one dying would drain the attacker out', () => {
    let s = scenario({
      players: [
        {
          life: 1,
          battlefield: [
            { card: 'timberland_rhino', id: 'rhino' },
            { card: 'bramble_warden', id: 'warden' },
          ],
        },
        { life: 3, relics: ['urn'], battlefield: ['s1', 's2', 's3'].map((id) => ({ card: 'soldier_token', id })) },
      ],
    });
    s = passTo(attack(s, ['rhino', 'warden']), 'declareBlockers');
    const blocks = chooseBlocks(s, 1);
    expect(blocks.map((chump) => chump.attacker).sort()).toEqual(['rhino', 'rhino', 'warden']);
    expect(passTo(block(s, blocks), 'gameOver').pending).toMatchObject({ kind: 'gameOver', winner: 1 });
  });
});

describe('AI setup decisions', () => {
  it('mulligans hands without lands or with only lands', () => {
    const noLands = createGame({
      seed: 1,
      startingPlayer: 1,
      players: [{}, { deck: Array.from({ length: 40 }, () => 'ember_hound') }],
    });
    expect(chooseAction(noLands, 1)).toEqual({ type: 'mulligan', player: 1 });
    const allLands = createGame({
      seed: 1,
      startingPlayer: 1,
      players: [{}, { deck: Array.from({ length: 40 }, () => 'forest') }],
    });
    expect(chooseAction(allLands, 1)).toEqual({ type: 'mulligan', player: 1 });
  });

  it('mulligans a hand whose lands cannot cast its spells', () => {
    const deck = [...Array.from({ length: 20 }, () => 'forest'), ...Array.from({ length: 20 }, () => 'ember_snap')];
    let checked = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame({ seed, startingPlayer: 1, players: [{}, { deck }] });
      const lands = s.players[1].hand.filter((id) => s.cards[id]?.def === 'forest').length;
      if (lands < 2 || lands > 5) continue;
      expect(chooseAction(s, 1)).toEqual({ type: 'mulligan', player: 1 });
      checked += 1;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('keeps a hand with a reasonable number of lands', () => {
    const deck = [...Array.from({ length: 20 }, () => 'forest'), ...Array.from({ length: 20 }, () => 'canopy_spider')];
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame({ seed, startingPlayer: 1, players: [{}, { deck }] });
      const lands = s.players[1].hand.filter((id) => s.cards[id]?.def === 'forest').length;
      const expected = lands >= 2 && lands <= 5 ? 'keep' : 'mulligan';
      expect(chooseAction(s, 1).type).toBe(expected);
    }
  });

  it('bottoms and discards the cards it needs least', () => {
    let s = createGame({
      seed: 3,
      startingPlayer: 1,
      players: [{}, { deck: Array.from({ length: 40 }, () => 'forest') }],
    });
    s = applyAction(s, { type: 'mulligan', player: 1 });
    s = applyAction(s, { type: 'keep', player: 1 });
    const bottom = chooseAction(s, 1);
    expect(bottom.type).toBe('bottom');
    if (bottom.type === 'bottom') expect(bottom.cards).toHaveLength(1);

    let full = scenario({
      activePlayer: 1,
      step: 'main2',
      players: [
        {},
        {
          hand: [
            'forest',
            'forest',
            'forest',
            'forest',
            'ember_hound',
            'timberland_rhino',
            'crag_dragon',
            'moss_viper',
            'ember_snap',
          ],
          battlefield: ['forest', 'forest', 'forest', 'mountain', 'mountain', 'mountain'],
        },
      ],
    });
    full = passTo(full, 'discard');
    const discard = chooseAction(full, 1);
    expect(discard.type).toBe('discard');
    if (discard.type === 'discard') {
      expect(discard.cards).toHaveLength(2);
      expect(discard.cards.every((id) => full.cards[id]?.def === 'forest')).toBe(true);
    }
  });
});

describe('AI fairness', () => {
  it('decides the same way whatever the hidden cards are', () => {
    let checked = 0;
    const matchups: [string, string][] = [
      ['emberwild', 'emberwild'],
      ['dawntide', 'duskmire'],
      ['duskmire', 'emberwild'],
      ['emberwild', 'dawntide'],
      ['stormglass', 'sunmeadow'],
      ['sunmeadow', 'duskmire'],
      ['dawntide', 'stormglass'],
      ['brightforge', 'mistgrave'],
      ['mistgrave', 'gloamwood'],
      ['gloamwood', 'brightforge'],
      ['flamecrest', 'crossroads'],
      ['wildland', 'stormglass'],
      ['crossroads', 'wildland'],
    ];
    for (const [seed, [first, second]] of matchups.entries()) {
      let s = createGame({ seed: seed + 1, players: [{ deck: first }, { deck: second }] });
      let step = 0;
      while (s.pending && s.pending.kind !== 'gameOver') {
        const player = s.pending.player;
        const action = chooseAction(s, player);
        if (step % 3 === 0 && s.pending.kind !== 'mulligan' && s.pending.kind !== 'bottom') {
          const variant = scrambleHiddenInformation(s, player, (seed + 1) * 1000 + step);
          expect(chooseAction(variant, player)).toEqual(action);
          checked += 1;
        }
        s = applyAction(s, action);
        step += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe('AI strength', () => {
  it('beats a random player nearly every game, with any deck', () => {
    let wins = 0;
    const decks = DECK_LIST.map((deck) => deck.id);
    const games = 15;
    for (let seed = 1; seed <= games; seed++) {
      const rand = lcg(seed);
      let s = createGame({
        seed,
        players: [{ deck: decks[seed % decks.length] }, { deck: decks[(seed + 1) % decks.length] }],
      });
      while (s.pending && s.pending.kind !== 'gameOver') {
        const player = s.pending.player;
        let action: Action;
        if (player === 1) action = chooseAction(s, 1);
        else {
          const legal = getLegalActions(s, { limit: 64 });
          action = legal[Math.floor(rand() * legal.length)] as Action;
        }
        s = applyAction(s, action);
      }
      if (s.pending?.kind === 'gameOver' && s.pending.winner === 1) wins += 1;
    }
    expect(wins).toBeGreaterThanOrEqual(14);
  });
});
