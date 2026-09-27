import { chooseAction } from '../ai';
import {
  applyAction,
  checkInvariants,
  createGame,
  createScenario,
  eligibleAttackers,
  getLegalActions,
  getPower,
  tryApplyAction,
  type Action,
  type GameState,
  type PlayerId,
} from '../engine';

export interface CheckResult {
  id: string;
  title: string;
  ok: boolean;
  detail: string;
}

interface Check {
  id: string;
  title: string;
  run: () => string | null;
}

function play(state: GameState, actions: Action[]): GameState {
  let s = state;
  actions.forEach((action, index) => {
    const result = tryApplyAction(s, action);
    if (!result.ok) throw new Error(`action ${index} (${action.type}) was refused: ${result.error}`);
    s = result.state;
  });
  return s;
}

function passUntil(state: GameState, done: (s: GameState) => boolean, limit = 300): GameState {
  let s = state;
  for (let i = 0; i < limit && !done(s); i++) {
    const pending = s.pending;
    if (!pending || pending.kind === 'gameOver') break;
    if (pending.kind === 'priority') s = applyAction(s, { type: 'pass', player: pending.player });
    else if (pending.kind === 'declareAttackers') s = applyAction(s, { type: 'declareAttackers', player: pending.player, attackers: [] });
    else if (pending.kind === 'declareBlockers') s = applyAction(s, { type: 'declareBlockers', player: pending.player, blocks: [] });
    else break;
  }
  if (!done(s)) throw new Error(`stopped at ${s.pending?.kind} in ${s.step} without reaching the expected point`);
  return s;
}

function toAttackers(s: GameState): GameState {
  return passUntil(s, (state) => state.pending?.kind === 'declareAttackers');
}

function toBlockers(s: GameState): GameState {
  return passUntil(s, (state) => state.pending?.kind === 'declareBlockers');
}

function toMain2(s: GameState): GameState {
  return passUntil(s, (state) => state.step === 'main2' && state.pending?.kind === 'priority');
}

function refused(s: GameState, action: Action, expected: string): string | null {
  const result = tryApplyAction(s, action);
  if (result.ok) return `expected "${action.type}" to be refused`;
  return result.error === expected ? null : `refused with "${result.error}" instead of "${expected}"`;
}

function expectValue<T>(actual: T, expected: T, what: string): string | null {
  return JSON.stringify(actual) === JSON.stringify(expected)
    ? null
    : `${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`;
}

function first(...results: (string | null)[]): string | null {
  return results.find((result) => result !== null) ?? null;
}

function zone(s: GameState, id: string): string {
  return s.cards[id]?.zone ?? 'missing';
}

function aiGame(seed: number, onState?: (s: GameState) => string | null): { state: GameState; actions: Action[]; problem: string | null } {
  let s = createGame({ seed });
  const actions: Action[] = [];
  while (s.pending && s.pending.kind !== 'gameOver' && actions.length < 5000) {
    const problem = onState?.(s);
    if (problem) return { state: s, actions, problem };
    const action = chooseAction(s, s.pending.player);
    s = applyAction(s, action);
    actions.push(action);
  }
  return { state: s, actions, problem: s.pending?.kind === 'gameOver' ? null : 'the game did not finish' };
}

