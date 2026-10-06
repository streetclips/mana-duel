import { applyDamage, sourceHasKeyword, type DamageAssignment } from './effects';
import { compareIds } from './mana';
import {
  creaturesOf,
  getCard,
  getPower,
  getToughness,
  hasKeyword,
  isCreature,
  isReadyToTap,
  onBattlefield,
  opponent,
  queueTriggers,
} from './state';
import type { Refusal } from './refusals';
import { isPlayerTarget } from './targets';
import type { Block, CardId, GameState, PlayerId } from './types';

export function defendingPlayer(s: GameState): PlayerId {
  return opponent(s.activePlayer);
}

export function canAttack(s: GameState, id: CardId): boolean {
  const card = s.cards[id];
  if (!card || card.zone !== 'battlefield' || card.controller !== s.activePlayer) return false;
  if (!isCreature(s, id) || card.tapped || hasKeyword(s, id, 'defender')) return false;
  return isReadyToTap(s, id);
}

export function eligibleAttackers(s: GameState): CardId[] {
  return creaturesOf(s, s.activePlayer).filter((id) => canAttack(s, id));
}

export function canBlockAttacker(s: GameState, blocker: CardId, attacker: CardId): boolean {
  const card = s.cards[blocker];
  if (!card || card.zone !== 'battlefield' || card.controller !== defendingPlayer(s)) return false;
  if (!isCreature(s, blocker) || card.tapped) return false;
  if (!s.combat?.attackers.includes(attacker)) return false;
  if (hasKeyword(s, attacker, 'flying') && !hasKeyword(s, blocker, 'flying') && !hasKeyword(s, blocker, 'reach')) {
    return false;
  }
  if (hasKeyword(s, attacker, 'skulk') && getPower(s, blocker) > getPower(s, attacker)) return false;
  return true;
}

export function blockOptions(s: GameState): Record<CardId, CardId[]> {
  const options: Record<CardId, CardId[]> = {};
  if (!s.combat) return options;
  for (const blocker of creaturesOf(s, defendingPlayer(s))) {
    const attackers = s.combat.attackers.filter((attacker) => canBlockAttacker(s, blocker, attacker));
    if (attackers.length > 0) options[blocker] = attackers;
  }
  return options;
}

export function attackersError(s: GameState, attackers: unknown): Refusal | null {
  if (!Array.isArray(attackers)) return { code: 'attackersNotList' };
  const seen = new Set<string>();
  for (const id of attackers) {
    if (typeof id !== 'string') return { code: 'attackersNotIds' };
    if (seen.has(id)) return { code: 'attackerTwice', card: id };
    seen.add(id);
    if (!canAttack(s, id)) return { code: 'cannotAttack', card: id };
  }
  return null;
}

export function blocksError(s: GameState, blocks: unknown): Refusal | null {
  if (!Array.isArray(blocks)) return { code: 'blocksNotList' };
  const combat = s.combat;
  if (!combat) return { code: 'noCombat' };
  const blockers = new Set<string>();
  for (const block of blocks as Block[]) {
    if (!block || typeof block.blocker !== 'string' || typeof block.attacker !== 'string')
      return { code: 'malformedBlock' };
    if (blockers.has(block.blocker)) return { code: 'blockerTwice', card: block.blocker };
    blockers.add(block.blocker);
    if (!canBlockAttacker(s, block.blocker, block.attacker))
      return { code: 'cannotBlock', blocker: block.blocker, attacker: block.attacker };
  }
  for (const attacker of combat.attackers) {
    if (!hasKeyword(s, attacker, 'menace')) continue;
    const count = (blocks as Block[]).filter((block) => block.attacker === attacker).length;
    if (count === 1) return { code: 'menace', attacker };
  }
  return null;
}

export function performDeclareAttackers(s: GameState, attackers: CardId[]): void {
  const combat = s.combat;
  if (!combat) throw new Error('declareAttackers outside of combat');
  combat.attackers = [...attackers];
  for (const id of attackers) {
    if (!hasKeyword(s, id, 'vigilance')) getCard(s, id).tapped = true;
  }
  s.events.push({ t: 'attack', player: s.activePlayer, attackers: [...attackers] });
  for (const id of attackers) queueTriggers(s, id, 'attacks', s.activePlayer);
}

export function performDeclareBlockers(s: GameState, blocks: Block[]): void {
  const combat = s.combat;
  if (!combat) throw new Error('declareBlockers outside of combat');
  combat.blocks = blocks.map((block) => ({ blocker: block.blocker, attacker: block.attacker }));
  combat.blocked = combat.attackers.filter((attacker) => blocks.some((block) => block.attacker === attacker));
  combat.blockersDeclared = true;
  s.events.push({ t: 'block', player: defendingPlayer(s), blocks: combat.blocks.map((block) => ({ ...block })) });
}

