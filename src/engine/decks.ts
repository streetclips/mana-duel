import { costColors } from './mana';
import { getCardDef, getCost } from './registry';
import { DECK_TEXTS, localizer } from './text/content';
import type { CardDef, Color } from './types';

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

export type DeckSpec = string | DeckDef;

export const EMBERWILD: DeckDef = {
  id: 'emberwild',
  name: 'Brasalvaje',
  description: 'Rojo y verde: atacantes rápidos, daño directo, alcance y grandes criaturas que arrollan.',
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
  name: 'Albamar',
  description: 'Blanco y azul: criaturas voladoras, vínculo vital y contrahechizos.',
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
  name: 'Fangoscuro',
  description: 'Negro: toque mortal, eliminación y drenaje de vidas; sus muertos devuelven el golpe.',
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
  name: 'Cristormenta',
  description:
    'Azul y rojo: destello, daño directo y robo de cartas; cada instantáneo y cada conjuro potencian a sus criaturas.',
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
  name: 'Pradosol',
  description:
    'Verde y blanco: un ejército que crece con contadores +1/+1, refuerzos para todas sus criaturas y ganancia de vidas.',
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
  name: 'Forjaluz',
  description: 'Rojo y blanco: fichas de criatura, dañar primero y prisa; el ejército crece con cada soldado.',
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
  name: 'Brumafosa',
  description:
    'Azul y negro: criaturas escurridizas que esquivan a bloqueadoras más grandes y vacían la mano del rival.',
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
  name: 'Selvumbra',
  description: 'Negro y verde: resiliencia, sacrificio y toque mortal; cada muerte alimenta la selva.',
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

export const VESPERHALL: DeckDef = {
  id: 'vesperhall',
  name: 'Vesperia',
  description:
    'Blanco y negro: vínculo vital y drenaje de vidas; cada vida que gana fortalece a sus fieles y desangra al rival.',
  colors: ['W', 'B'],
  featured: 'vesperhall_matriarch',
  cards: [
    { card: 'plains', count: 8 },
    { card: 'swamp', count: 8 },
    { card: 'vesper_novice', count: 2 },
    { card: 'tithe_collector', count: 2 },
    { card: 'chantry_guard', count: 2 },
    { card: 'ghostlit_penitent', count: 2 },
    { card: 'censer_bearer', count: 2 },
    { card: 'sanguine_chorister', count: 2 },
    { card: 'ashveil_executioner', count: 1 },
    { card: 'lanternwing_angel', count: 2 },
    { card: 'gilded_confessor', count: 1 },
    { card: 'vesperhall_matriarch', count: 1 },
    { card: 'penance', count: 2 },
    { card: 'vesper_vow', count: 2 },
    { card: 'rite_of_lanterns', count: 1 },
    { card: 'last_rites', count: 1 },
    { card: 'blood_tithe', count: 1 },
  ],
};

export const CINDERMAW: DeckDef = {
  id: 'cindermaw',
  name: 'Fauceniza',
  description:
    'Negro y rojo: prisa, amenaza y daño directo; en cuanto el rival sangra, sus criaturas sedientas de sangre llegan más grandes.',
  colors: ['B', 'R'],
  featured: 'cindermaw_demon',
  cards: [
    { card: 'swamp', count: 8 },
    { card: 'mountain', count: 8 },
    { card: 'spitfire_imp', count: 2 },
    { card: 'bloodhungry_ghoul', count: 2 },
    { card: 'pitfire_raider', count: 2 },
    { card: 'brimstone_skirmisher', count: 2 },
    { card: 'blistering_hellion', count: 2 },
    { card: 'pyre_ghast', count: 2 },
    { card: 'gorehorn_minotaur', count: 2 },
    { card: 'scorchfang_hound', count: 1 },
    { card: 'cindermaw_demon', count: 1 },
    { card: 'splitting_flame', count: 2 },
    { card: 'bloodfire_bolt', count: 2 },
    { card: 'rend_flesh', count: 1 },
    { card: 'blood_frenzy', count: 2 },
    { card: 'grim_kindling', count: 1 },
  ],
};

export const DEEPGROVE: DeckDef = {
  id: 'deepgrove',
  name: 'Sotohondo',
  description:
    'Verde y azul: criaturas que evolucionan con cada llegada más grande y gigantes con antimaleficio que ignoran los hechizos del rival.',
  colors: ['G', 'U'],
  featured: 'deepgrove_leviathan',
  cards: [
    { card: 'forest', count: 8 },
    { card: 'island', count: 8 },
    { card: 'shoal_hatchling', count: 2 },
    { card: 'reefwing_fledgling', count: 2 },
    { card: 'kelpweaver_druid', count: 2 },
    { card: 'tidecrest_mutant', count: 2 },
    { card: 'mossfin_lurker', count: 2 },
    { card: 'tanglejaw_croc', count: 2 },
    { card: 'mistfin_drake', count: 2 },
    { card: 'coralhide_behemoth', count: 1 },
    { card: 'deepgrove_leviathan', count: 1 },
    { card: 'snapjaw_strike', count: 2 },
    { card: 'shell_of_the_deep', count: 2 },
    { card: 'adaptive_bloom', count: 2 },
    { card: 'undertide_lore', count: 1 },
    { card: 'riptide_recall', count: 1 },
  ],
};

export const FLAMECREST: DeckDef = {
  id: 'flamecrest',
  name: 'Crestafuego',
  description:
    'Rojo: monjes con destreza que golpean primero y dos veces; cada instantáneo los enciende y el daño directo remata.',
  colors: ['R'],
  featured: 'flamecrest_mentor',
  cards: [
    { card: 'mountain', count: 16 },
    { card: 'cloister_lancer', count: 2 },
    { card: 'temple_blade', count: 2 },
    { card: 'brazier_disciple', count: 2 },
    { card: 'ashwing_kestrel', count: 2 },
    { card: 'flamecrest_mentor', count: 1 },
    { card: 'thousand_blows_monk', count: 1 },
    { card: 'crater_elemental', count: 2 },
    { card: 'temple_dragon', count: 1 },
    { card: 'palm_strike', count: 2 },
    { card: 'spark_volley', count: 2 },
    { card: 'lava_fist', count: 2 },
    { card: 'twin_strike', count: 1 },
    { card: 'dragons_breath', count: 2 },
    { card: 'flame_cut', count: 2 },
  ],
};

export const WILDLAND: DeckDef = {
  id: 'wildland',
  name: 'Tierrabrava',
  description:
    'Verde: cada tierra que entra despierta a sus bestias; busca bosques y juega tierras de más para crecer sin freno.',
  colors: ['G'],
  featured: 'wildland_colossus',
  cards: [
    { card: 'forest', count: 16 },
    { card: 'cliff_lynx', count: 2 },
    { card: 'trail_scout', count: 2 },
    { card: 'tribe_elder', count: 1 },
    { card: 'quake_boar', count: 2 },
    { card: 'springhorn_stag', count: 2 },
    { card: 'boulder_spider', count: 2 },
    { card: 'territorial_beast', count: 2 },
    { card: 'peak_giant', count: 1 },
    { card: 'wildland_colossus', count: 1 },
    { card: 'open_path', count: 2 },
    { card: 'deep_sowing', count: 2 },
    { card: 'fertile_rift', count: 1 },
    { card: 'avalanche_fury', count: 2 },
    { card: 'sure_swipe', count: 1 },
    { card: 'herd_roar', count: 1 },
  ],
};

export const CROSSROADS: DeckDef = {
  id: 'crossroads',
  name: 'Encrucijada',
  description:
    'Los cinco colores: tierras que dan maná de tres colores o de cualquiera, aunque entran giradas, y hechizos multicolores con lo mejor de cada color.',
  colors: ['W', 'U', 'B', 'R', 'G'],
  featured: 'prismatic_dragon',
  cards: [
    { card: 'plains', count: 1 },
    { card: 'island', count: 1 },
    { card: 'swamp', count: 1 },
    { card: 'mountain', count: 1 },
    { card: 'forest', count: 1 },
    { card: 'silver_spire', count: 2 },
    { card: 'ash_harbor', count: 2 },
    { card: 'smoldering_jungle', count: 2 },
    { card: 'sunlit_canyon', count: 2 },
    { card: 'misty_meadow', count: 2 },
    { card: 'prismatic_fount', count: 1 },
    { card: 'wayfarer_druid', count: 2 },
    { card: 'sky_messenger', count: 2 },
    { card: 'smoke_warlock', count: 2 },
    { card: 'root_warden', count: 2 },
    { card: 'meadow_griffin', count: 2 },
    { card: 'smoldering_devourer', count: 2 },
    { card: 'canyon_titan', count: 2 },
    { card: 'prismatic_dragon', count: 1 },
    { card: 'spire_judgment', count: 1 },
    { card: 'ash_storm', count: 2 },
    { card: 'council_veto', count: 2 },
    { card: 'convergent_vision', count: 2 },
    { card: 'purifying_fire', count: 2 },
  ],
};

export const DECK_LIST: readonly DeckDef[] = [
  EMBERWILD,
  DAWNTIDE,
  DUSKMIRE,
  STORMGLASS,
  SUNMEADOW,
  BRIGHTFORGE,
  MISTGRAVE,
  GLOAMWOOD,
  VESPERHALL,
  CINDERMAW,
  DEEPGROVE,
  FLAMECREST,
  WILDLAND,
  CROSSROADS,
];

export const DECKS: Record<string, DeckDef> = Object.fromEntries(DECK_LIST.map((deck) => [deck.id, deck]));

export const DEFAULT_DECK_ID = EMBERWILD.id;

export function hasDeck(id: string): boolean {
  return Object.hasOwn(DECKS, id);
}

const translations = localizer<DeckDef>(DECK_TEXTS);

export function localizeDeck(deck: DeckDef): DeckDef {
  return DECKS[deck.id] === deck ? translations.localize(deck) : deck;
}

export function getDeck(id: string): DeckDef {
  const deck = hasDeck(id) ? DECKS[id] : undefined;
  if (!deck) throw new Error(`Unknown deck "${id}"`);
  return localizeDeck(deck);
}

export function resolveDeck(spec: DeckSpec): DeckDef {
  return typeof spec === 'string' ? getDeck(spec) : localizeDeck(spec);
}

export function deckIdOf(spec: DeckSpec): string {
  return typeof spec === 'string' ? spec : spec.id;
}

export function cardColors(def: CardDef): Color[] {
  if (def.types.includes('land')) return def.mana ?? [];
  if (def.token) return def.colors ?? [];
  return costColors(getCost(def.id));
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
