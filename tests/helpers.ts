import { expect } from 'vitest';
import {
  applyAction,
  checkInvariants,
  createScenario,
  getCard,
  hasCardDef,
  registerCard,
  type Action,
  type Block,
  type CardDef,
  type CardId,
  type GameState,
  type PendingDecision,
  type PlayerId,
  type ScenarioSpec,
  type Target,
} from '../src/engine';

const TEST_CARDS: CardDef[] = [
  { id: 'test_bear', name: 'Test Bear', types: ['creature'], cost: '{1}{G}', power: 2, toughness: 2 },
  { id: 'test_giant', name: 'Test Giant', types: ['creature'], cost: '{4}{G}', power: 5, toughness: 5 },
  {
    id: 'test_wall',
    name: 'Test Wall',
    types: ['creature'],
    cost: '{1}',
    power: 0,
    toughness: 4,
    keywords: ['defender'],
  },
  {
    id: 'test_lifelinker',
    name: 'Test Lifelinker',
    types: ['creature'],
    cost: '{1}{G}',
    power: 2,
    toughness: 2,
    keywords: ['lifelink'],
  },
  {
    id: 'test_double_striker',
    name: 'Test Double Striker',
    types: ['creature'],
    cost: '{1}{R}',
    power: 2,
    toughness: 2,
    keywords: ['doubleStrike'],
  },
  {
    id: 'test_deathtouch_trampler',
    name: 'Test Deathtouch Trampler',
    types: ['creature'],
    cost: '{2}{G}',
    power: 4,
    toughness: 4,
    keywords: ['deathtouch', 'trample'],
  },
  {
    id: 'test_dies_draw',
    name: 'Test Dies Draw',
    types: ['creature'],
    cost: '{G}',
    power: 1,
    toughness: 1,
    triggers: [{ on: 'dies', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  },
  {
    id: 'test_dies_pinger',
    name: 'Test Dies Pinger',
    types: ['creature'],
    cost: '{R}',
    power: 1,
    toughness: 1,
    triggers: [{ on: 'dies', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] }],
  },
  {
    id: 'test_attack_pump',
    name: 'Test Attack Pump',
    types: ['creature'],
    cost: '{R}',
    power: 1,
    toughness: 1,
    triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'pump', power: 1, toughness: 0, to: 'self' }] }],
  },
  {
    id: 'test_pinger',
    name: 'Test Pinger',
    types: ['creature'],
    cost: '{1}{R}',
    power: 1,
    toughness: 1,
    activated: [
      { cost: '{R}', tap: true, targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] },
    ],
  },
  {
    id: 'test_murder',
    name: 'Test Murder',
    types: ['instant'],
    cost: '{1}{G}',
    spell: { targets: [{ kind: 'creature' }], effects: [{ kind: 'destroy', to: 0 }] },
  },
  {
    id: 'test_heal',
    name: 'Test Heal',
    types: ['sorcery'],
    cost: '{G}',
    spell: { targets: [], effects: [{ kind: 'gainLife', amount: 3 }] },
  },
  {
    id: 'test_dual',
    name: 'Test Dual Land',
    types: ['land'],
    mana: ['R', 'G'],
  },
  {
    id: 'test_double_hitter',
    name: 'Test Double Hitter',
    types: ['creature'],
    cost: '{1}{U}',
    power: 1,
    toughness: 1,
    keywords: ['doubleStrike'],
    triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  },
];

for (const def of TEST_CARDS) {
  if (!hasCardDef(def.id)) registerCard(def);
}

export function scenario(spec: ScenarioSpec): GameState {
  const s = createScenario(spec);
  expectSound(s);
  return s;
}

export function expectSound(s: GameState): void {
  expect(checkInvariants(s)).toEqual([]);
}

export function act(s: GameState, action: Action): GameState {
  const next = applyAction(s, action);
  expectSound(next);
  return next;
}

