import { blockOptions, blocksError, eligibleAttackers } from './combat';
import { activationBlocker, castBlocker, landPlayError } from './rules';
import { MAX_MULLIGANS, defOf, isLandDef, triggeredAbility } from './state';
import { targetCombos } from './targets';
import type { Action, Block, CardId, GameState, PlayerId } from './types';

export const DEFAULT_ENUMERATION_LIMIT = 4096;

export interface EnumerationOptions {
  limit?: number;
}

export function getLegalActions(s: GameState, options: EnumerationOptions = {}): Action[] {
  const pending = s.pending;
  if (!pending || pending.kind === 'gameOver') return [];
  const limit = options.limit ?? DEFAULT_ENUMERATION_LIMIT;
  const player = pending.player;
  switch (pending.kind) {
    case 'mulligan': {
      const actions: Action[] = [{ type: 'keep', player }];
      if (s.players[player].mulligans < MAX_MULLIGANS) actions.push({ type: 'mulligan', player });
      return actions;
    }
    case 'bottom':
      return combinations(s.players[player].hand, pending.count, limit).map((cards) => ({
        type: 'bottom',
        player,
        cards,
      }));
    case 'discard':
      return combinations(s.players[player].hand, pending.count, limit).map((cards) => ({
        type: 'discard',
        player,
        cards,
      }));
    case 'priority':
      return priorityActions(s, player);
    case 'declareAttackers':
      return subsets(eligibleAttackers(s), limit).map((attackers) => ({ type: 'declareAttackers', player, attackers }));
    case 'declareBlockers':
      return blockAssignments(s, limit).map((blocks) => ({ type: 'declareBlockers', player, blocks }));
    case 'chooseTargets': {
      const trigger = s.triggers.find((candidate) => candidate.id === pending.trigger);
      if (!trigger) return [];
      const ability = triggeredAbility(defOf(s, trigger.source), trigger.ability);
      return targetCombos(s, player, ability?.targets ?? []).map((targets) => ({
        type: 'chooseTargets',
        player,
        targets,
      }));
    }
  }
}

export function forcedAction(s: GameState): Action | null {
  const legal = getLegalActions(s, { limit: 2 });
  return legal.length === 1 ? (legal[0] as Action) : null;
}

export function priorityActions(s: GameState, player: PlayerId): Action[] {
  const actions: Action[] = [{ type: 'pass', player }];
  for (const id of s.players[player].hand) {
    const def = defOf(s, id);
    if (isLandDef(def)) {
      if (!landPlayError(s, player, id)) actions.push({ type: 'playLand', player, card: id });
      continue;
    }
    if (castBlocker(s, player, id)) continue;
    for (const targets of targetCombos(s, player, def.spell?.targets ?? [])) {
      actions.push({ type: 'cast', player, card: id, targets });
    }
  }
  for (const id of s.players[player].battlefield) {
    const abilities = defOf(s, id).activated ?? [];
    abilities.forEach((ability, index) => {
      if (activationBlocker(s, player, id, index)) return;
      for (const targets of targetCombos(s, player, ability.targets)) {
        actions.push({ type: 'activate', player, card: id, ability: index, targets });
      }
    });
  }
  return actions;
}

export function subsets<T>(items: T[], limit = DEFAULT_ENUMERATION_LIMIT): T[][] {
  const result: T[][] = [];
  const total = items.length >= 30 ? Number.MAX_SAFE_INTEGER : 2 ** items.length;
  for (let mask = 0; mask < total && result.length < limit; mask++) {
    result.push(items.filter((_, index) => (mask & (1 << index)) !== 0));
  }
  return result;
}

export function combinations<T>(items: T[], count: number, limit = DEFAULT_ENUMERATION_LIMIT): T[][] {
  const result: T[][] = [];
  const chosen: T[] = [];
  const walk = (start: number): void => {
    if (result.length >= limit) return;
    if (chosen.length === count) {
      result.push([...chosen]);
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i] as T);
      walk(i + 1);
      chosen.pop();
      if (result.length >= limit) return;
    }
  };
  walk(0);
  return result;
}

export function blockAssignments(s: GameState, limit = DEFAULT_ENUMERATION_LIMIT): Block[][] {
  const options = blockOptions(s);
  const blockers = Object.keys(options);
  const result: Block[][] = [];
  const chosen: Block[] = [];
  const walk = (index: number): void => {
    if (result.length >= limit) return;
    if (index === blockers.length) {
      if (!blocksError(s, chosen)) result.push(chosen.map((block) => ({ ...block })));
      return;
    }
    const blocker = blockers[index] as CardId;
    walk(index + 1);
    for (const attacker of options[blocker] ?? []) {
      chosen.push({ blocker, attacker });
      walk(index + 1);
      chosen.pop();
      if (result.length >= limit) return;
    }
  };
  walk(0);
  return result;
}
