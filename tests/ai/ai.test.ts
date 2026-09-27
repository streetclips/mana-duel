import { describe, expect, it } from 'vitest';
import { chooseAction, chooseAttackers, chooseBlocks, rollout } from '../../src/ai';
import {
  applyAction,
  createGame,
  getLegalActions,
  type Action,
  type GameState,
  type PlayerId,
} from '../../src/engine';
import { act, attack, cast, pass, passTo, scenario } from '../helpers';

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
      players: [{ life: 2, battlefield: ['canopy_spider'] }, { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }],
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
      players: [{}, { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] }],
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
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'cinderwing_drake', id: 'drake' }] },
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
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'ember_hound', id: 'hound' }] },
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
          { life: 5, hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'timberland_rhino', id: 'rhino' }] },
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
            { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
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
      players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, { hand: [{ card: 'withering_touch', id: 'touch' }], battlefield: ['swamp'] }],
    });
    expect(chooseAction(touch, 1)).toEqual({ type: 'cast', player: 1, card: 'touch', targets: [{ card: 'hound' }] });
    const sentence = scenario({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'grove_tender', id: 'elf' }, { card: 'crag_dragon', id: 'dragon' }] },
        { hand: [{ card: 'grave_sentence', id: 'sentence' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp'] },
      ],
    });
    expect(chooseAction(sentence, 1)).toEqual({ type: 'cast', player: 1, card: 'sentence', targets: [{ card: 'dragon' }] });
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

describe('AI rollouts', () => {
  it('aim a death trigger at the most valuable target it can kill, not at its own controller', () => {
    let s = scenario({
      players: [
        { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain', { card: 'grove_tender', id: 'elf' }, { card: 'timberland_rhino', id: 'rhino' }] },
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
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'canopy_spider', id: 'spider' }] },
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
          { battlefield: [{ card: 'ember_hound', id: 'h1' }, { card: 'ember_hound', id: 'h2' }, { card: 'ember_hound', id: 'h3' }] },
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
        { battlefield: [{ card: 'test_giant', id: 'g1' }, { card: 'test_giant', id: 'g2' }] },
        { life: 6, battlefield: [{ card: 'grove_tender', id: 'e1' }, { card: 'moss_viper', id: 'v1' }] },
      ],
    });
    s = passTo(attack(s, ['g1', 'g2']), 'declareBlockers');
    const blocks = chooseBlocks(s, 1);
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((block) => block.attacker))).toEqual(new Set(['g1', 'g2']));
  });
});

describe('AI setup decisions', () => {
  it('mulligans hands without lands or with only lands', () => {
    const noLands = createGame({ seed: 1, startingPlayer: 1, players: [{}, { deck: Array.from({ length: 40 }, () => 'ember_hound') }] });
    expect(chooseAction(noLands, 1)).toEqual({ type: 'mulligan', player: 1 });
    const allLands = createGame({ seed: 1, startingPlayer: 1, players: [{}, { deck: Array.from({ length: 40 }, () => 'forest') }] });
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
    let s = createGame({ seed: 3, startingPlayer: 1, players: [{}, { deck: Array.from({ length: 40 }, () => 'forest') }] });
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
          hand: ['forest', 'forest', 'forest', 'forest', 'ember_hound', 'timberland_rhino', 'crag_dragon', 'moss_viper', 'ember_snap'],
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

function lcg(seed: number): () => number {
  let r = seed >>> 0 || 1;
  return () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
}

function scrambleHiddenInformation(s: GameState, viewer: PlayerId, seed: number): GameState {
  const copy = structuredClone(s);
  const rand = lcg(seed);
  const other = viewer === 0 ? 1 : 0;
  const groups = [
    [...copy.players[other].hand, ...copy.players[other].library],
    [...copy.players[viewer].library],
  ];
  for (const ids of groups) {
    const defs = ids.map((id) => copy.cards[id]?.def as string);
    for (let i = defs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [defs[i], defs[j]] = [defs[j] as string, defs[i] as string];
    }
    ids.forEach((id, index) => {
      const card = copy.cards[id];
      if (card) card.def = defs[index] as string;
    });
  }
  return copy;
}

describe('AI fairness', () => {
  it('decides the same way whatever the hidden cards are', () => {
    let checked = 0;
    const matchups: [string, string][] = [
      ['emberwild', 'emberwild'],
      ['dawntide', 'duskmire'],
      ['duskmire', 'emberwild'],
      ['emberwild', 'dawntide'],
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
    const decks = ['emberwild', 'dawntide', 'duskmire'];
    const games = 12;
    for (let seed = 1; seed <= games; seed++) {
      const rand = lcg(seed);
      let s = createGame({ seed, players: [{ deck: decks[seed % 3] }, { deck: decks[(seed + 1) % 3] }] });
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
    expect(wins).toBeGreaterThanOrEqual(11);
  });
});
