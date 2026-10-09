import { parseCost } from './mana';
import { getCardDef, getCost } from './registry';
import { canAfford, defOf, getCard, hasFlashDef, isInstantDef, isLandDef, isReadyToTap } from './state';
import type { Refusal } from './refusals';
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

export function landPlayError(s: GameState, player: PlayerId, cardId: CardId): Refusal | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'hand' || card.owner !== player) return { code: 'notInHand' };
  if (!isLandDef(getCardDef(card.def))) return { code: 'notALand' };
  if (!canActAtSorcerySpeed(s, player)) return { code: 'landTiming' };
  const ps = s.players[player];
  if (ps.landsPlayedThisTurn >= 1 + ps.extraLandsThisTurn) {
    return { code: ps.extraLandsThisTurn > 0 ? 'allLandsPlayed' : 'landPlayed' };
  }
  return null;
}

export function castBlocker(s: GameState, player: PlayerId, cardId: CardId): Refusal | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'hand' || card.owner !== player) return { code: 'notInHand' };
  const def = getCardDef(card.def);
  if (isLandDef(def)) return { code: 'landsAreNotCast' };
  if (!hasPriority(s, player)) return { code: 'noPriority' };
  if (!isInstantDef(def) && !hasFlashDef(def) && !canActAtSorcerySpeed(s, player)) {
    return { code: 'sorceryTiming' };
  }
  if (!canAfford(s, player, getCost(card.def))) return { code: 'notEnoughMana' };
  return null;
}

export function castError(s: GameState, player: PlayerId, cardId: CardId, targets: Target[]): Refusal | null {
  const blocker = castBlocker(s, player, cardId);
  if (blocker) return blocker;
  return targetsError(s, player, defOf(s, cardId).spell?.targets ?? [], targets);
}

export function activationBlocker(
  s: GameState,
  player: PlayerId,
  cardId: CardId,
  abilityIndex: number,
): Refusal | null {
  const card = s.cards[cardId];
  if (!card || card.zone !== 'battlefield' || card.controller !== player) return { code: 'notYourPermanent' };
  const ability = defOf(s, cardId).activated?.[abilityIndex];
  if (!ability) return { code: 'noSuchAbility' };
  if (!hasPriority(s, player)) return { code: 'noPriority' };
  if (ability.tap) {
    if (getCard(s, cardId).tapped) return { code: 'tapped' };
    if (!isReadyToTap(s, cardId)) return { code: 'summoningSick' };
  }
  if (!canAfford(s, player, parseCost(ability.cost), ability.tap ? cardId : undefined)) {
    return { code: 'notEnoughMana' };
  }
  return null;
}

export function activateError(
  s: GameState,
  player: PlayerId,
  cardId: CardId,
  abilityIndex: number,
  targets: Target[],
): Refusal | null {
  const blocker = activationBlocker(s, player, cardId, abilityIndex);
  if (blocker) return blocker;
  const ability = defOf(s, cardId).activated?.[abilityIndex];
  return targetsError(s, player, ability?.targets ?? [], targets);
}
