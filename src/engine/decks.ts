import { getCardDef } from './registry';
import type { Color } from './types';

export interface DeckEntry {
  card: string;
  count: number;
}

export interface DeckDef {
  id: string;
  name: string;
  description: string;
  colors: Color[];
  featured: string;
  cards: DeckEntry[];
}

export const EMBERWILD: DeckDef = {
  id: 'emberwild',
  name: 'Emberwild',
  description: 'Red and green: fast attackers, burn, reach and big tramplers.',
  colors: ['R', 'G'],
  featured: 'crag_dragon',
  cards: [
    { card: 'forest', count: 8 },
    { card: 'mountain', count: 8 },
    { card: 'grove_tender', count: 2 },
    { card: 'moss_viper', count: 2 },
    { card: 'ember_hound', count: 2 },
    { card: 'canopy_spider', count: 2 },
    { card: 'ashen_duelist', count: 1 },
    { card: 'cinder_adept', count: 2 },
    { card: 'ridge_marauder', count: 1 },
    { card: 'bramble_warden', count: 1 },
    { card: 'timberland_rhino', count: 2 },
    { card: 'cinderwing_drake', count: 1 },
    { card: 'crag_dragon', count: 1 },
    { card: 'ember_snap', count: 2 },
    { card: 'magma_lance', count: 1 },
    { card: 'verdant_surge', count: 2 },
    { card: 'feral_clash', count: 1 },
    { card: 'read_the_roots', count: 1 },
  ],
};

export const DAWNTIDE: DeckDef = {
  id: 'dawntide',
  name: 'Dawntide',
  description: 'White and blue: flyers, lifelink and counterspells.',
  colors: ['W', 'U'],
  featured: 'aurora_seraph',
  cards: [
    { card: 'plains', count: 8 },
    { card: 'island', count: 8 },
    { card: 'mist_sprite', count: 2 },
    { card: 'dawn_acolyte', count: 2 },
    { card: 'reefshell_crab', count: 1 },
    { card: 'beacon_squire', count: 2 },
    { card: 'reef_scholar', count: 2 },
    { card: 'galewing_falcon', count: 2 },
    { card: 'sunblade_paladin', count: 1 },
    { card: 'cloudrider_knight', count: 2 },
    { card: 'aurora_seraph', count: 2 },
    { card: 'radiant_blessing', count: 2 },
    { card: 'undertow', count: 2 },
    { card: 'turn_the_tide', count: 2 },
    { card: 'tidal_insight', count: 1 },
    { card: 'dawns_verdict', count: 1 },
  ],
};

export const DUSKMIRE: DeckDef = {
  id: 'duskmire',
  name: 'Duskmire',
  description: 'Black: deathtouch, removal and life drain; its dead bite back.',
  colors: ['B'],
  featured: 'dread_tyrant',
  cards: [
    { card: 'swamp', count: 16 },
    { card: 'gloom_wisp', count: 3 },
    { card: 'duskwing_bat', count: 2 },
    { card: 'mire_prowler', count: 3 },
    { card: 'grave_hexer', count: 2 },
    { card: 'bog_lurker', count: 2 },
    { card: 'crypt_ghoul', count: 2 },
    { card: 'duskmire_shade', count: 1 },
    { card: 'blood_reaver', count: 2 },
    { card: 'nightveil_wraith', count: 2 },
    { card: 'dread_tyrant', count: 1 },
    { card: 'withering_touch', count: 1 },
    { card: 'nights_bargain', count: 1 },
    { card: 'soul_siphon', count: 1 },
    { card: 'grave_sentence', count: 1 },
  ],
};

export const DECK_LIST: readonly DeckDef[] = [EMBERWILD, DAWNTIDE, DUSKMIRE];

export const DECKS: Record<string, DeckDef> = Object.fromEntries(DECK_LIST.map((deck) => [deck.id, deck]));

export const DEFAULT_DECK_ID = EMBERWILD.id;

export function hasDeck(id: string): boolean {
  return Object.hasOwn(DECKS, id);
}

export function getDeck(id: string): DeckDef {
  const deck = hasDeck(id) ? DECKS[id] : undefined;
  if (!deck) throw new Error(`Unknown deck "${id}"`);
  return deck;
}

export function expandDeck(deck: DeckDef): string[] {
  const cards: string[] = [];
  for (const entry of deck.cards) {
    getCardDef(entry.card);
    for (let i = 0; i < entry.count; i++) cards.push(entry.card);
  }
  return cards;
}

export function deckSize(deck: DeckDef): number {
  return deck.cards.reduce((sum, entry) => sum + entry.count, 0);
}
