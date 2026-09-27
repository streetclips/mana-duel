import { allCreatures, getCard, isCreature } from './state';
import type { GameState, PlayerId, Target, TargetSpec } from './types';

export function isPlayerTarget(target: Target): target is { player: PlayerId } {
  return 'player' in target;
}

export function targetKey(target: Target): string {
  return isPlayerTarget(target) ? `p${target.player}` : target.card;
}

export function sameTarget(a: Target, b: Target): boolean {
  return targetKey(a) === targetKey(b);
}

export function isLegalTarget(s: GameState, controller: PlayerId, spec: TargetSpec, target: Target): boolean {
  if (isPlayerTarget(target)) {
    if (target.player !== 0 && target.player !== 1) return false;
    if (spec.kind === 'creature') return false;
    if (spec.kind === 'player' && spec.controller === 'you') return target.player === controller;
    if (spec.kind === 'player' && spec.controller === 'opponent') return target.player !== controller;
    return true;
  }
  const card = s.cards[target.card];
  if (!card || card.zone !== 'battlefield' || !isCreature(s, target.card)) return false;
  if (spec.kind === 'player') return false;
  if (spec.kind === 'creature') {
    if (spec.controller === 'you' && card.controller !== controller) return false;
    if (spec.controller === 'opponent' && card.controller === controller) return false;
  }
  return true;
}

export function legalTargets(s: GameState, controller: PlayerId, spec: TargetSpec): Target[] {
  const candidates: Target[] = [{ player: controller }, { player: controller === 0 ? 1 : 0 }];
  for (const id of allCreatures(s)) candidates.push({ card: id });
  return candidates.filter((target) => isLegalTarget(s, controller, spec, target));
}

export function targetCombos(s: GameState, controller: PlayerId, specs: TargetSpec[]): Target[][] {
  if (specs.length === 0) return [[]];
  const options = specs.map((spec) => legalTargets(s, controller, spec));
  const combos: Target[][] = [];
  const walk = (index: number, chosen: Target[]): void => {
    if (index === specs.length) {
      combos.push([...chosen]);
      return;
    }
    for (const target of options[index] ?? []) {
      if (chosen.some((other) => sameTarget(other, target))) continue;
      chosen.push(target);
      walk(index + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return combos;
}

export function targetsError(s: GameState, controller: PlayerId, specs: TargetSpec[], targets: Target[]): string | null {
  if (!Array.isArray(targets)) return 'targets must be an array';
  if (targets.length !== specs.length) return `expected ${specs.length} target(s), got ${targets.length}`;
  for (let i = 0; i < specs.length; i++) {
    const target = targets[i] as Target;
    if (!target || typeof target !== 'object') return `target ${i} is malformed`;
    if (!isLegalTarget(s, controller, specs[i] as TargetSpec, target)) return `target ${i} (${targetKey(target)}) is not legal`;
    for (let j = 0; j < i; j++) {
      if (sameTarget(targets[j] as Target, target)) return 'the same target cannot be chosen twice';
    }
  }
  return null;
}

export function describeTargetOwner(s: GameState, target: Target): PlayerId {
  return isPlayerTarget(target) ? target.player : getCard(s, target.card).controller;
}
