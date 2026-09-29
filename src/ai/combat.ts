import {
  applyAction,
  blockOptions,
  blocksError,
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

export function chooseBlocks(s: GameState, player: PlayerId): Block[] {
  const options = blockOptions(s);
  const blockers = Object.keys(options);
  if (blockers.length === 0) return [];

  let blocks: Block[] = [];
  let current = blockScore(s, player, blocks);
  if (current <= -WIN_SCORE / 2) {
    const emergency = emergencyBlocks(s, player, options);
    const emergencyScore = blockScore(s, player, emergency);
    if (emergencyScore > current) {
      blocks = emergency;
      current = emergencyScore;
    }
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
