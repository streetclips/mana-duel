import { DECK_LIST, cardColors, getCardDef, type Color } from '../engine';

export function poolCards(): string[] {
  const ids = new Set<string>();
  for (const deck of DECK_LIST) for (const entry of deck.cards) ids.add(entry.card);
  return [...ids];
}

export function isBasicLand(id: string): boolean {
  return getCardDef(id).supertypes?.includes('Basic') ?? false;
}

export function isLandCard(id: string): boolean {
  return getCardDef(id).types.includes('land');
}

export function fitsColors(id: string, colors: readonly Color[]): boolean {
  return cardColors(getCardDef(id)).every((color) => colors.includes(color));
}

export function spellPool(colors: readonly Color[]): string[] {
  return poolCards().filter((id) => !isLandCard(id) && fitsColors(id, colors));
}