export function combatants(s: GameState): CardId[] {
  const combat = s.combat;
  if (!combat) return [];
  const ids = [...combat.attackers, ...combat.blocks.map((block) => block.blocker)];
  return [...new Set(ids)].filter((id) => onBattlefield(s, id));
}

export function hasFirstStrikeCombatant(s: GameState): boolean {
  return combatants(s).some((id) => hasKeyword(s, id, 'firstStrike') || hasKeyword(s, id, 'doubleStrike'));
}

export function blockersOf(s: GameState, attacker: CardId): CardId[] {
  const combat = s.combat;
  if (!combat) return [];
  return combat.blocks
    .filter((block) => block.attacker === attacker && onBattlefield(s, block.blocker))
    .map((block) => block.blocker);
}

export function lethalDamage(s: GameState, id: CardId, deathtouch: boolean): number {
  const remaining = getToughness(s, id) - getCard(s, id).damage;
  return deathtouch ? 1 : Math.max(1, remaining);
}

export function orderBlockersForDamage(s: GameState, attacker: CardId, blockers: CardId[]): CardId[] {
  const deathtouch = sourceHasKeyword(s, attacker, 'deathtouch');
  return [...blockers].sort((a, b) => {
    const lethal = lethalDamage(s, a, deathtouch) - lethalDamage(s, b, deathtouch);
    if (lethal !== 0) return lethal;
    const value = getPower(s, b) + getToughness(s, b) - (getPower(s, a) + getToughness(s, a));
    return value !== 0 ? value : compareIds(a, b);
  });
}

function dealsDamageInStep(s: GameState, id: CardId, kind: 'first' | 'regular'): boolean {
  const firstStrike = hasKeyword(s, id, 'firstStrike');
  const doubleStrike = hasKeyword(s, id, 'doubleStrike');
  if (kind === 'first') return firstStrike || doubleStrike;
  const firstStrikers = s.combat?.firstStrikers;
  if (!firstStrikers) return true;
  return !firstStrikers.includes(id) || doubleStrike;
}

export function assignCombatDamage(s: GameState, kind: 'first' | 'regular'): DamageAssignment[] {
  const combat = s.combat;
  if (!combat) return [];
  const defender = defendingPlayer(s);
  const assignments: DamageAssignment[] = [];

  for (const attacker of combat.attackers) {
    if (!onBattlefield(s, attacker) || !dealsDamageInStep(s, attacker, kind)) continue;
    const power = getPower(s, attacker);
    if (power <= 0) continue;
    const trample = hasKeyword(s, attacker, 'trample');
    if (!combat.blocked.includes(attacker)) {
      assignments.push({ source: attacker, target: { player: defender }, amount: power });
      continue;
    }
    const blockers = orderBlockersForDamage(s, attacker, blockersOf(s, attacker));
    if (blockers.length === 0) {
      if (trample) assignments.push({ source: attacker, target: { player: defender }, amount: power });
      continue;
    }
    const deathtouch = sourceHasKeyword(s, attacker, 'deathtouch');
    let remaining = power;
    blockers.forEach((blocker, index) => {
      if (remaining <= 0) return;
      const isLast = index === blockers.length - 1;
      const amount = isLast && !trample ? remaining : Math.min(remaining, lethalDamage(s, blocker, deathtouch));
      assignments.push({ source: attacker, target: { card: blocker }, amount });
      remaining -= amount;
    });
    if (remaining > 0 && trample) {
      assignments.push({ source: attacker, target: { player: defender }, amount: remaining });
    }
  }

  for (const block of combat.blocks) {
    const { blocker, attacker } = block;
    if (!onBattlefield(s, blocker) || !onBattlefield(s, attacker)) continue;
    if (!dealsDamageInStep(s, blocker, kind)) continue;
    const power = getPower(s, blocker);
    if (power > 0) assignments.push({ source: blocker, target: { card: attacker }, amount: power });
  }
  return assignments;
}

export function performCombatDamage(s: GameState, kind: 'first' | 'regular'): void {
  const combat = s.combat;
  if (!combat) return;
  if (kind === 'first') {
    combat.firstStrikers = combatants(s).filter((id) => dealsDamageInStep(s, id, 'first'));
  }
  const assignments = assignCombatDamage(s, kind);
  applyDamage(s, assignments, true);
  const hits = assignments.filter((assignment) => assignment.amount > 0 && isPlayerTarget(assignment.target));
  for (const source of new Set(hits.map((hit) => hit.source))) {
    queueTriggers(s, source, 'damagesPlayer', getCard(s, source).controller);
  }
}
