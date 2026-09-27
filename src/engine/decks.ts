import { getCardDef } from './cards';

export interface DeckEntry {
  card: string;
  count: number;
}

export interface DeckDef {
  id: string;
  name: string;
  description: string;
  colors: string;
  cards: DeckEntry[];
}

export const EMBERWILD: DeckDef = {
  id: 'emberwild',
  name: 'Emberwild',
  description: 'Red and green: fast attackers, burn, reach and big tramplers.',
  colors: 'RG',
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

export const DECKS: Record<string, DeckDef> = {
  [EMBERWILD.id]: EMBERWILD,
};

export const DEFAULT_DECK_ID = EMBERWILD.id;

export function getDeck(id: string): DeckDef {
  const deck = DECKS[id];
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
