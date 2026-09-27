import {
  COLORS,
  getCardDef,
  getCost,
  isLand,
  manaValue,
  type Action,
  type CardId,
  type Color,
  type GameState,
  type PlayerId,
} from '../engine';

function defId(s: GameState, id: CardId): string {
  return s.cards[id]?.def ?? '';
}

function isLandCard(s: GameState, id: CardId): boolean {
  return getCardDef(defId(s, id)).types.includes('land');
}

function spellCost(s: GameState, id: CardId): number {
  return manaValue(getCost(defId(s, id)));
}

function sourcesByColor(s: GameState, player: PlayerId): Record<Color, number> {
  const counts: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const id of s.players[player].battlefield) {
    for (const color of getCardDef(defId(s, id)).mana ?? []) counts[color] += 1;
  }
  return counts;
}

function pipsInHand(s: GameState, player: PlayerId): Record<Color, number> {
  const counts: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const id of s.players[player].hand) {
    if (isLandCard(s, id)) continue;
    const cost = getCost(defId(s, id));
    for (const color of COLORS) counts[color] += cost[color];
  }
  return counts;
}

export function chooseLand(s: GameState, player: PlayerId, landActions: Action[]): Action {
  const have = sourcesByColor(s, player);
  const need = pipsInHand(s, player);
  let best = landActions[0] as Action;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const action of landActions) {
    if (action.type !== 'playLand') continue;
    const colors = getCardDef(defId(s, action.card)).mana ?? [];
    const score = Math.max(-10, ...colors.map((color) => need[color] - have[color] * 1.5));
    if (score > bestScore) {
      best = action;
      bestScore = score;
    }
  }
  return best;
}

function colorCastableSpells(s: GameState, hand: CardId[]): number {
  const colors = new Set<Color>(hand.filter((id) => isLandCard(s, id)).flatMap((id) => getCardDef(defId(s, id)).mana ?? []));
  return hand.filter((id) => {
    if (isLandCard(s, id)) return false;
    const cost = getCost(defId(s, id));
    return COLORS.every((color) => cost[color] === 0 || colors.has(color));
  }).length;
}

export function shouldKeep(s: GameState, player: PlayerId): boolean {
  const ps = s.players[player];
  const lands = ps.hand.filter((id) => isLand(s, id)).length;
  const spells = ps.hand.length - lands;
  const castable = colorCastableSpells(s, ps.hand);
  if (ps.mulligans >= 2) return true;
  if (ps.mulligans === 1) return lands >= 1 && lands <= 5 && castable >= Math.min(1, spells);
  return lands >= 2 && lands <= 5 && castable >= Math.min(2, spells);
}

export function rankCardsToKeep(s: GameState, player: PlayerId, cards: CardId[], keepCount: number): CardId[] {
  const landsInPlay = s.players[player].battlefield.filter((id) => isLand(s, id)).length;
  const wantedLands = Math.max(0, Math.min(keepCount, Math.round(keepCount * 0.45) + (landsInPlay >= 5 ? -keepCount : 0)));
  const lands = cards.filter((id) => isLandCard(s, id));
  const spells = cards
    .filter((id) => !isLandCard(s, id))
    .sort((a, b) => spellCost(s, a) - spellCost(s, b));
  const kept: CardId[] = [];
  const remainingLands = [...lands];
  const remainingSpells = [...spells];
  while (kept.length < cards.length) {
    const landsKept = kept.filter((id) => isLandCard(s, id)).length;
    const takeLand = remainingLands.length > 0 && (landsKept < wantedLands || remainingSpells.length === 0);
    const next = takeLand ? remainingLands.shift() : remainingSpells.shift();
    if (next === undefined) break;
    kept.push(next);
  }
  return kept;
}

export function chooseCardsToBottom(s: GameState, player: PlayerId, count: number): CardId[] {
  const hand = s.players[player].hand;
  return rankCardsToKeep(s, player, hand, hand.length - count).slice(hand.length - count);
}

export function chooseCardsToDiscard(s: GameState, player: PlayerId, count: number): CardId[] {
  const hand = s.players[player].hand;
  const ranked = rankCardsToKeep(s, player, hand, hand.length - count);
  return ranked.slice(hand.length - count).sort((a, b) => spellCost(s, b) - spellCost(s, a)).slice(0, count);
}
