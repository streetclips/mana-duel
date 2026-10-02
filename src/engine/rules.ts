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
  if (!card || card.zone !== 'hand' || card.owner !== player) return 'esa carta no está en tu mano';
  if (!isLandDef(getCardDef(card.def))) return 'esa carta no es una tierra';
  if (!canActAtSorcerySpeed(s, player)) return 'las tierras solo se pueden jugar en tu fase principal con la pila vacía';
  if (s.players[player].landsPlayedThisTurn >= 1) return 'ya has jugado una tierra este turno';
  return null;
}

export function castBlocker(s: GameState, player: PlayerId, cardId: CardId): string | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'hand' || card.owner !== player) return 'esa carta no está en tu mano';
  const def = getCardDef(card.def);
  if (isLandDef(def)) return 'las tierras se juegan, no se lanzan';
  if (!hasPriority(s, player)) return 'no tienes la prioridad';
  if (!isInstantDef(def) && !hasFlashDef(def) && !canActAtSorcerySpeed(s, player)) {
    return 'esto solo se puede lanzar en tu fase principal con la pila vacía';
  }
  if (!findPayment(s, player, getCost(card.def), { excludeFromDemand: cardId })) return 'no hay suficiente maná';
  return null;
}

export function castError(s: GameState, player: PlayerId, cardId: CardId, targets: Target[]): string | null {
  const blocker = castBlocker(s, player, cardId);
  if (blocker) return blocker;
  return targetsError(s, player, defOf(s, cardId).spell?.targets ?? [], targets);
}

export function activationBlocker(s: GameState, player: PlayerId, cardId: CardId, abilityIndex: number): string | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'battlefield' || card.controller !== player) return 'no controlas ese permanente';
  const ability = defOf(s, cardId).activated?.[abilityIndex];
  if (!ability) return 'ese permanente no tiene esa habilidad';
  if (!hasPriority(s, player)) return 'no tienes la prioridad';
  if (ability.tap) {
    if (getCard(s, cardId).tapped) return 'ese permanente está girado';
    if (!isReadyToTap(s, cardId)) return 'esa criatura tiene mareo de invocación';
  }
  const payment = findPayment(s, player, parseCost(ability.cost), {
    excludeSource: ability.tap ? cardId : undefined,
  });
  if (!payment) return 'no hay suficiente maná';
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
