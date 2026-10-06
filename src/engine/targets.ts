import type { Refusal } from './refusals';
import { allCreatures, hasKeyword, isCreature } from './state';
import type { CardId, GameState, PlayerId, Target, TargetSpec } from './types';

export function isPlayerTarget(target: Target): target is { player: PlayerId } {
  return 'player' in target;
}

export function targetKey(target: Target): string {
  return isPlayerTarget(target) ? `p${target.player}` : target.card;
}

export function sameTarget(a: Target, b: Target): boolean {
  return targetKey(a) === targetKey(b);
}

export function isSpellOnStack(s: GameState, id: CardId): boolean {
  return s.cards[id]?.zone === 'stack' && s.stack.some((item) => item.kind === 'spell' && item.card === id);
}

export function isLegalTarget(s: GameState, controller: PlayerId, spec: TargetSpec, target: Target): boolean {
  if (isPlayerTarget(target)) {
    if (target.player !== 0 && target.player !== 1) return false;
    if (spec.kind === 'creature' || spec.kind === 'spell') return false;
    if (spec.kind === 'player' && spec.controller === 'you') return target.player === controller;
    if (spec.kind === 'player' && spec.controller === 'opponent') return target.player !== controller;
    return true;
  }
  if (spec.kind === 'spell') return isSpellOnStack(s, target.card);
  const card = s.cards[target.card];
  if (!card || card.zone !== 'battlefield' || !isCreature(s, target.card)) return false;
  if (spec.kind === 'player') return false;
  if (card.controller !== controller && hasKeyword(s, target.card, 'hexproof')) return false;
  if (spec.kind === 'creature') {
    if (spec.controller === 'you' && card.controller !== controller) return false;
    if (spec.controller === 'opponent' && card.controller === controller) return false;
    if (spec.tapped && !card.tapped) return false;
  }
  return true;
}

export function legalTargets(s: GameState, controller: PlayerId, spec: TargetSpec): Target[] {
  const candidates: Target[] = [{ player: controller }, { player: controller === 0 ? 1 : 0 }];
  for (const id of allCreatures(s)) candidates.push({ card: id });
  for (const item of [...s.stack].reverse()) if (item.kind === 'spell') candidates.push({ card: item.card });
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

export function targetsError(
  s: GameState,
  controller: PlayerId,
  specs: TargetSpec[],
  targets: Target[],
): Refusal | null {
  if (!Array.isArray(targets)) return { code: 'targetsNotList' };
  if (targets.length !== specs.length) return { code: 'targetCount', given: targets.length, expected: specs.length };
  for (let i = 0; i < specs.length; i++) {
    const target = targets[i] as Target;
    if (!target || typeof target !== 'object') return { code: 'targetMalformed', index: i };
    if (!isLegalTarget(s, controller, specs[i] as TargetSpec, target))
      return { code: 'illegalTarget', index: i, target: targetKey(target) };
    for (let j = 0; j < i; j++) {
      if (sameTarget(targets[j] as Target, target)) return { code: 'sameTargetTwice' };
    }
  }
  return null;
}
