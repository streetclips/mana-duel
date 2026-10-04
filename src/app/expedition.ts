import {
  COLORS,
  DECK_LIST,
  OPENING_HAND,
  STARTING_LIFE,
  getCardDef,
  hasCardDef,
  hasDeck,
  nextRandom,
  normalizeSeed,
  shuffleInPlace,
  type Color,
  type DeckDef,
  type DeckEntry,
  type PlayerId,
  type RngHolder,
} from '../engine';
import { MAX_COPIES, isLandCard, spellPool } from './cardPool';
import type { Matchup, Perks, Replay, SeatPerks } from './controller';
import type { DuelResult } from './duelTracker';

export type { DuelResult };

export const EXPEDITION_DECK_ID = 'expedition';
export const DUELS = 7;
export const RELIC_EVERY = 3;
export const OFFERS = 3;
export const RIVAL_LIFE: readonly number[] = [14, 16, 16, 18, 20, 22, 24];
export const RIVAL_HAND: readonly number[] = [6, 6, 7, 7, 7, 7, 8];

export type RelicId = 'vigor' | 'foresight' | 'banner' | 'cartographer' | 'hourglass';

export interface Relic {
  id: RelicId;
  name: string;
  text: string;
}

export const RELICS: readonly Relic[] = [
  { id: 'vigor', name: 'Amuleto de vigor', text: 'Empiezas cada duelo con 5 vidas más.' },
  { id: 'foresight', name: 'Ojo del augur', text: 'Tu mano inicial tiene una carta más.' },
  { id: 'banner', name: 'Estandarte del alba', text: 'Empiezas cada duelo con una ficha de criatura Soldado blanca 1/1.' },
  { id: 'cartographer', name: 'Mapa del cartógrafo', text: 'Empiezas cada duelo con una tierra más en el campo de batalla: la que más copias tiene tu mazo.' },
  { id: 'hourglass', name: 'Reloj de arena', text: 'Empiezas tú cada duelo.' },
];

const BASIC_OF: Record<Color, string> = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' };

export interface BaseDeck {
  id: string;
  name: string;
  colors: Color[];
  featured: string;
}

export interface Rival {
  deck: string;
  life: number;
  openingHand: number;
  boss: boolean;
}

export interface DuelRecord {
  rival: string;
  result: DuelResult;
  turns: number;
}

export type Stage =
  | { kind: 'duel' }
  | { kind: 'card'; offers: string[] }
  | { kind: 'swap'; card: string }
  | { kind: 'relic'; offers: RelicId[] }
  | { kind: 'won' }
  | { kind: 'lost' };

export interface ExpeditionRun {
  version: 1;
  seed: number;
  rng: number;
  base: BaseDeck;
  deck: DeckEntry[];
  relics: RelicId[];
  rivals: Rival[];
  wins: number;
  stage: Stage;
  history: DuelRecord[];
  added: string[];
  removed: string[];
  duel: Replay | null;
}

export interface DuelSetup {
  decks: Matchup;
  perks: SeatPerks;
}

export interface DuelStart {
  run: ExpeditionRun;
  seed: number;
  startingPlayer: PlayerId;
}

function copyRun(run: ExpeditionRun): ExpeditionRun {
  return structuredClone(run);
}

function fail(run: ExpeditionRun, wanted: Stage['kind']): never {
  throw new Error(`the expedition is at its ${run.stage.kind} stage, not ${wanted}`);
}

export function relicOf(id: RelicId): Relic {
  const relic = RELICS.find((candidate) => candidate.id === id);
  if (!relic) throw new Error(`Unknown relic "${id}"`);
  return relic;
}

export function createRun(base: DeckDef, seed: number): ExpeditionRun {
  const holder: RngHolder = { rng: normalizeSeed(seed) };
  const others = DECK_LIST.map((deck) => deck.id).filter((id) => id !== base.id);
  shuffleInPlace(holder, others);
  const rivals = others.slice(0, DUELS).map(
    (deck, index): Rival => ({
      deck,
      life: RIVAL_LIFE[index] ?? STARTING_LIFE,
      openingHand: RIVAL_HAND[index] ?? OPENING_HAND,
      boss: index === DUELS - 1,
    }),
  );
  return {
    version: 1,
    seed: normalizeSeed(seed),
    rng: holder.rng,
    base: { id: base.id, name: base.name, colors: [...base.colors], featured: base.featured },
    deck: base.cards.map((entry) => ({ ...entry })),
    relics: [],
    rivals,
    wins: 0,
    stage: { kind: 'duel' },
    history: [],
    added: [],
    removed: [],
    duel: null,
  };
}

