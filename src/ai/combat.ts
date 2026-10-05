import {
  applyAction,
  blockOptions,
  blocksError,
  cloneState,
  eligibleAttackers,
  getPower,
  type Block,
  type CardId,
  type GameState,
  type PlayerId,
} from '../engine';
import { creatureValue, evaluate, WIN_SCORE } from './evaluate';
import { rollout } from './rollout';

const MIN_GAIN = 0.01;
const MAX_ENUMERATED_ATTACKERS = 5;
const LIFE_CUSHION = 1000;

interface Outcome {
  damage: number;
  value: number;
}

interface Defense extends Outcome {
  blocks: Block[];
  flexibility: number;
}

interface Attempt {
  blocks: Block[];
  damage: number;
  survives: boolean;
}

type Preference = (a: Defense, b: Defense) => boolean;

function signature(s: GameState, id: CardId): string {
  const card = s.cards[id];
  if (!card) return id;
  const effects = s.effects
    .filter((effect) => effect.card === id)
    .map((effect) => `${effect.power}/${effect.toughness}/${(effect.keywords ?? []).join(',')}`);
  const state = [card.def, card.controller, card.counters, card.damage, card.deathtouchDamage, card.tapped, card.summoningSick];
  return [...state, ...effects].join('|');
}

function blockedSignature(s: GameState, blocks: Block[], attacker: CardId): string {
  const blockers = blocks.filter((block) => block.attacker === attacker).map((block) => signature(s, block.blocker));
  return `${signature(s, attacker)}[${blockers.sort().join('+')}]`;
}

function blockScore(s: GameState, player: PlayerId, blocks: Block[]): number {
  if (blocksError(s, blocks)) return Number.NEGATIVE_INFINITY;
  return evaluate(rollout(applyAction(s, { type: 'declareBlockers', player, blocks }), 1), player);
}

function completeBlock(
  s: GameState,
  blocks: Block[],
  candidate: Block,
  options: Record<CardId, CardId[]>,
  used: Set<CardId>,
): Block[] | null {
  const next = [...blocks, candidate];
  if (!blocksError(s, next)) return next;
  for (const other of Object.keys(options)) {
    if (other === candidate.blocker || used.has(other) || !options[other]?.includes(candidate.attacker)) continue;
    const withPartner = [...next, { blocker: other, attacker: candidate.attacker }];
    if (!blocksError(s, withPartner)) return withPartner;
  }
  return null;
}

function emergencyBlocks(s: GameState, player: PlayerId, options: Record<CardId, CardId[]>): Block[] {
  const attackers = [...(s.combat?.attackers ?? [])].sort((a, b) => getPower(s, b) - getPower(s, a));
  const blockers = Object.keys(options).sort((a, b) => creatureValue(s, a) - creatureValue(s, b));
  let blocks: Block[] = [];
  const used = new Set<CardId>();
  for (const attacker of attackers) {
    if (blockScore(s, player, blocks) > -WIN_SCORE / 2) break;
    for (const blocker of blockers) {
      if (used.has(blocker) || !options[blocker]?.includes(attacker)) continue;
      const next = completeBlock(s, blocks, { blocker, attacker }, options, used);
      if (!next) continue;
      for (const block of next) used.add(block.blocker);
      blocks = next;
      break;
    }
  }
  return blocks;
}

function cushioned(s: GameState, player: PlayerId): GameState {
  const t = cloneState(s);
  t.players[player].life += LIFE_CUSHION;
  return t;
}

function outcomeOf(cushion: GameState, player: PlayerId, blocks: Block[]): Outcome {
  const after = rollout(applyAction(cushion, { type: 'declareBlockers', player, blocks }), 1);
  const won = after.pending?.kind === 'gameOver' && after.pending.winner === player;
  return {
    damage: won ? Number.NEGATIVE_INFINITY : cushion.players[player].life - after.players[player].life,
    value: evaluate(after, player),
  };
}

function keepsMoreValue(a: Defense, b: Defense): boolean {
  return a.damage !== b.damage ? a.damage < b.damage : a.value > b.value;
}

function sparesFlexibleBlockers(a: Defense, b: Defense): boolean {
  if (a.damage !== b.damage) return a.damage < b.damage;
  return a.flexibility !== b.flexibility ? a.flexibility < b.flexibility : a.value > b.value;
}

function lowerDamage(
  s: GameState,
  player: PlayerId,
  options: Record<CardId, CardId[]>,
  cushion: GameState,
  gains: Map<string, Outcome>,
  prefer: Preference,
): Attempt {
  const life = s.players[player].life;
  let blocks: Block[] = [];
  let outcome = outcomeOf(cushion, player, blocks);
  for (;;) {
    if (outcome.damage < life && blockScore(s, player, blocks) > -WIN_SCORE / 2) return { blocks, damage: outcome.damage, survives: true };
    const used = new Set(blocks.map((block) => block.blocker));
    const tried = new Set<string>();
    let best: Defense | null = null;
    for (const blocker of Object.keys(options)) {
      if (used.has(blocker)) continue;
      for (const attacker of options[blocker] ?? []) {
        const key = `${signature(s, blocker)}>${blockedSignature(s, blocks, attacker)}`;
        if (tried.has(key)) continue;
        tried.add(key);
        const next = completeBlock(s, blocks, { blocker, attacker }, options, used);
        if (!next) continue;
        let gain = gains.get(key);
        if (!gain) {
          const after = outcomeOf(cushion, player, next);
          gain = { damage: outcome.damage - after.damage, value: after.value - outcome.value };
          gains.set(key, gain);
        }
        const flexibility = next.slice(blocks.length).reduce((sum, block) => sum + (options[block.blocker]?.length ?? 0), 0);
        const candidate = { blocks: next, damage: outcome.damage - gain.damage, value: outcome.value + gain.value, flexibility };
        if (!best || prefer(candidate, best)) best = candidate;
      }
    }
    if (!best || best.damage >= outcome.damage) return { blocks, damage: outcome.damage, survives: false };
    blocks = best.blocks;
    outcome = outcomeOf(cushion, player, blocks);
  }
}