export function pendingOf<K extends PendingDecision['kind']>(
  s: GameState,
  kind: K,
): Extract<PendingDecision, { kind: K }> {
  expect(s.pending?.kind).toBe(kind);
  return s.pending as Extract<PendingDecision, { kind: K }>;
}

function decider(s: GameState): 0 | 1 {
  const pending = s.pending;
  if (!pending || pending.kind === 'gameOver') throw new Error('nobody has to decide');
  return pending.player;
}

export function pass(s: GameState): GameState {
  pendingOf(s, 'priority');
  return act(s, { type: 'pass', player: decider(s) });
}

export function passUntil(s: GameState, done: (state: GameState) => boolean, max = 300): GameState {
  let state = s;
  for (let i = 0; i < max; i++) {
    if (done(state)) return state;
    const pending = state.pending;
    if (pending?.kind === 'priority') state = pass(state);
    else if (pending?.kind === 'declareAttackers') {
      state = act(state, { type: 'declareAttackers', player: pending.player, attackers: [] });
    } else if (pending?.kind === 'declareBlockers') {
      state = act(state, { type: 'declareBlockers', player: pending.player, blocks: [] });
    } else throw new Error(`passUntil: stuck at ${pending?.kind} in ${state.step}`);
  }
  throw new Error('passUntil: condition never met');
}

export function passTo(s: GameState, kind: PendingDecision['kind']): GameState {
  return passUntil(s, (state) => state.pending?.kind === kind && state.pending.kind !== 'priority');
}

export function resolveStack(s: GameState): GameState {
  return passUntil(s, (state) => state.stack.length === 0 || state.pending?.kind !== 'priority');
}

export function passToStep(s: GameState, step: GameState['step'], turn?: number): GameState {
  return passUntil(
    s,
    (state) => state.step === step && (turn === undefined || state.turn === turn) && state.pending?.kind === 'priority',
  );
}

export function playLand(s: GameState, card: CardId): GameState {
  return act(s, { type: 'playLand', player: decider(s), card });
}

export function cast(s: GameState, card: CardId, targets: Target[] = []): GameState {
  return act(s, { type: 'cast', player: decider(s), card, targets });
}

export function activate(s: GameState, card: CardId, ability = 0, targets: Target[] = []): GameState {
  return act(s, { type: 'activate', player: decider(s), card, ability, targets });
}

export function attack(s: GameState, attackers: CardId[]): GameState {
  const ready = s.pending?.kind === 'declareAttackers' ? s : passTo(s, 'declareAttackers');
  return act(ready, { type: 'declareAttackers', player: decider(ready), attackers });
}

export function block(s: GameState, blocks: Block[]): GameState {
  const ready = s.pending?.kind === 'declareBlockers' ? s : passTo(s, 'declareBlockers');
  return act(ready, { type: 'declareBlockers', player: decider(ready), blocks });
}

export function chooseTargets(s: GameState, targets: Target[]): GameState {
  return act(s, { type: 'chooseTargets', player: decider(s), targets });
}

export function finishCombat(s: GameState): GameState {
  return passUntil(s, (state) => state.step === 'main2' && state.pending?.kind === 'priority');
}

export function zoneOf(s: GameState, id: CardId): string {
  return getCard(s, id).zone;
}

export function life(s: GameState, player: 0 | 1): number {
  return s.players[player].life;
}

export function lcg(seed: number): () => number {
  let r = seed >>> 0 || 1;
  return () => {
    r = (Math.imul(r, 1664525) + 1013904223) >>> 0;
    return r / 4294967296;
  };
}

export function scrambleHiddenInformation(s: GameState, viewer: PlayerId, seed: number): GameState {
  const copy = structuredClone(s);
  const rand = lcg(seed);
  const other = viewer === 0 ? 1 : 0;
  const groups = [[...copy.players[other].hand, ...copy.players[other].library], [...copy.players[viewer].library]];
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
