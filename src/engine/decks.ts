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

export const STORMGLASS: DeckDef = {
  id: 'stormglass',
  name: 'Stormglass',
  description: 'Blue and red: flash, burn and card draw; every instant and sorcery powers up its creatures.',
  colors: ['U', 'R'],
  featured: 'stormglass_drake',
  cards: [
    { card: 'island', count: 8 },
    { card: 'mountain', count: 8 },
    { card: 'kiln_sprite', count: 2 },
    { card: 'squall_skimmer', count: 2 },
    { card: 'arc_initiate', count: 2 },
    { card: 'glassreef_sentinel', count: 2 },
    { card: 'galvanic_channeler', count: 2 },
    { card: 'wavecrest_mystic', count: 2 },
    { card: 'stormglass_drake', count: 2 },
    { card: 'thunderhead_djinn', count: 1 },
    { card: 'static_jolt', count: 2 },
    { card: 'stormflare', count: 2 },
    { card: 'brine_rebuke', count: 2 },
    { card: 'refracted_insight', count: 2 },
    { card: 'shattered_intent', count: 1 },
  ],
};

export const SUNMEADOW: DeckDef = {
  id: 'sunmeadow',
  name: 'Sunmeadow',
  description: 'Green and white: an army that grows with +1/+1 counters, team-wide pumps and life gain.',
  colors: ['G', 'W'],
  featured: 'sunantler_monarch',
  cards: [
    { card: 'forest', count: 8 },
    { card: 'plains', count: 8 },
    { card: 'hopeful_squire', count: 2 },
    { card: 'warren_hare', count: 2 },
    { card: 'bloomcaller_druid', count: 2 },
    { card: 'bristleback_boar', count: 2 },
    { card: 'sunmeadow_herald', count: 2 },
    { card: 'hearthfield_cleric', count: 1 },
    { card: 'thornglade_archer', count: 1 },
    { card: 'mossbark_bear', count: 2 },
    { card: 'skyguard_griffin', count: 1 },
    { card: 'sunantler_monarch', count: 1 },
    { card: 'rally_the_meadow', count: 2 },
    { card: 'wild_blossom', count: 2 },
    { card: 'pack_pounce', count: 2 },
    { card: 'harvest_hymn', count: 2 },
  ],
};

export const BRIGHTFORGE: DeckDef = {
  id: 'brightforge',
  name: 'Brightforge',
  description: 'Red and white: creature tokens, first strike and haste; the army grows with every soldier.',
  colors: ['R', 'W'],
  featured: 'brightforge_warlord',
  cards: [
    { card: 'mountain', count: 8 },
    { card: 'plains', count: 8 },
    { card: 'forge_cadet', count: 2 },
    { card: 'muster_sergeant', count: 2 },
    { card: 'sunsteel_lancer', count: 2 },
    { card: 'kindling_caller', count: 2 },
    { card: 'bannerguard_knight', count: 2 },
    { card: 'hammerfall_raider', count: 2 },
    { card: 'brightforge_marshal', count: 2 },
    { card: 'forgewing_griffin', count: 1 },
    { card: 'brightforge_warlord', count: 1 },
    { card: 'raise_the_banners', count: 2 },
    { card: 'molten_rebuke', count: 2 },
    { card: 'sunbrand', count: 1 },
    { card: 'charge_of_the_forge', count: 2 },
    { card: 'stoke_the_forge', count: 1 },
  ],
};

export const MISTGRAVE: DeckDef = {
  id: 'mistgrave',
  name: 'Mistgrave',
  description: "Blue and black: skulking creatures slip past bigger blockers and strip the opponent's hand.",
  colors: ['U', 'B'],
  featured: 'mistgrave_revenant',
  cards: [
    { card: 'island', count: 8 },
    { card: 'swamp', count: 8 },
    { card: 'gutterfang_rat', count: 2 },
    { card: 'fogslip_thief', count: 2 },
    { card: 'hushwing_bat', count: 2 },
    { card: 'inkwell_scribe', count: 2 },
    { card: 'memory_leech', count: 2 },
    { card: 'mistcloak_ambusher', count: 2 },
    { card: 'veilborn_specter', count: 2 },
    { card: 'mistgrave_revenant', count: 1 },
    { card: 'rob_the_mind', count: 2 },
    { card: 'drag_below', count: 2 },
    { card: 'choking_mist', count: 2 },
    { card: 'sift_the_depths', count: 2 },
    { card: 'drown_the_truth', count: 1 },
  ],
};

export const GLOAMWOOD: DeckDef = {
  id: 'gloamwood',
  name: 'Gloamwood',
  description: 'Black and green: undying, sacrifice and deathtouch; every death feeds the wood.',
  colors: ['B', 'G'],
  featured: 'gloamwood_elder',
  cards: [
    { card: 'forest', count: 8 },
    { card: 'swamp', count: 8 },
    { card: 'gravebloom_sprout', count: 2 },
    { card: 'rotwing_crow', count: 2 },
    { card: 'rootgnaw_boar', count: 2 },
    { card: 'bloodspore_thrall', count: 2 },
    { card: 'bonewood_stalker', count: 2 },
    { card: 'sporecap_shambler', count: 2 },
    { card: 'gloomsilk_spider', count: 2 },
    { card: 'rotbark_treefolk', count: 2 },
    { card: 'gloamwood_elder', count: 1 },
    { card: 'venom_duel', count: 2 },
    { card: 'rot_into_loam', count: 2 },
    { card: 'sporecall', count: 1 },
    { card: 'nightshade_tonic', count: 2 },
  ],
};

export const DECK_LIST: readonly DeckDef[] = [EMBERWILD, DAWNTIDE, DUSKMIRE, STORMGLASS, SUNMEADOW, BRIGHTFORGE, MISTGRAVE, GLOAMWOOD];

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