export function currentRival(run: ExpeditionRun): Rival | null {
  return run.rivals[run.wins] ?? null;
}

export function deckSizeOf(run: ExpeditionRun): number {
  return run.deck.reduce((sum, entry) => sum + entry.count, 0);
}

export function copiesOf(run: ExpeditionRun, card: string): number {
  return run.deck.find((entry) => entry.card === card)?.count ?? 0;
}

export function changesLabel(run: ExpeditionRun): string {
  const changes = run.added.length;
  if (changes === 0) return 'sin cambios';
  return changes === 1 ? 'con 1 carta nueva' : `con ${changes} cartas nuevas`;
}

export function runDeck(run: ExpeditionRun): DeckDef {
  return {
    id: EXPEDITION_DECK_ID,
    name: run.base.name,
    description: `Tu mazo de la expedición: ${run.base.name} ${changesLabel(run)}.`,
    colors: [...run.base.colors],
    featured: run.base.featured,
    cards: run.deck.map((entry) => ({ ...entry })),
  };
}

export function mostCommonLand(run: ExpeditionRun): string | null {
  let best: DeckEntry | null = null;
  for (const entry of run.deck) {
    if (!isLandCard(entry.card)) continue;
    if (!best || entry.count > best.count) best = entry;
  }
  if (best) return best.card;
  const color = run.base.colors[0];
  return color ? BASIC_OF[color] : null;
}

export function playerPerks(run: ExpeditionRun): Perks {
  const perks: Perks = {};
  if (run.relics.includes('vigor')) perks.life = STARTING_LIFE + 5;
  if (run.relics.includes('foresight')) perks.openingHand = OPENING_HAND + 1;
  const battlefield: string[] = [];
  if (run.relics.includes('banner')) battlefield.push('soldier_token');
  const land = run.relics.includes('cartographer') ? mostCommonLand(run) : null;
  if (land) battlefield.push(land);
  if (battlefield.length > 0) perks.battlefield = battlefield;
  return perks;
}

export function rivalPerks(rival: Rival): Perks {
  const perks: Perks = {};
  if (rival.life !== STARTING_LIFE) perks.life = rival.life;
  if (rival.openingHand !== OPENING_HAND) perks.openingHand = rival.openingHand;
  return perks;
}

export function duelSetup(run: ExpeditionRun): DuelSetup {
  const rival = currentRival(run);
  if (!rival || run.stage.kind !== 'duel') fail(run, 'duel');
  return { decks: [runDeck(run), rival.deck], perks: [playerPerks(run), rivalPerks(rival)] };
}

export function startDuel(run: ExpeditionRun): DuelStart {
  if (run.stage.kind !== 'duel') fail(run, 'duel');
  const [value, afterSeed] = nextRandom(run.rng);
  const [flip, rng] = nextRandom(afterSeed);
  const next = copyRun(run);
  next.rng = rng;
  const startingPlayer: PlayerId = run.relics.includes('hourglass') || flip < 0.5 ? 0 : 1;
  return { run: next, seed: Math.floor(value * 2 ** 31), startingPlayer };
}

export function withDuel(run: ExpeditionRun, duel: Replay | null): ExpeditionRun {
  const next = copyRun(run);
  next.duel = duel ? structuredClone(duel) : null;
  return next;
}

function cardOffers(run: ExpeditionRun, holder: RngHolder): string[] {
  const pool = spellPool(run.base.colors).filter((card) => copiesOf(run, card) < MAX_COPIES);
  shuffleInPlace(holder, pool);
  return pool.slice(0, OFFERS);
}

function relicOffers(run: ExpeditionRun, holder: RngHolder): RelicId[] {
  const left = RELICS.map((relic) => relic.id).filter((id) => !run.relics.includes(id));
  shuffleInPlace(holder, left);
  return left.slice(0, OFFERS);
}

function afterReward(run: ExpeditionRun): ExpeditionRun {
  if (run.wins % RELIC_EVERY === 0) {
    const holder: RngHolder = { rng: run.rng };
    const offers = relicOffers(run, holder);
    run.rng = holder.rng;
    if (offers.length > 0) {
      run.stage = { kind: 'relic', offers };
      return run;
    }
  }
  run.stage = { kind: 'duel' };
  return run;
}

export function recordDuel(run: ExpeditionRun, result: DuelResult, turns: number): ExpeditionRun {
  const rival = currentRival(run);
  if (!rival || run.stage.kind !== 'duel') fail(run, 'duel');
  const next = copyRun(run);
  next.duel = null;
  next.history.push({ rival: rival.deck, result, turns });
  if (result === 'draw') return next;
  if (result === 'lost') {
    next.stage = { kind: 'lost' };
    return next;
  }
  next.wins += 1;
  if (next.wins >= next.rivals.length) {
    next.stage = { kind: 'won' };
    return next;
  }
  const holder: RngHolder = { rng: next.rng };
  const offers = cardOffers(next, holder);
  next.rng = holder.rng;
  if (offers.length === 0) return afterReward(next);
  next.stage = { kind: 'card', offers };
  return next;
}