function leastDamageBlocks(s: GameState, player: PlayerId, options: Record<CardId, CardId[]>): Block[] {
  const cushion = cushioned(s, player);
  const gains = new Map<string, Outcome>();
  const flexibilities = new Set(Object.values(options).map((attackers) => attackers.length));
  const preferences = flexibilities.size > 1 ? [keepsMoreValue, sparesFlexibleBlockers] : [keepsMoreValue];
  let fallback: Attempt | null = null;
  for (const prefer of preferences) {
    const attempt = lowerDamage(s, player, options, cushion, gains, prefer);
    if (attempt.survives) return attempt.blocks;
    if (!fallback || attempt.damage < fallback.damage) fallback = attempt;
  }
  return fallback?.blocks ?? [];
}

export function chooseBlocks(s: GameState, player: PlayerId): Block[] {
  const options = blockOptions(s);
  const blockers = Object.keys(options);
  if (blockers.length === 0) return [];

  let blocks: Block[] = [];
  let current = blockScore(s, player, blocks);
  if (current <= -WIN_SCORE / 2) {
    blocks = emergencyBlocks(s, player, options);
    current = blockScore(s, player, blocks);
    if (current <= -WIN_SCORE / 2) {
      blocks = leastDamageBlocks(s, player, options);
      current = blockScore(s, player, blocks);
    }
    if (current <= -WIN_SCORE / 2) return blocks;
  }

  for (let round = 0; round < blockers.length; round++) {
    const used = new Set(blocks.map((block) => block.blocker));
    const tried = new Set<string>();
    let bestBlocks: Block[] | null = null;
    let bestValue = current + MIN_GAIN;
    for (const blocker of blockers) {
      if (used.has(blocker)) continue;
      for (const attacker of options[blocker] ?? []) {
        const key = `${signature(s, blocker)}>${blockedSignature(s, blocks, attacker)}`;
        if (tried.has(key)) continue;
        tried.add(key);
        const candidate = completeBlock(s, blocks, { blocker, attacker }, options, used);
        if (!candidate) continue;
        const value = blockScore(s, player, candidate);
        if (value > bestValue) {
          bestValue = value;
          bestBlocks = candidate;
        }
      }
    }
    if (!bestBlocks) break;
    blocks = bestBlocks;
    current = bestValue;
  }
  return blocks;
}

export function attackValue(s: GameState, player: PlayerId, attackers: CardId[]): number {
  let t = rollout(applyAction(s, { type: 'declareAttackers', player, attackers }), 1);
  if (t.pending?.kind === 'declareBlockers') {
    const defender = t.pending.player;
    t = rollout(applyAction(t, { type: 'declareBlockers', player: defender, blocks: chooseBlocks(t, defender) }), 1);
  }
  return evaluate(t, player);
}

function allNonEmptySubsets(items: CardId[]): CardId[][] {
  const result: CardId[][] = [];
  for (let mask = 1; mask < 2 ** items.length; mask++) {
    result.push(items.filter((_, index) => (mask & (1 << index)) !== 0));
  }
  return result;
}

function improveAttack(s: GameState, player: PlayerId, eligible: CardId[], start: CardId[], startValue: number): CardId[] {
  let current = start;
  let currentValue = startValue;
  for (let round = 0; round < eligible.length * 2; round++) {
    let improved = false;
    let tried = new Set<string>();
    for (const id of eligible) {
      const attacking = current.includes(id);
      const key = `${signature(s, id)}${attacking ? '-' : '+'}`;
      if (tried.has(key)) continue;
      tried.add(key);
      const next = attacking ? current.filter((other) => other !== id) : [...current, id];
      const value = attackValue(s, player, next);
      if (value > currentValue + MIN_GAIN) {
        current = next;
        currentValue = value;
        improved = true;
        tried = new Set<string>();
      }
    }
    if (!improved) break;
  }
  return current;
}

export function chooseAttackers(s: GameState, player: PlayerId): CardId[] {
  const eligible = eligibleAttackers(s);
  if (eligible.length === 0) return [];
  let best: CardId[] = [];
  let bestValue = attackValue(s, player, []);
  if (eligible.length > MAX_ENUMERATED_ATTACKERS) {
    const allIn = attackValue(s, player, eligible);
    if (allIn > bestValue) {
      best = [...eligible];
      bestValue = allIn;
    }
    return improveAttack(s, player, eligible, best, bestValue);
  }
  for (const attackers of allNonEmptySubsets(eligible)) {
    const value = attackValue(s, player, attackers);
    if (value > bestValue + MIN_GAIN) {
      best = attackers;
      bestValue = value;
    }
  }
  return best;
}
