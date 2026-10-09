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

export function choosePayment(sources: ManaSource[], cost: ManaCost, wants: ManaCost[] = []): CardId[] | null {
  const total = manaValue(cost);
  if (total === 0) return [];
  if (sources.length < total) return null;

  const groups = groupSources(sources);
  let best: { used: ManaSource[]; rank: number[] } | null = null;
  for (const counts of allocations(
    groups.map((group) => group.length),
    total,
  )) {
    const used = groups.flatMap((group, i) => group.slice(0, counts[i]));
    if (!canPay(used, cost)) continue;
    const left = groups.flatMap((group, i) => group.slice(counts[i]));
    const rank = rankPayment(used, left, wants);
    if (!best || isBetterRank(rank, best.rank)) best = { used, rank };
  }
  if (!best) return null;
  return best.used.map((source) => source.id).sort(compareIds);
}

export function canPay(sources: ManaSource[], cost: ManaCost): boolean {
  if (sources.length < manaValue(cost)) return false;
  const needed = costColors(cost);
  for (let mask = 1; mask < 1 << needed.length; mask++) {
    const colors = needed.filter((_, i) => mask & (1 << i));
    const pips = colors.reduce((sum, color) => sum + cost[color], 0);
    const supply = sources.filter((source) => source.colors.some((color) => colors.includes(color))).length;
    if (pips > supply) return false;
  }
  return true;
}

function groupSources(sources: ManaSource[]): ManaSource[][] {
  const groups = new Map<string, ManaSource[]>();
  for (const source of [...sources].sort((a, b) => compareIds(a.id, b.id))) {
    const key = `${source.isCreature ? 'c' : 'l'}:${[...source.colors].sort().join('')}`;
    const group = groups.get(key);
    if (group) group.push(source);
    else groups.set(key, [source]);
  }
  return [...groups.values()];
}

function* allocations(sizes: number[], total: number, from = 0): Generator<number[]> {
  if (from === sizes.length) {
    if (total === 0) yield [];
    return;
  }
  const rest = sizes.slice(from + 1).reduce((sum, size) => sum + size, 0);
  for (let take = Math.min(sizes[from] ?? 0, total); take >= Math.max(0, total - rest); take--) {
    for (const tail of allocations(sizes, total - take, from + 1)) yield [take, ...tail];
  }
}

function rankPayment(used: ManaSource[], left: ManaSource[], wants: ManaCost[]): number[] {
  const affordable = wants.filter((want) => canPay(left, want));
  const together = emptyCost();
  let castable = 0;
  for (const want of [...affordable].sort((a, b) => manaValue(a) - manaValue(b))) {
    const next = addCosts(together, want);
    if (!canPay(left, next)) continue;
    Object.assign(together, next);
    castable++;
  }
  const colorsLeft = COLORS.filter((color) => left.some((source) => source.colors.includes(color))).length;
  return [
    castable,
    affordable.length,
    -used.filter((source) => source.isCreature).length,
    colorsLeft,
    -used.reduce((sum, source) => sum + source.colors.length, 0),
  ];
}

function isBetterRank(rank: number[], than: number[]): boolean {
  for (let i = 0; i < rank.length; i++) {
    const a = rank[i] ?? 0;
    const b = than[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

function addCosts(a: ManaCost, b: ManaCost): ManaCost {
  const sum = { ...a, generic: a.generic + b.generic };
  for (const color of COLORS) sum[color] = a[color] + b[color];
  return sum;
}

export function compareIds(a: string, b: string): number {
  const na = Number.parseInt(a.replace(/\D+/g, ''), 10);
  const nb = Number.parseInt(b.replace(/\D+/g, ''), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a < b ? -1 : a > b ? 1 : 0;
}
