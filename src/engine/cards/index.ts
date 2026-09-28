import type { CardDef } from '../types';
import { arcInitiate } from './arc_initiate';
import { ashenDuelist } from './ashen_duelist';
import { auroraSeraph } from './aurora_seraph';
import { beaconSquire } from './beacon_squire';
import { bloodReaver } from './blood_reaver';
import { bloomcallerDruid } from './bloomcaller_druid';
import { bogLurker } from './bog_lurker';
import { brambleWarden } from './bramble_warden';
import { brineRebuke } from './brine_rebuke';
import { bristlebackBoar } from './bristleback_boar';
import { canopySpider } from './canopy_spider';
import { cinderAdept } from './cinder_adept';
import { cinderwingDrake } from './cinderwing_drake';
import { cloudriderKnight } from './cloudrider_knight';
import { cragDragon } from './crag_dragon';
import { cryptGhoul } from './crypt_ghoul';
import { dawnAcolyte } from './dawn_acolyte';
import { dawnsVerdict } from './dawns_verdict';
import { dreadTyrant } from './dread_tyrant';
import { duskmireShade } from './duskmire_shade';
import { duskwingBat } from './duskwing_bat';
import { emberHound } from './ember_hound';
import { emberSnap } from './ember_snap';
import { feralClash } from './feral_clash';
import { forest } from './forest';
import { galewingFalcon } from './galewing_falcon';
import { galvanicChanneler } from './galvanic_channeler';
import { glassreefSentinel } from './glassreef_sentinel';
import { gloomWisp } from './gloom_wisp';
import { graveHexer } from './grave_hexer';
import { graveSentence } from './grave_sentence';
import { groveTender } from './grove_tender';
import { harvestHymn } from './harvest_hymn';
import { hearthfieldCleric } from './hearthfield_cleric';
import { hopefulSquire } from './hopeful_squire';
import { island } from './island';
import { kilnSprite } from './kiln_sprite';
import { magmaLance } from './magma_lance';
import { mireProwler } from './mire_prowler';
import { mistSprite } from './mist_sprite';
import { mossViper } from './moss_viper';
import { mossbarkBear } from './mossbark_bear';
import { mountain } from './mountain';
import { nightsBargain } from './nights_bargain';
import { nightveilWraith } from './nightveil_wraith';
import { packPounce } from './pack_pounce';
import { plains } from './plains';
import { radiantBlessing } from './radiant_blessing';
import { rallyTheMeadow } from './rally_the_meadow';
import { readTheRoots } from './read_the_roots';
import { reefScholar } from './reef_scholar';
import { reefshellCrab } from './reefshell_crab';
import { refractedInsight } from './refracted_insight';
import { ridgeMarauder } from './ridge_marauder';
import { shatteredIntent } from './shattered_intent';
import { skyguardGriffin } from './skyguard_griffin';
import { soulSiphon } from './soul_siphon';
import { squallSkimmer } from './squall_skimmer';
import { staticJolt } from './static_jolt';
import { stormflare } from './stormflare';
import { stormglassDrake } from './stormglass_drake';
import { sunantlerMonarch } from './sunantler_monarch';
import { sunbladePaladin } from './sunblade_paladin';
import { sunmeadowHerald } from './sunmeadow_herald';
import { swamp } from './swamp';
import { thorngladeArcher } from './thornglade_archer';
import { thunderheadDjinn } from './thunderhead_djinn';
import { tidalInsight } from './tidal_insight';
import { timberlandRhino } from './timberland_rhino';
import { turnTheTide } from './turn_the_tide';
import { undertow } from './undertow';
import { verdantSurge } from './verdant_surge';
import { warrenHare } from './warren_hare';
import { wavecrestMystic } from './wavecrest_mystic';
import { wildBlossom } from './wild_blossom';
import { witheringTouch } from './withering_touch';

export const CORE_CARDS: readonly CardDef[] = [
  forest,
  mountain,
  plains,
  island,
  swamp,
  groveTender,
  mossViper,
  emberHound,
  canopySpider,
  ashenDuelist,
  cinderAdept,
  ridgeMarauder,
  brambleWarden,
  timberlandRhino,
  cinderwingDrake,
  cragDragon,
  emberSnap,
  magmaLance,
  verdantSurge,
  feralClash,
  readTheRoots,
  mistSprite,
  dawnAcolyte,
  reefshellCrab,
  beaconSquire,
  reefScholar,
  galewingFalcon,
  sunbladePaladin,
  cloudriderKnight,
  auroraSeraph,
  radiantBlessing,
  undertow,
  turnTheTide,
  tidalInsight,
  dawnsVerdict,
  gloomWisp,
  duskwingBat,
  mireProwler,
  graveHexer,
  bogLurker,
  cryptGhoul,
  duskmireShade,
  bloodReaver,
  nightveilWraith,
  dreadTyrant,
  witheringTouch,
  nightsBargain,
  soulSiphon,
  graveSentence,
  kilnSprite,
  squallSkimmer,
  arcInitiate,
  glassreefSentinel,
  galvanicChanneler,
  wavecrestMystic,
  stormglassDrake,
  thunderheadDjinn,
  staticJolt,
  stormflare,
  brineRebuke,
  refractedInsight,
  shatteredIntent,
  hopefulSquire,
  warrenHare,
  bloomcallerDruid,
  bristlebackBoar,
  sunmeadowHerald,
  hearthfieldCleric,
  thorngladeArcher,
  mossbarkBear,
  skyguardGriffin,
  sunantlerMonarch,
  rallyTheMeadow,
  wildBlossom,
  packPounce,
  harvestHymn,
];