export function chooseCard(run: ExpeditionRun, card: string | null): ExpeditionRun {
  if (run.stage.kind !== 'card') fail(run, 'card');
  if (card !== null && !run.stage.offers.includes(card)) throw new Error(`"${card}" is not one of the cards on offer`);
  const next = copyRun(run);
  if (card === null) return afterReward(next);
  next.stage = { kind: 'swap', card };
  return next;
}

export function swapCard(run: ExpeditionRun, out: string | null): ExpeditionRun {
  if (run.stage.kind !== 'swap') fail(run, 'swap');
  if (out !== null && copiesOf(run, out) === 0) throw new Error(`"${out}" is not in the expedition deck`);
  const card = run.stage.card;
  const next = copyRun(run);
  if (out !== null) {
    next.deck = next.deck
      .map((entry) => (entry.card === out ? { ...entry, count: entry.count - 1 } : entry))
      .filter((entry) => entry.count > 0);
    next.removed.push(out);
  }
  const existing = next.deck.find((entry) => entry.card === card);
  if (existing) existing.count += 1;
  else next.deck.push({ card, count: 1 });
  next.added.push(card);
  return afterReward(next);
}

export function chooseRelic(run: ExpeditionRun, relic: RelicId): ExpeditionRun {
  if (run.stage.kind !== 'relic') fail(run, 'relic');
  if (!run.stage.offers.includes(relic)) throw new Error(`"${relic}" is not one of the relics on offer`);
  const next = copyRun(run);
  next.relics.push(relic);
  next.stage = { kind: 'duel' };
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelicId(value: unknown): value is RelicId {
  return RELICS.some((relic) => relic.id === value);
}

function isCard(value: unknown): value is string {
  return typeof value === 'string' && hasCardDef(value) && !getCardDef(value).token;
}

function isCount(value: unknown, min = 0): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min;
}

function isBase(value: unknown): value is BaseDeck {
  if (!isRecord(value)) return false;
  const { id, name, colors, featured } = value;
  return (
    typeof id === 'string' &&
    typeof name === 'string' &&
    Array.isArray(colors) &&
    colors.every((color) => (COLORS as readonly unknown[]).includes(color)) &&
    isCard(featured)
  );
}

function isRival(value: unknown): value is Rival {
  if (!isRecord(value)) return false;
  const { deck, life, openingHand, boss } = value;
  return typeof deck === 'string' && hasDeck(deck) && isCount(life, 1) && isCount(openingHand, 1) && typeof boss === 'boolean';
}

function isStage(value: unknown): value is Stage {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'duel':
    case 'won':
    case 'lost':
      return true;
    case 'card':
      return Array.isArray(value.offers) && value.offers.every(isCard);
    case 'swap':
      return isCard(value.card);
    case 'relic':
      return Array.isArray(value.offers) && value.offers.every(isRelicId);
    default:
      return false;
  }
}

function isDuelRecord(value: unknown): value is DuelRecord {
  if (!isRecord(value)) return false;
  return typeof value.rival === 'string' && ['won', 'lost', 'draw'].includes(String(value.result)) && isCount(value.turns);
}

function isSavedDuel(value: unknown): value is Replay | null {
  if (value === null) return true;
  return isRecord(value) && typeof value.seed === 'number' && Array.isArray(value.decks) && Array.isArray(value.actions);
}

export function isExpeditionRun(value: unknown): value is ExpeditionRun {
  if (!isRecord(value) || value.version !== 1) return false;
  const { seed, rng, base, deck, relics, rivals, wins, stage, history, added, removed, duel } = value;
  return (
    isCount(seed) &&
    isCount(rng) &&
    isBase(base) &&
    Array.isArray(deck) &&
    deck.every((entry) => isRecord(entry) && isCard(entry.card) && isCount(entry.count, 1)) &&
    Array.isArray(relics) &&
    relics.every(isRelicId) &&
    Array.isArray(rivals) &&
    rivals.length > 0 &&
    rivals.every(isRival) &&
    isCount(wins) &&
    wins <= rivals.length &&
    isStage(stage) &&
    Array.isArray(history) &&
    history.every(isDuelRecord) &&
    Array.isArray(added) &&
    added.every(isCard) &&
    Array.isArray(removed) &&
    removed.every(isCard) &&
    isSavedDuel(duel)
  );
}
