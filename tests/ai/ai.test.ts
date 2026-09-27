import { describe, expect, it } from 'vitest';
import { chooseAction, chooseAttackers, chooseBlocks } from '../../src/ai';
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
    for (const seed of [1, 2, 3, 4]) {
      let s = createGame({ seed });
      let step = 0;
      while (s.pending && s.pending.kind !== 'gameOver') {
        const player = s.pending.player;
        const action = chooseAction(s, player);
        if (step % 3 === 0 && s.pending.kind !== 'mulligan' && s.pending.kind !== 'bottom') {
          const variant = scrambleHiddenInformation(s, player, seed * 1000 + step);
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
  it('beats a random player nearly every game', () => {
    let wins = 0;
    const games = 10;
    for (let seed = 1; seed <= games; seed++) {
      const rand = lcg(seed);
      let s = createGame({ seed });
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
    expect(wins).toBeGreaterThanOrEqual(9);
  });
});
