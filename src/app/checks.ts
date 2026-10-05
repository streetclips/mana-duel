import { chooseAction } from '../ai';
import {
  DECK_LIST,
  applyAction,
  blockOptions,
  castBlocker,
  checkInvariants,
  createGame,
  createScenario,
  deckSize,
  eligibleAttackers,
  expandDeck,
  getCardDef,
  getKeywords,
  getLegalActions,
  getPower,
  getToughness,
  tryApplyAction,
  type Action,
  type GameState,
  type PlayerId,
} from '../engine';
import { fxCues, type FxCue } from './fx';

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

function resolve(s: GameState): GameState {
  return passUntil(s, (state) => state.stack.length === 0 || state.pending?.kind !== 'priority');
}

function animateUntil(state: GameState, done: (s: GameState) => boolean): { state: GameState; cues: FxCue[] } {
  const cues: FxCue[] = [];
  let before = state;
  const s = passUntil(state, (current) => {
    if (current !== before) {
      cues.push(...fxCues(before, current));
      before = current;
    }
    return done(current);
  });
  return { state: s, cues };
}

function aiGame(
  seed: number,
  onState?: (s: GameState) => string | null,
  decks: [string, string] = ['emberwild', 'emberwild'],
): { state: GameState; actions: Action[]; problem: string | null } {
  let s = createGame({ seed, players: [{ deck: decks[0] }, { deck: decks[1] }] });
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
        refused(s, { type: 'playLand', player: 0, card: 'f2' }, 'ya has jugado una tierra este turno'),
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
      return refused(s, { type: 'cast', player: 0, card: 'hound', targets: [] }, 'esto solo se puede lanzar en tu fase principal con la pila vacía');
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
        refused(wrongColor, { type: 'cast', player: 0, card: 'snap', targets: [{ player: 1 }] }, 'no hay suficiente maná'),
        refused(sickElf, { type: 'cast', player: 0, card: 'viper', targets: [] }, 'no hay suficiente maná'),
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
        refused(s, { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'elf', attacker: 'drake' }] }, 'elf no puede bloquear a drake'),
        refused(
          s,
          { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'elf', attacker: 'marauder' }] },
          'marauder tiene la habilidad de amenaza y no puede ser bloqueada excepto por dos o más criaturas',
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
      const refusal = refused(s, { type: 'activate', player: 0, card: 'dragon', ability: 0, targets: [] }, 'no hay suficiente maná');
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
    title: 'Replays: seed plus actions reproduces the game exactly, with or without its starting player',
    run: () => {
      const game = aiGame(12);
      if (game.problem) return game.problem;
      const replayed = (startingPlayer?: PlayerId): boolean => {
        let replay = createGame({ seed: 12, startingPlayer });
        for (const action of game.actions) replay = applyAction(replay, action);
        return JSON.stringify(replay) === JSON.stringify(game.state);
      };
      return first(
        expectValue(replayed(), true, 'replayed state matches'),
        expectValue(replayed(game.state.startingPlayer), true, 'replayed state with its starting player matches'),
      );
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
    id: 'F29',
    title: 'Decks: fourteen 40-card decks with 16 lands each and no nonland card in common',
    run: () => {
      const owners = new Map<string, number>();
      for (const deck of DECK_LIST) {
        for (const entry of deck.cards) owners.set(entry.card, (owners.get(entry.card) ?? 0) + 1);
      }
      const shared = [...owners].filter(([id, count]) => count > 1 && !getCardDef(id).supertypes?.includes('Basic')).map(([id]) => id);
      return first(
        expectValue(
          DECK_LIST.map((deck) => deck.id),
          [
            'emberwild',
            'dawntide',
            'duskmire',
            'stormglass',
            'sunmeadow',
            'brightforge',
            'mistgrave',
            'gloamwood',
            'vesperhall',
            'cindermaw',
            'deepgrove',
            'flamecrest',
            'wildland',
            'crossroads',
          ],
          'decks',
        ),
        expectValue(
          DECK_LIST.map((deck) => [deckSize(deck), expandDeck(deck).filter((id) => getCardDef(id).types.includes('land')).length]),
          DECK_LIST.map(() => [40, 16]),
          'cards and lands per deck',
        ),
        expectValue(shared, [], 'nonland cards in more than one deck'),
      );
    },
  },
  {
    id: 'F30',
    title: 'Counterspell: Turn the Tide counters a creature spell, which never enters',
    run: () => {
      let s = createScenario({
        activePlayer: 1,
        players: [
          { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
          { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
        ],
      });
      s = play(s, [
        { type: 'cast', player: 1, card: 'rhino', targets: [] },
        { type: 'pass', player: 1 },
        { type: 'cast', player: 0, card: 'tide', targets: [{ card: 'rhino' }] },
      ]);
      s = resolve(s);
      return expectValue([zone(s, 'rhino'), zone(s, 'tide'), s.stack.length], ['graveyard', 'graveyard', 0], 'zones and stack');
    },
  },
  {
    id: 'F31',
    title: 'Bounce: Undertow returns an attacker to its owner’s hand before it deals damage',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            { hand: [{ card: 'undertow', id: 'undertow' }], battlefield: ['island', 'island'] },
          ],
        }),
      );
      s = play(s, [
        { type: 'declareAttackers', player: 0, attackers: ['rhino'] },
        { type: 'pass', player: 0 },
        { type: 'cast', player: 1, card: 'undertow', targets: [{ card: 'rhino' }] },
      ]);
      s = toMain2(resolve(s));
      return expectValue([zone(s, 'rhino'), s.players[1].life], ['hand', 20], 'rhino zone and defender life');
    },
  },
  {
    id: 'F32',
    title: 'Shrinking: Withering Touch kills a 2-toughness creature and shrinks others until end of turn',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'withering_touch', id: 't1' }, { card: 'withering_touch', id: 't2' }], battlefield: ['swamp', 'swamp'] },
          { battlefield: [{ card: 'cinder_adept', id: 'adept' }, { card: 'timberland_rhino', id: 'rhino' }] },
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 't1', targets: [{ card: 'adept' }] }]));
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 't2', targets: [{ card: 'rhino' }] }]));
      const shrunk = [getPower(s, 'rhino'), getToughness(s, 'rhino')];
      s = passUntil(s, (state) => state.turn === 4 && state.pending?.kind === 'priority');
      return first(
        expectValue(zone(s, 'adept'), 'graveyard', 'adept'),
        expectValue([shrunk, [getPower(s, 'rhino'), getToughness(s, 'rhino')]], [[2, 2], [4, 4]], 'rhino this turn and next'),
      );
    },
  },
  {
    id: 'F33',
    title: "Tapped targets: Dawn's Verdict can only destroy a tapped creature",
    run: () => {
      const s = createScenario({
        players: [
          { hand: [{ card: 'dawns_verdict', id: 'verdict' }], battlefield: ['plains', 'plains', 'plains'] },
          { battlefield: [{ card: 'timberland_rhino', id: 'tapped', tapped: true }, { card: 'crag_dragon', id: 'untapped' }] },
        ],
      });
      const targets = getLegalActions(s).flatMap((action) => (action.type === 'cast' ? action.targets : []));
      const after = resolve(play(s, [{ type: 'cast', player: 0, card: 'verdict', targets: [{ card: 'tapped' }] }]));
      return first(
        expectValue(targets, [{ card: 'tapped' }], 'legal targets'),
        refused(s, { type: 'cast', player: 0, card: 'verdict', targets: [{ card: 'untapped' }] }, 'el objetivo 0 (untapped) no es legal'),
        expectValue(zone(after, 'tapped'), 'graveyard', 'tapped rhino'),
      );
    },
  },
  {
    id: 'F34',
    title: "Life payment: Night's Bargain draws two for 2 life, Dread Tyrant costs 2 life when it enters",
    run: () => {
      let bargain = createScenario({ players: [{ hand: [{ card: 'nights_bargain', id: 'bargain' }], battlefield: ['swamp', 'swamp'] }, {}] });
      bargain = resolve(play(bargain, [{ type: 'cast', player: 0, card: 'bargain', targets: [] }]));
      let tyrant = createScenario({ players: [{ hand: [{ card: 'dread_tyrant', id: 'tyrant' }], battlefield: ['swamp', 'swamp', 'swamp', 'swamp', 'swamp'] }, {}] });
      tyrant = resolve(play(tyrant, [{ type: 'cast', player: 0, card: 'tyrant', targets: [] }]));
      return first(
        expectValue([bargain.players[0].hand.length, bargain.players[0].life], [2, 18], "Night's Bargain hand and life"),
        expectValue([zone(tyrant, 'tyrant'), tyrant.players[0].life], ['battlefield', 18], 'Dread Tyrant zone and life'),
      );
    },
  },
  {
    id: 'F35',
    title: 'Death triggers: Gloom Wisp draws a card, Crypt Ghoul deals 1 damage to the opponent',
    run: () => {
      let wisp = createScenario({
        players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, { battlefield: [{ card: 'gloom_wisp', id: 'wisp' }] }],
      });
      wisp = resolve(play(wisp, [{ type: 'cast', player: 0, card: 'snap', targets: [{ card: 'wisp' }] }]));
      let ghoul = createScenario({
        players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, { battlefield: [{ card: 'crypt_ghoul', id: 'ghoul', damage: 1 }] }],
      });
      ghoul = play(ghoul, [
        { type: 'cast', player: 0, card: 'snap', targets: [{ card: 'ghoul' }] },
        { type: 'pass', player: 0 },
        { type: 'pass', player: 1 },
      ]);
      const asked = expectValue([ghoul.pending?.kind, ghoul.pending && 'player' in ghoul.pending ? ghoul.pending.player : null], ['chooseTargets', 1], 'pending decision');
      ghoul = resolve(play(ghoul, [{ type: 'chooseTargets', player: 1, targets: [{ player: 0 }] }]));
      return first(
        expectValue([zone(wisp, 'wisp'), wisp.players[1].hand.length], ['graveyard', 1], 'Gloom Wisp'),
        asked,
        expectValue([zone(ghoul, 'ghoul'), ghoul.players[0].life], ['graveyard', 19], 'Crypt Ghoul and its opponent'),
      );
    },
  },
  {
    id: 'F36',
    title: 'Every matchup plays to the end with sound invariants',
    run: () => {
      const ids = DECK_LIST.map((deck) => deck.id);
      for (const [index, first] of ids.entries()) {
        const second = ids[(index + 1) % ids.length] as string;
        const game = aiGame(40 + index, (s) => {
          const problems = checkInvariants(s);
          return problems.length ? problems.join('; ') : null;
        }, [first, second]);
        if (game.problem) return `${first} vs ${second}: ${game.problem}`;
      }
      return null;
    },
  },
  {
    id: 'F40',
    title: "Flash: Squall Skimmer is cast in the opponent's turn, in response to a spell; a creature without flash is not",
    run: () => {
      let s = createScenario({
        activePlayer: 1,
        players: [
          { hand: [{ card: 'squall_skimmer', id: 'skimmer' }, { card: 'galewing_falcon', id: 'falcon' }], battlefield: ['island', 'island', 'island'] },
          { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
        ],
      });
      s = play(s, [
        { type: 'cast', player: 1, card: 'snap', targets: [{ player: 0 }] },
        { type: 'pass', player: 1 },
      ]);
      const falcon = refused(s, { type: 'cast', player: 0, card: 'falcon', targets: [] }, 'esto solo se puede lanzar en tu fase principal con la pila vacía');
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'skimmer', targets: [] }]));
      return first(
        falcon,
        expectValue([zone(s, 'skimmer'), zone(s, 'snap'), s.players[0].life], ['battlefield', 'graveyard', 18], 'Squall Skimmer, Ember Snap and life'),
      );
    },
  },
  {
    id: 'F41',
    title: 'Prowess: Arc Initiate grows before the instant resolves; a creature spell does not trigger it',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'static_jolt', id: 'jolt' }, { card: 'kiln_sprite', id: 'sprite' }],
            battlefield: ['mountain', 'mountain', { card: 'arc_initiate', id: 'initiate' }],
          },
          {},
        ],
      });
      s = play(s, [{ type: 'cast', player: 0, card: 'jolt', targets: [{ player: 1 }] }]);
      const stacked = s.stack.map((item) => item.kind);
      s = play(s, [
        { type: 'pass', player: 0 },
        { type: 'pass', player: 1 },
      ]);
      const pumped = [getPower(s, 'initiate'), getToughness(s, 'initiate'), s.stack.length];
      s = resolve(s);
      const life = s.players[1].life;
      s = play(s, [{ type: 'cast', player: 0, card: 'sprite', targets: [] }]);
      return first(
        expectValue(stacked, ['spell', 'trigger'], 'stack after casting an instant'),
        expectValue(pumped, [3, 3, 1], 'Arc Initiate and the stack before the instant resolves'),
        expectValue(life, 19, 'opponent life'),
        expectValue(s.stack.map((item) => item.kind), ['spell'], 'stack after casting a creature'),
      );
    },
  },
  {
    id: 'F42',
    title: "+1/+1 counters: Wild Blossom's counters outlast the turn and are gone when the creature returns to hand",
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'wild_blossom', id: 'blossom' }, { card: 'undertow', id: 'undertow' }],
            battlefield: ['forest', 'forest', 'island', 'island', { card: 'beacon_squire', id: 'squire' }],
          },
          {},
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'blossom', targets: [{ card: 'squire' }] }]));
      s = passUntil(s, (state) => state.turn === 5 && state.step === 'main1' && state.pending?.kind === 'priority');
      const grown = [s.cards.squire?.counters, getPower(s, 'squire'), getToughness(s, 'squire')];
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'undertow', targets: [{ card: 'squire' }] }]));
      return first(
        expectValue(grown, [2, 4, 4], 'counters, power and toughness two turns later'),
        expectValue([zone(s, 'squire'), s.cards.squire?.counters], ['hand', 0], 'Beacon Squire after Undertow'),
      );
    },
  },
  {
    id: 'F43',
    title: 'Team pumps: Rally the Meadow gives each creature you control +1/+1, Sunmeadow Herald +1/+0 when it attacks, until end of turn',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'rally_the_meadow', id: 'rally' }],
            battlefield: ['plains', 'plains', { card: 'sunmeadow_herald', id: 'herald' }, { card: 'beacon_squire', id: 'squire' }],
          },
          { battlefield: [{ card: 'ember_hound', id: 'hound' }] },
        ],
      });
      const stats = (ids: string[]): number[][] => ids.map((id) => [getPower(s, id), getToughness(s, id)]);
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'rally', targets: [] }]));
      const rallied = stats(['herald', 'squire', 'hound']);
      s = resolve(play(toAttackers(s), [{ type: 'declareAttackers', player: 0, attackers: ['herald'] }]));
      const attacking = stats(['herald', 'squire']);
      s = passUntil(s, (state) => state.turn === 4 && state.pending?.kind === 'priority');
      return first(
        expectValue(rallied, [[3, 3], [3, 3], [2, 1]], 'after Rally the Meadow'),
        expectValue(attacking, [[4, 3], [4, 3]], 'after Sunmeadow Herald attacks'),
        expectValue(stats(['herald', 'squire']), [[2, 2], [2, 2]], 'on the next turn'),
      );
    },
  },
  {
    id: 'F44',
    title: 'Tokens: Raise the Banners creates two 1/1 Soldiers; a token that dies or returns to hand ceases to exist',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] },
          { hand: [{ card: 'ember_snap', id: 'snap' }, { card: 'undertow', id: 'undertow' }], battlefield: ['mountain', 'island', 'island'] },
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'banners', targets: [] }]));
      const tokens = s.players[0].battlefield.filter((id) => s.cards[id]?.def === 'soldier_token');
      const created = tokens.map((id) => [getPower(s, id), getToughness(s, id)]);
      const [dying = '', bounced = ''] = tokens;
      s = resolve(play(s, [{ type: 'pass', player: 0 }, { type: 'cast', player: 1, card: 'snap', targets: [{ card: dying }] }]));
      s = resolve(play(s, [{ type: 'pass', player: 0 }, { type: 'cast', player: 1, card: 'undertow', targets: [{ card: bounced }] }]));
      return first(
        expectValue(created, [[1, 1], [1, 1]], 'Soldier tokens'),
        expectValue(
          [zone(s, dying), zone(s, bounced), s.players[0].graveyard, s.players[0].hand],
          ['gone', 'gone', ['banners'], []],
          'tokens after Ember Snap and Undertow',
        ),
      );
    },
  },
  {
    id: 'F45',
    title: '"Another creature you control" triggers: Forge Cadet grows with each new creature, tokens included; two Rotwing Crows that die together drain for each other',
    run: () => {
      let cadet = createScenario({
        players: [{ hand: [{ card: 'muster_sergeant', id: 'sergeant' }], battlefield: ['plains', 'plains', { card: 'forge_cadet', id: 'cadet' }] }, {}],
      });
      cadet = resolve(play(cadet, [{ type: 'cast', player: 0, card: 'sergeant', targets: [] }]));
      let crows = toAttackers(
        createScenario({
          activePlayer: 1,
          players: [
            { battlefield: [{ card: 'rotwing_crow', id: 'a' }, { card: 'rotwing_crow', id: 'b' }] },
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
          ],
        }),
      );
      crows = toBlockers(play(crows, [{ type: 'declareAttackers', player: 1, attackers: ['rhino'] }]));
      crows = toMain2(
        play(crows, [
          {
            type: 'declareBlockers',
            player: 0,
            blocks: [
              { blocker: 'a', attacker: 'rhino' },
              { blocker: 'b', attacker: 'rhino' },
            ],
          },
        ]),
      );
      return first(
        expectValue([cadet.cards.cadet?.counters, getPower(cadet, 'cadet')], [2, 3], 'Forge Cadet after Muster Sergeant and its token'),
        expectValue([zone(crows, 'a'), zone(crows, 'b'), crows.players[1].life], ['graveyard', 'graveyard', 18], 'crows and the attacking player'),
      );
    },
  },
  {
    id: 'F46',
    title: 'Keyword grants: Charge of the Forge gives +1/+0 and first strike until end of turn; Brightforge Warlord gives itself haste as it arrives',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { hand: [{ card: 'charge_of_the_forge', id: 'charge' }], battlefield: ['mountain', 'plains', { card: 'soldier_token', id: 'soldier' }] },
            { battlefield: [{ card: 'beacon_squire', id: 'squire' }] },
          ],
        }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['soldier'] }]));
      s = resolve(
        play(s, [
          { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'squire', attacker: 'soldier' }] },
          { type: 'cast', player: 0, card: 'charge', targets: [] },
        ]),
      );
      const charged = [getPower(s, 'soldier'), getKeywords(s, 'soldier')];
      s = toMain2(s);
      let warlord = createScenario({
        players: [{ hand: [{ card: 'brightforge_warlord', id: 'warlord' }], battlefield: ['mountain', 'mountain', 'mountain', 'plains', 'plains'] }, {}],
      });
      warlord = toAttackers(resolve(play(warlord, [{ type: 'cast', player: 0, card: 'warlord', targets: [] }])));
      return first(
        expectValue(charged, [2, ['firstStrike']], 'Soldier after Charge of the Forge'),
        expectValue([zone(s, 'squire'), zone(s, 'soldier')], ['graveyard', 'battlefield'], 'after first-strike damage'),
        expectValue(eligibleAttackers(warlord), ['warlord'], 'attackers the turn Brightforge Warlord arrives'),
      );
    },
  },
  {
    id: 'F47',
    title: 'Skulk: creatures with greater power cannot block Fogslip Thief',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'fogslip_thief', id: 'thief' }] },
            { battlefield: [{ card: 'beacon_squire', id: 'squire' }, { card: 'timberland_rhino', id: 'rhino' }] },
          ],
        }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['thief'] }]));
      return first(
        expectValue(blockOptions(s), { squire: ['thief'] }, 'blockers for Fogslip Thief'),
        refused(s, { type: 'declareBlockers', player: 1, blocks: [{ blocker: 'rhino', attacker: 'thief' }] }, 'rhino no puede bloquear a thief'),
      );
    },
  },
  {
    id: 'F48',
    title: 'Discard: Memory Leech makes the opponent choose a card to discard; Sift the Depths draws two, then you discard one',
    run: () => {
      let leech = createScenario({
        players: [
          { hand: [{ card: 'memory_leech', id: 'leech' }], battlefield: ['swamp', 'swamp', 'swamp'] },
          { hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }] },
        ],
      });
      leech = resolve(play(leech, [{ type: 'cast', player: 0, card: 'leech', targets: [] }]));
      const asked = expectValue(leech.pending, { kind: 'discard', player: 1, count: 1, source: 'leech' }, 'pending decision');
      leech = play(leech, [{ type: 'discard', player: 1, cards: ['snap'] }]);
      let sift = createScenario({ players: [{ hand: [{ card: 'sift_the_depths', id: 'sift' }], battlefield: ['island', 'island'] }, {}] });
      sift = resolve(play(sift, [{ type: 'cast', player: 0, card: 'sift', targets: [] }]));
      const drawn = sift.players[0].hand.length;
      const card = sift.players[0].hand[0] as string;
      sift = play(sift, [{ type: 'discard', player: 0, cards: [card] }]);
      return first(
        asked,
        expectValue([zone(leech, 'snap'), leech.players[1].hand, leech.pending], ['graveyard', ['f'], { kind: 'priority', player: 0 }], 'after the discard'),
        expectValue([drawn, sift.players[0].hand.length, zone(sift, card)], [2, 1, 'graveyard'], 'Sift the Depths'),
      );
    },
  },
  {
    id: 'F49',
    title: '"Whenever this creature deals combat damage to a player": Hushwing Bat makes that player discard, Fogslip Thief draws a card',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'fogslip_thief', id: 'thief' }, { card: 'hushwing_bat', id: 'bat' }] },
            { hand: [{ card: 'forest', id: 'f' }] },
          ],
        }),
      );
      s = passUntil(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['thief', 'bat'] }]), (state) => state.pending?.kind === 'discard');
      const asked = expectValue(s.pending, { kind: 'discard', player: 1, count: 1, source: 'bat' }, 'pending decision');
      s = toMain2(play(s, [{ type: 'discard', player: 1, cards: ['f'] }]));
      return first(asked, expectValue([s.players[1].life, s.players[1].hand.length, s.players[0].hand.length], [17, 0, 1], 'life and hands'));
    },
  },
  {
    id: 'F50',
    title: 'Undying: Gravebloom Sprout returns with a +1/+1 counter the first time it dies, and stays dead the second time',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 's1' }, { card: 'ember_snap', id: 's2' }], battlefield: ['mountain', 'mountain'] },
          { battlefield: [{ card: 'gravebloom_sprout', id: 'sprout' }] },
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 's1', targets: [{ card: 'sprout' }] }]));
      const back = [zone(s, 'sprout'), s.cards.sprout?.counters, getPower(s, 'sprout'), getToughness(s, 'sprout')];
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 's2', targets: [{ card: 'sprout' }] }]));
      return first(
        expectValue(back, ['battlefield', 1, 2, 2], 'after the first death'),
        expectValue([zone(s, 'sprout'), s.stack.length], ['graveyard', 0], 'after the second death'),
      );
    },
  },
  {
    id: 'F51',
    title: 'Sacrifice: Bloodspore Thrall dies as the cost of its ability, and its undying trigger resolves before the ability',
    run: () => {
      let s = createScenario({ players: [{ battlefield: [{ card: 'bloodspore_thrall', id: 'thrall' }] }, {}] });
      s = play(s, [{ type: 'activate', player: 0, card: 'thrall', ability: 0, targets: [] }]);
      const paid = [zone(s, 'thrall'), s.stack.map((item) => item.kind)];
      s = play(s, [
        { type: 'pass', player: 0 },
        { type: 'pass', player: 1 },
      ]);
      const returned = [zone(s, 'thrall'), s.cards.thrall?.counters, s.players[1].life];
      s = resolve(s);
      return first(
        expectValue(paid, ['graveyard', ['activated', 'trigger']], 'after activating'),
        expectValue(returned, ['battlefield', 1, 20], 'after the undying trigger'),
        expectValue(s.players[1].life, 19, 'opponent life after the ability'),
      );
    },
  },
  {
    id: 'F52',
    title: '"Whenever you gain life": Vesper Novice grows and Sanguine Chorister drains; lifelink damage dealt at once is one gain',
    run: () => {
      let collector = createScenario({
        players: [
          {
            hand: [{ card: 'tithe_collector', id: 'collector' }],
            battlefield: ['swamp', 'swamp', { card: 'sanguine_chorister', id: 'chorister' }, { card: 'vesper_novice', id: 'novice' }],
          },
          {},
        ],
      });
      collector = resolve(play(collector, [{ type: 'cast', player: 0, card: 'collector', targets: [] }]));
      let combat = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'chantry_guard', id: 'guard' }, { card: 'ghostlit_penitent', id: 'penitent' }, { card: 'vesper_novice', id: 'novice' }] },
            {},
          ],
        }),
      );
      combat = toMain2(play(combat, [{ type: 'declareAttackers', player: 0, attackers: ['guard', 'penitent'] }]));
      return first(
        expectValue([collector.players[0].life, collector.players[1].life, collector.cards.novice?.counters], [21, 18, 1], 'after Tithe Collector'),
        expectValue([combat.players[0].life, combat.cards.novice?.counters], [23, 1], 'after two lifelink attackers'),
      );
    },
  },
  {
    id: 'F53',
    title: 'Bloodthirst: Blistering Hellion gets two +1/+1 counters only once the opponent was dealt damage this turn, until the turn ends',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'blistering_hellion', id: 'h1' }, { card: 'blistering_hellion', id: 'h2' }, { card: 'bloodfire_bolt', id: 'bolt' }],
            battlefield: ['mountain', 'mountain', 'mountain', 'mountain', 'mountain', 'mountain', 'swamp', 'swamp', 'swamp'],
          },
          {},
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'h1', targets: [] }]));
      const before = s.cards.h1?.counters;
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'bolt', targets: [{ player: 1 }] }]));
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'h2', targets: [] }]));
      const after = [s.cards.h2?.counters, getPower(s, 'h2'), getToughness(s, 'h2')];
      s = passUntil(s, (state) => state.activePlayer === 1 && state.step === 'main1' && state.pending?.kind === 'priority');
      return first(
        expectValue(before, 0, 'Blistering Hellion cast first'),
        expectValue(after, [2, 5, 4], 'Blistering Hellion cast after Bloodfire Bolt'),
        expectValue(s.players[1].damagedThisTurn, false, 'next turn'),
      );
    },
  },
  {
    id: 'F54',
    title: "Hexproof: Ember Snap can't target Mossfin Lurker; Shell of the Deep in response makes Magma Lance lose its target",
    run: () => {
      const snap = createScenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] },
          { battlefield: [{ card: 'mossfin_lurker', id: 'lurker' }] },
        ],
      });
      let lance = createScenario({
        players: [
          { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'mountain'] },
          { hand: [{ card: 'shell_of_the_deep', id: 'shell' }], battlefield: ['forest', { card: 'tanglejaw_croc', id: 'croc' }] },
        ],
      });
      lance = resolve(
        play(lance, [
          { type: 'cast', player: 0, card: 'lance', targets: [{ card: 'croc' }] },
          { type: 'pass', player: 0 },
          { type: 'cast', player: 1, card: 'shell', targets: [{ card: 'croc' }] },
        ]),
      );
      return first(
        refused(snap, { type: 'cast', player: 0, card: 'snap', targets: [{ card: 'lurker' }] }, 'el objetivo 0 (lurker) no es legal'),
        expectValue([zone(lance, 'croc'), zone(lance, 'lance'), getKeywords(lance, 'croc')], ['battlefield', 'graveyard', ['hexproof']], 'after Magma Lance'),
      );
    },
  },
  {
    id: 'F55',
    title: 'Evolve: Shoal Hatchling grows when Kelpweaver Druid enters, not when an equal creature does',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'kelpweaver_druid', id: 'druid' }, { card: 'shoal_hatchling', id: 'second' }],
            battlefield: ['forest', 'forest', 'forest', { card: 'shoal_hatchling', id: 'first' }],
          },
          {},
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'druid', targets: [] }]));
      const grown = [s.cards.first?.counters, getPower(s, 'first'), getToughness(s, 'first')];
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'second', targets: [] }]));
      return first(
        expectValue(grown, [1, 2, 2], 'after Kelpweaver Druid'),
        expectValue([s.cards.first?.counters, s.cards.second?.counters], [1, 0], 'after a second Shoal Hatchling'),
      );
    },
  },
  {
    id: 'F56',
    title: 'Bite: Snapjaw Strike makes Mossfin Lurker deal damage equal to its power to a creature, and it takes none back',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'snapjaw_strike', id: 'strike' }], battlefield: ['forest', 'forest', { card: 'mossfin_lurker', id: 'lurker' }] },
          { battlefield: [{ card: 'mossbark_bear', id: 'bear' }] },
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'strike', targets: [{ card: 'lurker' }, { card: 'bear' }] }]));
      return expectValue([zone(s, 'bear'), s.cards.lurker?.damage], ['graveyard', 0], 'after Snapjaw Strike');
    },
  },
  {
    id: 'F57',
    title: '"Whenever you cast an instant or sorcery spell": Flamecrest Mentor makes a Monk with prowess, which grows with the next spell',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'spark_volley', id: 'v1' }, { card: 'spark_volley', id: 'v2' }],
            battlefield: ['mountain', 'mountain', { card: 'flamecrest_mentor', id: 'mentor' }],
          },
          {},
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'v1', targets: [{ player: 1 }] }]));
      const monk = s.players[0].battlefield.find((id) => s.cards[id]?.def === 'monk_token') ?? 'none';
      const made = [getKeywords(s, monk), getPower(s, 'mentor'), getToughness(s, 'mentor')];
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'v2', targets: [{ player: 1 }] }]));
      return first(
        expectValue(made, [['prowess'], 4, 3], 'Monk keywords and Flamecrest Mentor after one spell'),
        expectValue([getPower(s, monk), getToughness(s, monk), s.players[1].life], [4, 2, 18], 'first Monk and life after two spells'),
      );
    },
  },
  {
    id: 'F58',
    title: 'Landfall: Cliff Lynx gets +2/+2 until end of turn and Quake Boar a +1/+1 counter for each land that enters under your control',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'forest', id: 'land' }], battlefield: [{ card: 'cliff_lynx', id: 'lynx' }, { card: 'quake_boar', id: 'boar' }] },
          { battlefield: [{ card: 'cliff_lynx', id: 'theirs' }] },
        ],
      });
      s = resolve(play(s, [{ type: 'playLand', player: 0, card: 'land' }]));
      const grown = [getPower(s, 'lynx'), getToughness(s, 'lynx'), s.cards.boar?.counters, getPower(s, 'theirs')];
      s = passUntil(s, (state) => state.turn === 5 && state.step === 'main1' && state.pending?.kind === 'priority');
      return first(
        expectValue(grown, [3, 3, 1, 1], 'after playing a land'),
        expectValue([getPower(s, 'lynx'), s.cards.boar?.counters], [1, 1], 'two turns later'),
      );
    },
  },
  {
    id: 'F59',
    title: 'Land search: Trail Scout puts a basic Forest from the library onto the battlefield tapped, and Deep Sowing puts another into the hand',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'trail_scout', id: 'scout' }, { card: 'deep_sowing', id: 'sowing' }],
            battlefield: ['forest', 'forest', 'forest', 'forest', 'forest'],
            library: ['mountain', { card: 'forest', id: 'f1' }, 'mountain', { card: 'forest', id: 'f2' }, { card: 'forest', id: 'f3' }],
          },
          {},
        ],
      });
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'scout', targets: [] }]));
      const scouted = [zone(s, 'f1'), s.cards.f1?.tapped, s.players[0].library.length];
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'sowing', targets: [] }]));
      const found = ['f2', 'f3'].map((id) => zone(s, id)).sort();
      return first(
        expectValue(scouted, ['battlefield', true, 4], 'after Trail Scout'),
        expectValue([found, s.players[0].library.length], [['battlefield', 'hand'], 2], 'after Deep Sowing'),
      );
    },
  },
  {
    id: 'F60',
    title: 'Extra land plays: Open Path lets you play a second land this turn, not a third',
    run: () => {
      let s = createScenario({
        players: [
          {
            hand: [{ card: 'open_path', id: 'path' }, { card: 'forest', id: 'f1' }, { card: 'forest', id: 'f2' }, { card: 'forest', id: 'f3' }],
            battlefield: ['forest'],
          },
          {},
        ],
      });
      s = play(s, [{ type: 'playLand', player: 0, card: 'f1' }]);
      const second = refused(s, { type: 'playLand', player: 0, card: 'f2' }, 'ya has jugado una tierra este turno');
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'path', targets: [] }]));
      s = play(s, [{ type: 'playLand', player: 0, card: 'f2' }]);
      return first(
        second,
        expectValue([zone(s, 'f2'), s.players[0].landsPlayedThisTurn], ['battlefield', 2], 'after Open Path'),
        refused(s, { type: 'playLand', player: 0, card: 'f3' }, 'ya has jugado todas las tierras que puedes este turno'),
      );
    },
  },
  {
    id: 'F61',
    title: 'Special lands: Silver Spire enters tapped and pays white, blue or black from the next turn; the Prismatic Fount and Wayfarer Druid pay any color',
    run: () => {
      let s = createScenario({
        players: [
          { hand: [{ card: 'silver_spire', id: 'spire' }, { card: 'sky_messenger', id: 'messenger' }], battlefield: ['plains'] },
          {},
        ],
      });
      s = play(s, [{ type: 'playLand', player: 0, card: 'spire' }]);
      const now = [s.cards.spire?.tapped, castBlocker(s, 0, 'messenger')];
      s = passUntil(s, (state) => state.turn === 5 && state.step === 'main1' && state.pending?.kind === 'priority');
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'messenger', targets: [] }]));
      let dragon = createScenario({
        players: [
          {
            hand: [{ card: 'prismatic_dragon', id: 'dragon' }],
            battlefield: ['silver_spire', 'ash_harbor', 'misty_meadow', 'prismatic_fount', 'wayfarer_druid'],
          },
          {},
        ],
      });
      dragon = resolve(play(dragon, [{ type: 'cast', player: 0, card: 'dragon', targets: [] }]));
      return first(
        expectValue(now, [true, 'no hay suficiente maná'], 'the turn Silver Spire is played'),
        expectValue(zone(s, 'messenger'), 'battlefield', 'Sky Messenger two turns later'),
        expectValue(zone(dragon, 'dragon'), 'battlefield', 'Prismatic Dragon paid by three tri-lands, the Fount and the Druid'),
      );
    },
  },
  {
    id: 'F62',
    title: 'Player setup: other starting life, another opening hand and permanents on the battlefield from the start, which trigger nothing',
    run: () => {
      const s = createGame({
        seed: 9,
        startingPlayer: 0,
        players: [{ life: 25, openingHand: 8, battlefield: ['soldier_token', 'mountain'] }, { life: 14, openingHand: 6 }],
      });
      const mulligan = play(createGame({ seed: 9, startingPlayer: 0, players: [{ openingHand: 8 }, {}] }), [{ type: 'mulligan', player: 0 }]);
      return first(
        expectValue(s.players.map((p) => [p.life, p.hand.length]), [[25, 8], [14, 6]], 'life and opening hands'),
        expectValue(s.players[0].battlefield.map((id) => [s.cards[id]?.def, s.cards[id]?.tapped, s.cards[id]?.summoningSick]), [
          ['soldier_token', false, false],
          ['mountain', false, false],
        ], 'permanents from the start'),
        expectValue(s.triggers.length, 0, 'triggers'),
        expectValue(mulligan.players[0].hand.length, 8, 'hand after a mulligan'),
      );
    },
  },
  {
    id: 'F63',
    title: 'Relics: beside their player from the start and never a target; the bell drains the opponent at its owner’s upkeep, the censer makes a Saproling for each instant or sorcery, the urn drains for each of its owner’s creatures that dies; a first-turn draw',
    run: () => {
      const kept = play(createGame({ seed: 9, startingPlayer: 0, players: [{ relics: ['bell'], drawOnFirstTurn: true }, { relics: ['censer'] }] }), [
        { type: 'keep', player: 0 },
        { type: 'keep', player: 1 },
      ]);
      const upkeep = [kept.step, kept.stack.map((item) => (item.kind === 'trigger' ? kept.cards[item.source]?.def : item.kind))];
      const turn = passUntil(kept, (state) => state.step === 'main1');
      let s = createScenario({
        players: [
          { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'], relics: [{ card: 'censer', id: 'censer' }] },
          { battlefield: [{ card: 'grove_tender', id: 'elf' }], relics: [{ card: 'urn', id: 'urn' }] },
        ],
      });
      const untargetable = refused(s, { type: 'cast', player: 0, card: 'snap', targets: [{ card: 'urn' }] }, 'el objetivo 0 (urn) no es legal');
      s = resolve(play(s, [{ type: 'cast', player: 0, card: 'snap', targets: [{ card: 'elf' }] }]));
      const saprolings = s.players[0].battlefield.filter((id) => s.cards[id]?.def === 'saproling_token').length;
      return first(
        expectValue(upkeep, ['upkeep', ['bell']], 'the first upkeep'),
        expectValue([turn.players[1].life, turn.players[0].hand.length], [19, 8], 'the first main phase'),
        untargetable,
        expectValue([saprolings, zone(s, 'elf'), s.players[0].life], [1, 'graveyard', 19], 'after Ember Snap kills the Grove Tender'),
      );
    },
  },
  {
    id: 'F38',
    title: 'Animations: an attacker and its blocker strike each other, and the blocker that dies keeps its place as it fades',
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
      s = play(s, [{ type: 'declareBlockers', player: 1, blocks: [{ blocker: 'spider', attacker: 'rhino' }] }]);
      const combat = animateUntil(s, (state) => state.step === 'main2');
      return expectValue(
        combat.cues,
        [
          { kind: 'strike', card: 'rhino', target: { card: 'spider' } },
          { kind: 'damage', card: 'spider', amount: 3 },
          { kind: 'strike', card: 'rhino', target: { player: 1 } },
          { kind: 'life', player: 1, delta: -1 },
          { kind: 'strike', card: 'spider', target: { card: 'rhino' } },
          { kind: 'damage', card: 'rhino', amount: 1 },
          { kind: 'dies', player: 1, card: 'spider', next: 'elf' },
        ],
        'combat animation cues',
      );
    },
  },
  {
    id: 'F39',
    title: "Animations: the opponent's spell is revealed with its target, burn shows the life lost, a new turn shows the card drawn",
    run: () => {
      const s = createScenario({
        activePlayer: 1,
        players: [{ library: [{ card: 'forest', id: 'top' }] }, { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }],
      });
      const cast = play(s, [{ type: 'cast', player: 1, card: 'snap', targets: [{ player: 0 }] }]);
      const resolved = animateUntil(cast, (state) => state.stack.length === 0);
      const turn = animateUntil(resolved.state, (state) => state.activePlayer === 0 && state.step === 'main1');
      return first(
        expectValue(fxCues(s, cast), [{ kind: 'play', player: 1, card: 'snap', via: 'cast', targets: [{ player: 0 }] }], 'cast cues'),
        expectValue(resolved.cues, [{ kind: 'life', player: 0, delta: -2 }], 'resolution cues'),
        expectValue(turn.cues, [{ kind: 'turn', player: 0, turn: 4 }, { kind: 'draw', player: 0, card: 'top' }], 'new turn cues'),
      );
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
    id: 'F37',
    title: 'AI: counters a big creature spell with Turn the Tide',
    run: () => {
      const s = play(
        createScenario({
          players: [
            { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
            { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
          ],
        }),
        [
          { type: 'cast', player: 0, card: 'rhino', targets: [] },
          { type: 'pass', player: 0 },
        ],
      );
      return expectValue(chooseAction(s, 1), { type: 'cast', player: 1, card: 'tide', targets: [{ card: 'rhino' }] }, 'AI action');
    },
  },
  {
    id: 'F28',
    title: 'AI: chump-blocks a lethal trampler with as many creatures as it takes',
    run: () => {
      let s = toAttackers(
        createScenario({
          players: [
            { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
            { life: 3, battlefield: [{ card: 'soldier_token', id: 's1' }, { card: 'soldier_token', id: 's2' }] },
          ],
        }),
      );
      s = toBlockers(play(s, [{ type: 'declareAttackers', player: 0, attackers: ['rhino'] }]));
      const action = chooseAction(s, 1 as PlayerId);
      return expectValue(
        action.type === 'declareBlockers' ? action.blocks : null,
        [
          { blocker: 's1', attacker: 'rhino' },
          { blocker: 's2', attacker: 'rhino' },
        ],
        'AI blocks',
      );
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
