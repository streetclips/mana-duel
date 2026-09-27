import { COLORS, type CardId, type Color, type ManaCost } from './types';

export function emptyCost(): ManaCost {
  return { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0 };
}

export function isColor(symbol: string): symbol is Color {
  return (COLORS as readonly string[]).includes(symbol);
}

export function parseCost(text: string | undefined): ManaCost {
  const cost = emptyCost();
  if (!text) return cost;
  const compact = text.replace(/\s+/g, '');
  let consumed = '';
  for (const match of compact.matchAll(/\{([^}]+)\}/g)) {
    const symbol = match[1] ?? '';
    if (/^\d+$/.test(symbol)) cost.generic += Number.parseInt(symbol, 10);
    else if (isColor(symbol)) cost[symbol] += 1;
    else throw new Error(`Unknown mana symbol {${symbol}} in "${text}"`);
    consumed += match[0];
  }
  if (consumed !== compact) throw new Error(`Invalid mana cost "${text}"`);
  return cost;
}

export function costSymbols(cost: ManaCost): string[] {
  const symbols: string[] = [];
  if (cost.generic > 0) symbols.push(String(cost.generic));
  for (const color of COLORS) {
    for (let i = 0; i < cost[color]; i++) symbols.push(color);
  }
  return symbols;
}

export function formatCost(cost: ManaCost): string {
  const symbols = costSymbols(cost);
  return symbols.length === 0 ? '{0}' : symbols.map((s) => `{${s}}`).join('');
}

export function manaValue(cost: ManaCost): number {
  return COLORS.reduce((sum, color) => sum + cost[color], cost.generic);
}

export function costColors(cost: ManaCost): Color[] {
  return COLORS.filter((color) => cost[color] > 0);
}

export interface ManaSource {
  id: CardId;
  colors: Color[];
  isCreature: boolean;
}

export function choosePayment(
  sources: ManaSource[],
  cost: ManaCost,
  demand: Partial<Record<Color, number>> = {},
): CardId[] | null {
  const total = manaValue(cost);
  if (total === 0) return [];
  if (sources.length < total) return null;

  const score = (source: ManaSource): number =>
    (source.isCreature ? 1000 : 0) +
    source.colors.length * 100 +
    Math.max(0, ...source.colors.map((color) => demand[color] ?? 0));
  const ordered = [...sources].sort((a, b) => score(a) - score(b) || compareIds(a.id, b.id));

  const pips: Color[] = [];
  for (const color of COLORS) {
    for (let i = 0; i < cost[color]; i++) pips.push(color);
  }

  const used = new Set<CardId>();
  const assign = (index: number): boolean => {
    if (index === pips.length) return true;
    const pip = pips[index] as Color;
    for (const source of ordered) {
      if (used.has(source.id) || !source.colors.includes(pip)) continue;
      used.add(source.id);
      if (assign(index + 1)) return true;
      used.delete(source.id);
    }
    return false;
  };
  if (!assign(0)) return null;

  let generic = cost.generic;
  for (const source of ordered) {
    if (generic === 0) break;
    if (used.has(source.id)) continue;
    used.add(source.id);
    generic--;
  }
  if (generic > 0) return null;
  return ordered.filter((source) => used.has(source.id)).map((source) => source.id);
}

export function compareIds(a: string, b: string): number {
  const na = Number.parseInt(a.replace(/\D+/g, ''), 10);
  const nb = Number.parseInt(b.replace(/\D+/g, ''), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}