export const CHECKS: Check[] = [
  {
    id: 'F01',
    title: 'Setup: 40-card decks, 7-card hands, 20 life, same seed gives the same game',
    run: () => {
      const a = createGame({ seed: 7 });
      const b = createGame({ seed: 7 });
      return first(
        expectValue(JSON.stringify(a) === JSON.stringify(b), true, 'same seed, same game'),
        expectValue(a.players.map((p) => [p.hand.length, p.library.length, p.life]), [[7, 33, 20], [7, 33, 20]], 'hands, libraries and life'),
      );
    },
  },
  {
    id: 'F02',
    title: 'London mulligan: new seven, then one card to the bottom per mulligan',
    run: () => {
      let s = createGame({ seed: 3, startingPlayer: 0 });
      s = play(s, [{ type: 'mulligan', player: 0 }, { type: 'keep', player: 0 }]);
      const pending = expectValue(s.pending, { kind: 'bottom', player: 0, count: 1 }, 'pending decision');
      const card = s.players[0].hand[0] as string;
      s = play(s, [{ type: 'bottom', player: 0, cards: [card] }]);
      return first(pending, expectValue([s.players[0].hand.length, s.players[0].library.at(-1)], [6, card], 'hand size and bottom card'));
    },
  },
  {
    id: 'F03',
    title: 'Turns: the starting player skips the first draw, the other player draws',
    run: () => {
      const s = createGame({ seed: 3, startingPlayer: 0, skipMulligans: true });
      const next = passUntil(s, (state) => state.turn === 2 && state.step === 'main1' && state.pending?.kind === 'priority');
      return first(
        expectValue([s.turn, s.players[0].hand.length], [1, 7], 'turn 1 hand'),
        expectValue([next.activePlayer, next.players[1].hand.length], [1, 8], 'turn 2 hand'),
      );
    },
  },
  {
    id: 'F04',
    title: 'Lands: one land per turn',
    run: () => {
      let s = createScenario({ players: [{ hand: [{ card: 'forest', id: 'f1' }, { card: 'forest', id: 'f2' }] }, {}] });
      s = play(s, [{ type: 'playLand', player: 0, card: 'f1' }]);
      return first(
        expectValue(zone(s, 'f1'), 'battlefield', 'first land'),
        refused(s, { type: 'playLand', player: 0, card: 'f2' }, 'you already played a land this turn'),
      );
    },
  },
  {
    id: 'F05',
    title: 'Timing: creatures need an empty stack in your main phase, instants do not',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'ember_hound', id: 'hound' }], battlefield: ['mountain', 'mountain', 'mountain'] },
          {},
        ],
      });
      s = play(s, [{ type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] }]);
      return refused(s, { type: 'cast', player: 0, card: 'hound', targets: [] }, 'this can only be cast during your main phase with an empty stack');
    },
  },
  {
    id: 'F06',
    title: 'Stack: a pump cast in response resolves first and saves the creature',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
          { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'moss_viper', id: 'viper' }] },
        ],
      });
      s = play(s, [
        { type: 'cast', player: 0, card: 'snap', targets: [{ card: 'viper' }] },
        { type: 'pass', player: 0 },
        { type: 'cast', player: 1, card: 'surge', targets: [{ card: 'viper' }] },
        { type: 'pass', player: 1 },
        { type: 'pass', player: 0 },
        { type: 'pass', player: 0 },
        { type: 'pass', player: 1 },
      ]);
      return first(expectValue(zone(s, 'viper'), 'battlefield', 'viper'), expectValue(s.cards.viper?.damage, 2, 'viper damage'));
    },
  },
  {
    id: 'F07',
    title: 'Mana: colors must match and summoning-sick mana creatures cannot pay',
    run: () => {
      const wrongColor = createScenario({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['forest'] }, {}] });
      const sickElf = createScenario({
        players: [{ hand: [{ card: 'moss_viper', id: 'viper' }], battlefield: [{ card: 'grove_tender', sick: true }] }, {}],
      });
      return first(
        refused(wrongColor, { type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] }, 'not enough mana'),
        refused(sickElf, { type: 'cast', player: 0, card: 'viper', targets: [] }, 'not enough mana'),
      );
    },
  },
  {
    id: 'F08',
    title: 'Summoning sickness: new creatures cannot attack unless they have haste',
    run: () => {
      const s = toAttackers(
        createScenario({
          players: [{ battlefield: [{ card: 'canopy_spider', id: 'spider', sick: true }, { card: 'ember_hound', id: 'hound', sick: true }] }, {}],
        }),
      );
      return expectValue(eligibleAttackers(s), ['hound'], 'eligible attackers');
    },
  },
  {
    id: 'F09',
    title: 'Attacking: attackers tap unless vigilant, unblocked damage hits the player',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }, { card: 'bramble_warden', id: 'warden' }] }, {}],
        }),
      );
      s = play(s, [{ type: 'declareAttackers', player: 0, attackers: ['rhino', 'warden'] }]);
      const tapped = expectValue([s.cards.rhino?.tapped, s.cards.warden?.tapped], [true, false], 'tapped attackers');
      s = toMain2(s);
      return first(tapped, expectValue(s.players[1].life, 14, 'defender life'));
    },
  },
  {
    id: 'F10',
    title: 'Blocking: flying needs flying or reach, menace needs two blockers',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }, { card: 'ridge_marauder', id: 'marauder' }] },
            { battlefield: [{ card: 'grove_tender', id: 'elf' }, { card: 'ember_hound', id: 'hound' }] },
          ],
        }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['drake', 'marauder'] }]));
      return first(
        refused(s, { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'elf', attacker: 'drake' }] }, 'elf cannot block drake'),
        refused(
          s,
          { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'elf', attacker: 'marauder' }] },
          "marauder has menace and can't be blocked except by two or more creatures",
        ),
        tryApplyAction(s, {
          type: 'declareBlockers',
          player: 1,
          blocks: [
            { blocker: 'elf', attacker: 'marauder' },
            { blocker: 'hound', attacker: 'marauder' },
          ],
        }).ok
          ? null
          : 'a double block on menace was refused',
      );
    },
  },
  {
    id: 'F11',
    title: 'Combat damage: an attacker splits damage to destroy as many blockers as it can',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            { battlefield: [{ card: 'canopy_spider', id: 'spider' }, { card: 'grove_tender', id: 'elf' }] },
          ],
        }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['rhino'] }]));
      s = toMain2(
        play(s, [
          {
            type: 'declareBlockers',
            player: 1,
            blocks: [
              { blocker: 'spider', attacker: 'rhino' },
              { blocker: 'elf', attacker: 'rhino' },
            ],
          },
        ]),
      );
      return expectValue([zone(s, 'spider'), zone(s, 'elf'), s.cards.rhino?.damage, s.players[1].life], ['graveyard', 'graveyard', 2, 20], 'result');
    },
  },
  {
    id: 'F12',
    title: 'Trample: damage beyond lethal goes to the player',
    run: () => {
      let s = toAttackers(
        createScenario({ players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, { battlefield: [{ card: 'ember_hound', id: 'hound' }] }] }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['rhino'] }]));
      s = toMain2(play(s, [{ type: 'declareBlockers', player: 1, blocks: [{ blocker: 'hound', attacker: 'rhino' }] }]));
      return expectValue([zone(s, 'hound'), s.players[1].life], ['graveyard', 17], 'result');
    },
  },
  {
    id: 'F13',
    title: 'First strike: the first striker kills its blocker before it strikes back',
    run: () => {
      let s = toAttackers(
        createScenario({ players: [{ battlefield: [{ card: 'ashen_duelist', id: 'duelist' }] }, { battlefield: [{ card: 'cinder_adept', id: 'adept' }] }] }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['duelist'] }]));
      s = toMain2(play(s, [{ type: 'declareBlockers', player: 1, blocks: [{ blocker: 'adept', attacker: 'duelist' }] }]));
      return expectValue([zone(s, 'adept'), zone(s, 'duelist')], ['graveyard', 'battlefield'], 'result');
    },
  },
  {
    id: 'F14',
    title: 'Deathtouch: any damage destroys the creature',
    run: () => {
      let s = toAttackers(
        createScenario({ players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, { battlefield: [{ card: 'moss_viper', id: 'viper' }] }] }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['rhino'] }]));
      s = toMain2(play(s, [{ type: 'declareBlockers', player: 1, blocks: [{ blocker: 'viper', attacker: 'rhino' }] }]));
      return expectValue([zone(s, 'rhino'), zone(s, 'viper')], ['graveyard', 'graveyard'], 'result');
    },
  },
  {
    id: 'F16',
    title: 'Burn and removal: Magma Lance only targets creatures, a spell without targets fizzles',
    run: () => {
      const lance = createScenario({
        players: [
          { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'mountain'] },
          { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
        ],
      });
      const targets = getLegalActions(lance)
        .filter((action) => action.type === 'cast')
        .flatMap((action) => (action.type === 'cast' ? action.targets : []));
      let snaps = createScenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 's1' }, { card: 'ember_snap', id: 's2' }], battlefield: ['mountain', 'mountain'] },
          { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
        ],
      });
      snaps = play(snaps, [
        { type: 'cast', player: 0, card: 's1', targets: [{ card: 'hound' }] },
        { type: 'cast', player: 0, card: 's2', targets: [{ card: 'hound' }] },
      ]);
      snaps = passUntil(snaps, (state) => state.stack.length === 0);
      return first(
        expectValue(targets.every((target) => 'card' in target), true, 'Magma Lance targets are creatures'),
        expectValue([zone(snaps, 'hound'), zone(snaps, 's1'), zone(snaps, 's2')], ['graveyard', 'graveyard', 'graveyard'], 'zones'),
      );
    },
  },
  {
    id: 'F17',
    title: 'Pump: +3/+3 lasts until end of turn',
    run: () => {
      let s = createScenario({ players: [{ hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'moss_viper', id: 'viper' }] }, {}] });
      s = play(s, [{ type: 'cast', player: 0, card: 'surge', targets: [{ card: 'viper' }] }]);
      s = passUntil(s, (state) => state.stack.length === 0);
      const pumped = getPower(s, 'viper');
      s = passUntil(s, (state) => state.turn === 4 && state.pending?.kind === 'priority');
      return expectValue([pumped, getPower(s, 'viper')], [4, 1], 'power this turn and next turn');
    },
  },
  {
    id: 'F18',
    title: 'Fight: both creatures deal damage equal to their power to each other',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'feral_clash', id: 'clash' }], battlefield: ['forest', 'forest', { card: 'timberland_rhino', id: 'rhino' }] },
          { battlefield: [{ card: 'cinder_adept', id: 'adept' }] },
        ],
      });
      s = play(s, [{ type: 'cast', player: 0, card: 'clash', targets: [{ card: 'rhino' }, { card: 'adept' }] }]);
      s = passUntil(s, (state) => state.stack.length === 0);
      return expectValue([zone(s, 'adept'), s.cards.rhino?.damage], ['graveyard', 2], 'result');
    },
  },
  {
    id: 'F19',
    title: 'Card draw: Read the Roots draws two',
    run: () => {
      let s = createScenario({ players: [{ hand: [{ card: 'read_the_roots', id: 'roots' }], battlefield: ['forest', 'forest', 'forest'] }, {}] });
      s = play(s, [{ type: 'cast', player: 0, card: 'roots', targets: [] }]);
      s = passUntil(s, (state) => state.stack.length === 0);
      return expectValue(s.players[0].hand.length, 2, 'hand size');
    },
  },
  {
    id: 'F20',
    title: 'Triggers: Cinder Adept asks for a target when it enters, then deals 1 damage',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] },
          { battlefield: [{ card: 'grove_tender', id: 'elf' }] },
        ],
      });
      s = play(s, [{ type: 'cast', player: 0, card: 'adept', targets: [] }, { type: 'pass', player: 0 }, { type: 'pass', player: 1 }]);
      const asked = expectValue(s.pending?.kind, 'chooseTargets', 'pending decision');
      s = play(s, [{ type: 'chooseTargets', player: 0, targets: [{ card: 'elf' }] }]);
      s = passUntil(s, (state) => state.stack.length === 0);
      return first(asked, expectValue(zone(s, 'elf'), 'graveyard', 'elf'));
    },
  },
  {
    id: 'F21',
    title: 'Activated abilities: Crag Dragon pumps once per {R}, until end of turn',
    run: () => {
      let s = createScenario({ players: [{ battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain', 'mountain'] }, {}] });
      for (let i = 0; i < 2; i++) {
        s = play(s, [{ type: 'activate', player: 0, card: 'dragon', ability: 0, targets: [] }]);
        s = passUntil(s, (state) => state.stack.length === 0);
      }
      const pumped = getPower(s, 'dragon');
      const refusal = refused(s, { type: 'activate', player: 0, card: 'dragon', ability: 0, targets: [] }, 'not enough mana');
      return first(expectValue(pumped, 6, 'power after two activations'), refusal);
    },
  },
  {
    id: 'F22',
    title: 'Cleanup: discard down to seven cards',
    run: () => {
      const s = passUntil(
        createScenario({ step: 'main2', players: [{ hand: Array.from({ length: 9 }, () => 'forest') }, {}] }),
        (state) => state.pending?.kind === 'discard',
      );
      return expectValue(s.pending, { kind: 'discard', player: 0, count: 2 }, 'pending decision');
    },
  },
  {
    id: 'F23',
    title: 'Game over: 0 life, empty library, concession',
    run: () => {
      let burn = createScenario({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, { life: 2 }] });
      burn = play(burn, [{ type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] }]);
      burn = passUntil(burn, (state) => state.pending?.kind === 'gameOver');
      const decked = passUntil(createScenario({ activePlayer: 1, players: [{ library: [] }, {}] }), (state) => state.pending?.kind === 'gameOver');
      const conceded = play(createScenario({ players: [{}, {}] }), [{ type: 'concede', player: 1 }]);
      return first(
        expectValue(burn.pending, { kind: 'gameOver', winner: 0, reason: 'life' }, 'burn'),
        expectValue(decked.pending, { kind: 'gameOver', winner: 1, reason: 'decked' }, 'decking'),
        expectValue(conceded.pending, { kind: 'gameOver', winner: 0, reason: 'concede' }, 'concession'),
      );
    },
  },
  {
    id: 'F24',
    title: 'Legal actions: everything the engine lists is accepted, bad input is refused with a reason',
    run: () => {
      let s = createGame({ seed: 31, skipMulligans: true });
      for (let i = 0; i < 400 && s.pending?.kind !== 'gameOver'; i++) {
        const actions = getLegalActions(s, { limit: 16 });
        for (const action of actions) {
          const result = tryApplyAction(s, action);
          if (!result.ok) return `listed action refused: ${JSON.stringify(action)} (${result.error})`;
        }
        s = applyAction(s, actions[i % actions.length] as Action);
      }
      const bad = tryApplyAction(s, { type: 'nope' } as unknown as Action);
      return bad.ok ? 'a malformed action was accepted' : null;
    },
  },
  {
    id: 'F25',
    title: 'Replays: seed plus actions reproduces the game exactly',
    run: () => {
      const game = aiGame(12);
      if (game.problem) return game.problem;
      let replay = createGame({ seed: 12 });
      for (const action of game.actions) replay = applyAction(replay, action);
      return expectValue(JSON.stringify(replay) === JSON.stringify(game.state), true, 'replayed state matches');
    },
  },
  {
    id: 'F26',
    title: 'Invariants hold after every action of a full AI vs AI game',
    run: () => {
      const game = aiGame(99, (s) => {
        const problems = checkInvariants(s);
        return problems.length ? problems.join('; ') : null;
      });
      return game.problem;
    },
  },
  {
    id: 'F27',
    title: 'AI: casts burn at the opponent when it is lethal',
    run: () => {
      const s = createScenario({
        activePlayer: 1,
        players: [{ life: 2 }, { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }],
      });
      return expectValue(chooseAction(s, 1), { type: 'cast', player: 1, card: 'snap', targets: [{ player: 0 }] }, 'AI action');
    },
  },
  {
    id: 'F28',
    title: 'AI: chump-blocks when the attack would otherwise be lethal',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [{ battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, { life: 3, battlefield: [{ card: 'bramble_warden', id: 'warden' }] }],
        }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['rhino'] }]));
      const action = chooseAction(s, 1 as PlayerId);
      return expectValue(action.type === 'declareBlockers' ? action.blocks : null, [{ blocker: 'warden', attacker: 'rhino' }], 'AI blocks');
    },
  },
];

export function runChecks(ids?: string[]): CheckResult[] {
  const selected = ids?.length ? CHECKS.filter((check) => ids.includes(check.id)) : CHECKS;
  return selected.map((check) => {
    try {
      const problem = check.run();
      return { id: check.id, title: check.title, ok: problem === null, detail: problem ?? 'ok' };
    } catch (error) {
      return { id: check.id, title: check.title, ok: false, detail: `threw: ${(error as Error).message}` };
    }
  });
}
