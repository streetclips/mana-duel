import { COLORS, cardColors, getCardDef, getCost, hasCardDef, manaValue, type Color, type DeckDef, type DeckEntry } from '../engine';
import { MAX_COPIES, isBasicLand, isLandCard, poolCards } from './cardPool';

export const MIN_DECK = 40;
export const MAX_DECK = 60;
export const MAX_NAME = 22;
export const CUSTOM_PREFIX = 'mine-';

const BASIC_OF: Record<Color, string> = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' };
const COLOR_WORDS: Record<Color, string> = { W: 'blanco', U: 'azul', B: 'negro', R: 'rojo', G: 'verde' };
const COLOR_WORDS_PLURAL: Record<Color, string> = { W: 'blancas', U: 'azules', B: 'negras', R: 'rojas', G: 'verdes' };

export interface Allowance {
  card: string;
  max: number | null;
}

export interface DeckDraft {
  id: string | null;
  name: string;
  featured: string | null;
  cards: DeckEntry[];
}

export function collectionPool(): Allowance[] {
  return poolCards().map((card) => ({ card, max: isBasicLand(card) ? null : MAX_COPIES }));
}

export function countCards(cards: readonly DeckEntry[]): number {
  return cards.reduce((sum, entry) => sum + entry.count, 0);
}

export function copiesIn(cards: readonly DeckEntry[], card: string): number {
  return cards.find((entry) => entry.card === card)?.count ?? 0;
}

export function withCount(cards: readonly DeckEntry[], card: string, count: number): DeckEntry[] {
  const next = cards.map((entry) => (entry.card === card ? { ...entry, count } : { ...entry })).filter((entry) => entry.count > 0);
  if (count > 0 && !cards.some((entry) => entry.card === card)) next.push({ card, count });
  return next;
}

export function allowanceOf(pool: readonly Allowance[], card: string): Allowance | null {
  return pool.find((allowance) => allowance.card === card) ?? null;
}

export function canAdd(cards: readonly DeckEntry[], pool: readonly Allowance[], card: string): boolean {
  const allowance = allowanceOf(pool, card);
  if (!allowance) return false;
  return (allowance.max === null || copiesIn(cards, card) < allowance.max) && countCards(cards) < MAX_DECK;
}

export function deckColors(cards: readonly DeckEntry[]): Color[] {
  const spells = cards.filter((entry) => !isLandCard(entry.card));
  const sources = spells.length > 0 ? spells : cards;
  const colors = new Set(sources.flatMap((entry) => cardColors(getCardDef(entry.card))));
  return COLORS.filter((color) => colors.has(color));
}

export function suggestedFeatured(cards: readonly DeckEntry[]): string {
  let best: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const entry of cards) {
    if (isLandCard(entry.card)) continue;
    const def = getCardDef(entry.card);
    const score = manaValue(getCost(entry.card)) * 2 + (def.types.includes('creature') ? 1 : 0);
    if (score > bestScore) {
      best = entry.card;
      bestScore = score;
    }
  }
  return best ?? cards[0]?.card ?? BASIC_OF.G;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function kindCounts(cards: readonly DeckEntry[]): { creatures: number; spells: number; lands: number } {
  let creatures = 0;
  let spells = 0;
  let lands = 0;
  for (const entry of cards) {
    const def = getCardDef(entry.card);
    if (def.types.includes('land')) lands += entry.count;
    else if (def.types.includes('creature')) creatures += entry.count;
    else spells += entry.count;
  }
  return { creatures, spells, lands };
}

export function deckDescription(cards: readonly DeckEntry[]): string {
  const { creatures, spells, lands } = kindCounts(cards);
  return `Mazo propio: ${plural(creatures, 'criatura', 'criaturas')}, ${plural(spells, 'hechizo', 'hechizos')} y ${plural(lands, 'tierra', 'tierras')}.`;
}

export function draftProblems(draft: DeckDraft, pool: readonly Allowance[]): string[] {
  const problems: string[] = [];
  if (!draft.name.trim()) problems.push('Ponle un nombre al mazo.');
  const size = countCards(draft.cards);
  if (size < MIN_DECK) {
    const missing = MIN_DECK - size;
    problems.push(`${missing === 1 ? 'Falta 1 carta' : `Faltan ${missing} cartas`}: un mazo tiene al menos ${MIN_DECK}.`);
  }
  if (size > MAX_DECK) {
    const extra = size - MAX_DECK;
    problems.push(`${extra === 1 ? 'Sobra 1 carta' : `Sobran ${extra} cartas`}: un mazo tiene como mucho ${MAX_DECK}.`);
  }
  for (const entry of draft.cards) {
    const name = getCardDef(entry.card).name;
    const allowance = allowanceOf(pool, entry.card);
    if (!allowance) problems.push(`${name} no está entre las cartas que puedes usar.`);
    else if (allowance.max !== null && entry.count > allowance.max) {
      problems.push(`Llevas ${entry.count} copias de ${name}: puedes llevar ${allowance.max}.`);
    }
  }
  return problems;
}

