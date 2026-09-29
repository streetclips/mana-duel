import type { CardDef } from '../types';
import { arcInitiate } from './arc_initiate';
import { ashenDuelist } from './ashen_duelist';
import { auroraSeraph } from './aurora_seraph';
import { bannerguardKnight } from './bannerguard_knight';
import { beaconSquire } from './beacon_squire';
import { bloodReaver } from './blood_reaver';
import { bloodsporeThrall } from './bloodspore_thrall';
import { bloomcallerDruid } from './bloomcaller_druid';
import { bogLurker } from './bog_lurker';
import { bonewoodStalker } from './bonewood_stalker';
import { brambleWarden } from './bramble_warden';
import { brightforgeMarshal } from './brightforge_marshal';
import { brightforgeWarlord } from './brightforge_warlord';
import { brineRebuke } from './brine_rebuke';
import { bristlebackBoar } from './bristleback_boar';
import { canopySpider } from './canopy_spider';
import { chargeOfTheForge } from './charge_of_the_forge';
import { chokingMist } from './choking_mist';
import { cinderAdept } from './cinder_adept';
import { cinderwingDrake } from './cinderwing_drake';
import { cloudriderKnight } from './cloudrider_knight';
import { cragDragon } from './crag_dragon';
import { cryptGhoul } from './crypt_ghoul';
import { dawnAcolyte } from './dawn_acolyte';
import { dawnsVerdict } from './dawns_verdict';
import { dragBelow } from './drag_below';
import { dreadTyrant } from './dread_tyrant';
import { drownTheTruth } from './drown_the_truth';
import { duskmireShade } from './duskmire_shade';
import { duskwingBat } from './duskwing_bat';
import { elementalToken } from './elemental_token';
import { emberHound } from './ember_hound';
import { emberSnap } from './ember_snap';
import { feralClash } from './feral_clash';
import { fogslipThief } from './fogslip_thief';
import { forest } from './forest';
import { forgeCadet } from './forge_cadet';
import { forgewingGriffin } from './forgewing_griffin';
import { galewingFalcon } from './galewing_falcon';
import { galvanicChanneler } from './galvanic_channeler';
import { glassreefSentinel } from './glassreef_sentinel';
import { gloamwoodElder } from './gloamwood_elder';
import { gloomWisp } from './gloom_wisp';
import { gloomsilkSpider } from './gloomsilk_spider';
import { graveHexer } from './grave_hexer';
import { graveSentence } from './grave_sentence';
import { gravebloomSprout } from './gravebloom_sprout';
import { groveTender } from './grove_tender';
import { gutterfangRat } from './gutterfang_rat';
import { hammerfallRaider } from './hammerfall_raider';
import { harvestHymn } from './harvest_hymn';
import { hearthfieldCleric } from './hearthfield_cleric';
import { hopefulSquire } from './hopeful_squire';
import { hushwingBat } from './hushwing_bat';
import { inkwellScribe } from './inkwell_scribe';
import { island } from './island';
import { kilnSprite } from './kiln_sprite';
import { kindlingCaller } from './kindling_caller';
import { magmaLance } from './magma_lance';
import { memoryLeech } from './memory_leech';
import { mireProwler } from './mire_prowler';
import { mistSprite } from './mist_sprite';
import { mistcloakAmbusher } from './mistcloak_ambusher';
import { mistgraveRevenant } from './mistgrave_revenant';
import { moltenRebuke } from './molten_rebuke';
import { mossViper } from './moss_viper';
import { mossbarkBear } from './mossbark_bear';
import { mountain } from './mountain';
import { musterSergeant } from './muster_sergeant';
import { nightsBargain } from './nights_bargain';
import { nightshadeTonic } from './nightshade_tonic';
import { nightveilWraith } from './nightveil_wraith';
import { packPounce } from './pack_pounce';
import { plains } from './plains';
import { radiantBlessing } from './radiant_blessing';
import { raiseTheBanners } from './raise_the_banners';
import { rallyTheMeadow } from './rally_the_meadow';
import { readTheRoots } from './read_the_roots';
import { reefScholar } from './reef_scholar';
import { reefshellCrab } from './reefshell_crab';
import { refractedInsight } from './refracted_insight';
import { ridgeMarauder } from './ridge_marauder';
import { robTheMind } from './rob_the_mind';
import { rootgnawBoar } from './rootgnaw_boar';
import { rotIntoLoam } from './rot_into_loam';
import { rotbarkTreefolk } from './rotbark_treefolk';
import { rotwingCrow } from './rotwing_crow';
import { saprolingToken } from './saproling_token';
import { shatteredIntent } from './shattered_intent';
import { siftTheDepths } from './sift_the_depths';
import { skyguardGriffin } from './skyguard_griffin';
import { soldierToken } from './soldier_token';
import { soulSiphon } from './soul_siphon';
import { sporecall } from './sporecall';
import { sporecapShambler } from './sporecap_shambler';
import { squallSkimmer } from './squall_skimmer';
import { staticJolt } from './static_jolt';
import { stokeTheForge } from './stoke_the_forge';
import { stormflare } from './stormflare';
import { stormglassDrake } from './stormglass_drake';
import { sunantlerMonarch } from './sunantler_monarch';
import { sunbladePaladin } from './sunblade_paladin';
import { sunbrand } from './sunbrand';
import { sunmeadowHerald } from './sunmeadow_herald';
import { sunsteelLancer } from './sunsteel_lancer';
import { swamp } from './swamp';
import { thorngladeArcher } from './thornglade_archer';
import { thunderheadDjinn } from './thunderhead_djinn';
import { tidalInsight } from './tidal_insight';
import { timberlandRhino } from './timberland_rhino';
import { turnTheTide } from './turn_the_tide';
import { undertow } from './undertow';
import { veilbornSpecter } from './veilborn_specter';
import { venomDuel } from './venom_duel';
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
  forgeCadet,
  musterSergeant,
  sunsteelLancer,
  kindlingCaller,
  bannerguardKnight,
  hammerfallRaider,
  brightforgeMarshal,
  forgewingGriffin,
  brightforgeWarlord,
  raiseTheBanners,
  moltenRebuke,
  sunbrand,
  chargeOfTheForge,
  stokeTheForge,
  gutterfangRat,
  fogslipThief,
  hushwingBat,
  inkwellScribe,
  memoryLeech,
  mistcloakAmbusher,
  veilbornSpecter,
  mistgraveRevenant,
  robTheMind,
  dragBelow,
  chokingMist,
  siftTheDepths,
  drownTheTruth,
  gravebloomSprout,
  rotwingCrow,
  rootgnawBoar,
  bloodsporeThrall,
  bonewoodStalker,
  sporecapShambler,
  gloomsilkSpider,
  rotbarkTreefolk,
  gloamwoodElder,
  venomDuel,
  rotIntoLoam,
  sporecall,
  nightshadeTonic,
  soldierToken,
  elementalToken,
  saprolingToken,
];
