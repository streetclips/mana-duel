import { parseCost } from './mana';
import { getCardDef, getCost } from './registry';
import { defOf, findPayment, getCard, hasFlashDef, isInstantDef, isLandDef, isReadyToTap } from './state';
import { targetsError } from './targets';
import type { CardId, GameState, PlayerId, Target } from './types';

export function hasPriority(s: GameState, player: PlayerId): boolean {
  return s.pending?.kind === 'priority' && s.pending.player === player;
}

export function isMainPhase(s: GameState): boolean {
  return s.step === 'main1' || s.step === 'main2';
}

export function canActAtSorcerySpeed(s: GameState, player: PlayerId): boolean {
  return hasPriority(s, player) && s.activePlayer === player && isMainPhase(s) && s.stack.length === 0;
}

export function landPlayError(s: GameState, player: PlayerId, cardId: CardId): string | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'hand' || card.owner !== player) return 'that card is not in your hand';
  if (!isLandDef(getCardDef(card.def))) return 'that card is not a land';
  if (!canActAtSorcerySpeed(s, player)) return 'lands can only be played during your main phase with an empty stack';
  if (s.players[player].landsPlayedThisTurn >= 1) return 'you already played a land this turn';
  return null;
}

export function castBlocker(s: GameState, player: PlayerId, cardId: CardId): string | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'hand' || card.owner !== player) return 'that card is not in your hand';
  const def = getCardDef(card.def);
  if (isLandDef(def)) return 'lands are played, not cast';
  if (!hasPriority(s, player)) return 'you do not have priority';
  if (!isInstantDef(def) && !hasFlashDef(def) && !canActAtSorcerySpeed(s, player)) {
    return 'this can only be cast during your main phase with an empty stack';
  }
  if (!findPayment(s, player, getCost(card.def), { excludeFromDemand: cardId })) return 'not enough mana';
  return null;
}

export function castError(s: GameState, player: PlayerId, cardId: CardId, targets: Target[]): string | null {
  const blocker = castBlocker(s, player, cardId);
  if (blocker) return blocker;
  return targetsError(s, player, defOf(s, cardId).spell?.targets ?? [], targets);
}

export function activationBlocker(s: GameState, player: PlayerId, cardId: CardId, abilityIndex: number): string | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'battlefield' || card.controller !== player) return 'you do not control that permanent';
  const ability = defOf(s, cardId).activated?.[abilityIndex];
  if (!ability) return 'that permanent has no such ability';
  if (!hasPriority(s, player)) return 'you do not have priority';
  if (ability.tap) {
    if (getCard(s, cardId).tapped) return 'that permanent is tapped';
    if (!isReadyToTap(s, cardId)) return 'that creature has summoning sickness';
  }
  const payment = findPayment(s, player, parseCost(ability.cost), {
    excludeSource: ability.tap ? cardId : undefined,
  });
  if (!payment) return 'not enough mana';
  return null;
}

export function activateError(
  s: GameState,
  player: PlayerId,
  cardId: CardId,
  abilityIndex: number,
  targets: Target[],
): string | null {
  const blocker = activationBlocker(s, player, cardId, abilityIndex);
  if (blocker) return blocker;
  const ability = defOf(s, cardId).activated?.[abilityIndex];
  return targetsError(s, player, ability?.targets ?? [], targets);
}