export function draftNotes(draft: DeckDraft): string[] {
  const notes: string[] = [];
  const size = countCards(draft.cards);
  const { lands } = kindCounts(draft.cards);
  if (size >= MIN_DECK && (lands < 14 || lands > 20)) {
    notes.push(`Llevas ${plural(lands, 'tierra', 'tierras')} de ${size}: la mayoría de los mazos llevan entre 15 y 17.`);
  }
  const produced = new Set(draft.cards.flatMap((entry) => getCardDef(entry.card).mana ?? []));
  const unpaid = deckColors(draft.cards).filter((color) => !produced.has(color));
  for (const color of unpaid) notes.push(`Nada en el mazo da maná ${COLOR_WORDS[color]}: tus cartas ${COLOR_WORDS_PLURAL[color]} no podrán pagarse.`);
  return notes;
}


export function fillWithBasics(cards: readonly DeckEntry[], target = MIN_DECK): DeckEntry[] {
  const missing = target - countCards(cards);
  const pips: Record<Color, number> = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  for (const entry of cards) {
    if (isLandCard(entry.card)) continue;
    const cost = getCost(entry.card);
    for (const color of COLORS) pips[color] += cost[color] * entry.count;
  }
  const total = COLORS.reduce((sum, color) => sum + pips[color], 0);
  if (missing <= 0 || total === 0) return cards.map((entry) => ({ ...entry }));
  const shares = COLORS.map((color) => ({ color, exact: (pips[color] / total) * missing }));
  const counts = new Map(shares.map((share) => [share.color, Math.floor(share.exact)]));
  let left = missing - [...counts.values()].reduce((sum, count) => sum + count, 0);
  for (const share of [...shares].sort((a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)))) {
    if (left <= 0) break;
    if (share.exact === 0) continue;
    counts.set(share.color, (counts.get(share.color) ?? 0) + 1);
    left -= 1;
  }
  let next = cards.map((entry) => ({ ...entry }));
  for (const color of COLORS) {
    const count = counts.get(color) ?? 0;
    if (count > 0) next = withCount(next, BASIC_OF[color], copiesIn(next, BASIC_OF[color]) + count);
  }
  return next;
}

export function checkDraft(draft: DeckDraft): void {
  for (const entry of draft.cards) {
    if (!isPlayableCard(entry.card)) throw new Error(`"${entry.card}" is not a card a deck can hold`);
    if (!Number.isInteger(entry.count) || entry.count < 0) throw new Error(`Invalid count ${entry.count} for "${entry.card}"`);
  }
}

export function buildDeck(draft: DeckDraft, id: string): DeckDef {
  const cards = draft.cards.filter((entry) => entry.count > 0).map((entry) => ({ ...entry }));
  const featured = draft.featured && cards.some((entry) => entry.card === draft.featured) ? draft.featured : suggestedFeatured(cards);
  return {
    id,
    name: draft.name.trim().slice(0, MAX_NAME),
    description: deckDescription(cards),
    colors: deckColors(cards),
    featured,
    cards,
  };
}

export function draftOf(deck: DeckDef, copy = false): DeckDraft {
  return {
    id: copy ? null : deck.id,
    name: deck.name,
    featured: deck.featured,
    cards: deck.cards.map((entry) => ({ ...entry })),
  };
}

export function searchKey(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlayableCard(value: unknown): value is string {
  return typeof value === 'string' && hasCardDef(value) && !getCardDef(value).token;
}

export function isCustomDeck(value: unknown): value is DeckDef {
  if (!isRecord(value)) return false;
  const { id, name, description, colors, featured, cards } = value;
  return (
    typeof id === 'string' &&
    id.startsWith(CUSTOM_PREFIX) &&
    typeof name === 'string' &&
    name.trim().length > 0 &&
    typeof description === 'string' &&
    Array.isArray(colors) &&
    colors.every((color) => (COLORS as readonly unknown[]).includes(color)) &&
    isPlayableCard(featured) &&
    Array.isArray(cards) &&
    cards.every((entry) => isRecord(entry) && isPlayableCard(entry.card) && typeof entry.count === 'number' && Number.isInteger(entry.count) && entry.count > 0)
  );
}
