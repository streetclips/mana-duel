import type { CardDef } from '../types';
import { adaptiveBloom } from './adaptive_bloom';
import { arcInitiate } from './arc_initiate';
import { ashHarbor } from './ash_harbor';
import { ashStorm } from './ash_storm';
import { ashenDuelist } from './ashen_duelist';
import { ashveilExecutioner } from './ashveil_executioner';
import { ashwingKestrel } from './ashwing_kestrel';
import { auroraSeraph } from './aurora_seraph';
import { avalancheFury } from './avalanche_fury';
import { bannerguardKnight } from './bannerguard_knight';
import { beaconSquire } from './beacon_squire';
import { beastToken } from './beast_token';
import { blisteringHellion } from './blistering_hellion';
import { bloodFrenzy } from './blood_frenzy';
import { bloodReaver } from './blood_reaver';
import { bloodTithe } from './blood_tithe';
import { bloodfireBolt } from './bloodfire_bolt';
import { bloodhungryGhoul } from './bloodhungry_ghoul';
import { bloodsporeThrall } from './bloodspore_thrall';
import { bloomcallerDruid } from './bloomcaller_druid';
import { bogLurker } from './bog_lurker';
import { bonewoodStalker } from './bonewood_stalker';
import { boulderSpider } from './boulder_spider';
import { brambleWarden } from './bramble_warden';
import { brazierDisciple } from './brazier_disciple';
import { brightforgeMarshal } from './brightforge_marshal';
import { brightforgeWarlord } from './brightforge_warlord';
import { brimstoneSkirmisher } from './brimstone_skirmisher';
import { brineRebuke } from './brine_rebuke';
import { bristlebackBoar } from './bristleback_boar';
import { canopySpider } from './canopy_spider';
import { canyonTitan } from './canyon_titan';
import { censerBearer } from './censer_bearer';
import { chantryGuard } from './chantry_guard';
import { chargeOfTheForge } from './charge_of_the_forge';
import { chokingMist } from './choking_mist';
import { cinderAdept } from './cinder_adept';
import { cindermawDemon } from './cindermaw_demon';
import { cinderwingDrake } from './cinderwing_drake';
import { cliffLynx } from './cliff_lynx';
import { cloisterLancer } from './cloister_lancer';
import { cloudriderKnight } from './cloudrider_knight';
import { convergentVision } from './convergent_vision';
import { coralhideBehemoth } from './coralhide_behemoth';
import { councilVeto } from './council_veto';
import { cragDragon } from './crag_dragon';
import { craterElemental } from './crater_elemental';
import { cryptGhoul } from './crypt_ghoul';
import { dawnAcolyte } from './dawn_acolyte';
import { dawnsVerdict } from './dawns_verdict';
import { deepSowing } from './deep_sowing';
import { deepgroveLeviathan } from './deepgrove_leviathan';
import { dragBelow } from './drag_below';
import { dragonsBreath } from './dragons_breath';
import { dreadTyrant } from './dread_tyrant';
import { drownTheTruth } from './drown_the_truth';
import { duskmireShade } from './duskmire_shade';
import { duskwingBat } from './duskwing_bat';
import { elementalToken } from './elemental_token';
import { emberHound } from './ember_hound';
import { emberSnap } from './ember_snap';
import { feralClash } from './feral_clash';
import { fertileRift } from './fertile_rift';
import { flameCut } from './flame_cut';
import { flamecrestMentor } from './flamecrest_mentor';
import { fogslipThief } from './fogslip_thief';
import { forest } from './forest';
import { forgeCadet } from './forge_cadet';
import { forgewingGriffin } from './forgewing_griffin';
import { galewingFalcon } from './galewing_falcon';
import { galvanicChanneler } from './galvanic_channeler';
import { ghostlitPenitent } from './ghostlit_penitent';
import { gildedConfessor } from './gilded_confessor';
import { glassreefSentinel } from './glassreef_sentinel';
import { gloamwoodElder } from './gloamwood_elder';
import { gloomWisp } from './gloom_wisp';
import { gloomsilkSpider } from './gloomsilk_spider';
import { gorehornMinotaur } from './gorehorn_minotaur';
import { graveHexer } from './grave_hexer';
import { graveSentence } from './grave_sentence';
import { gravebloomSprout } from './gravebloom_sprout';
import { grimKindling } from './grim_kindling';
import { groveTender } from './grove_tender';
import { gutterfangRat } from './gutterfang_rat';
import { hammerfallRaider } from './hammerfall_raider';
import { harvestHymn } from './harvest_hymn';
import { hearthfieldCleric } from './hearthfield_cleric';
import { herdRoar } from './herd_roar';
import { hopefulSquire } from './hopeful_squire';
import { hushwingBat } from './hushwing_bat';
import { inkwellScribe } from './inkwell_scribe';
import { island } from './island';
import { kelpweaverDruid } from './kelpweaver_druid';
import { kilnSprite } from './kiln_sprite';
import { kindlingCaller } from './kindling_caller';
import { lanternwingAngel } from './lanternwing_angel';
import { lastRites } from './last_rites';
import { lavaFist } from './lava_fist';
import { magmaLance } from './magma_lance';
import { meadowGriffin } from './meadow_griffin';
import { memoryLeech } from './memory_leech';
import { mireProwler } from './mire_prowler';
import { mistSprite } from './mist_sprite';
import { mistcloakAmbusher } from './mistcloak_ambusher';
import { mistfinDrake } from './mistfin_drake';
import { mistgraveRevenant } from './mistgrave_revenant';
import { mistyMeadow } from './misty_meadow';
import { moltenRebuke } from './molten_rebuke';
import { monkToken } from './monk_token';
import { mossViper } from './moss_viper';
import { mossbarkBear } from './mossbark_bear';
import { mossfinLurker } from './mossfin_lurker';
import { mountain } from './mountain';
import { musterSergeant } from './muster_sergeant';
import { nightsBargain } from './nights_bargain';
import { nightshadeTonic } from './nightshade_tonic';
import { nightveilWraith } from './nightveil_wraith';
import { openPath } from './open_path';
import { packPounce } from './pack_pounce';
import { palmStrike } from './palm_strike';
import { peakGiant } from './peak_giant';
import { penance } from './penance';
import { pitfireRaider } from './pitfire_raider';
import { plains } from './plains';
import { prismaticDragon } from './prismatic_dragon';
import { prismaticFount } from './prismatic_fount';
import { purifyingFire } from './purifying_fire';
import { pyreGhast } from './pyre_ghast';
import { quakeBoar } from './quake_boar';
import { radiantBlessing } from './radiant_blessing';
import { raiseTheBanners } from './raise_the_banners';
import { rallyTheMeadow } from './rally_the_meadow';
import { readTheRoots } from './read_the_roots';
import { reefScholar } from './reef_scholar';
import { reefshellCrab } from './reefshell_crab';
import { reefwingFledgling } from './reefwing_fledgling';
import { refractedInsight } from './refracted_insight';
import { rendFlesh } from './rend_flesh';
import { ridgeMarauder } from './ridge_marauder';
import { riptideRecall } from './riptide_recall';
import { riteOfLanterns } from './rite_of_lanterns';
import { robTheMind } from './rob_the_mind';
import { rootWarden } from './root_warden';
import { rootgnawBoar } from './rootgnaw_boar';
import { rotIntoLoam } from './rot_into_loam';
import { rotbarkTreefolk } from './rotbark_treefolk';
import { rotwingCrow } from './rotwing_crow';
import { sanguineChorister } from './sanguine_chorister';
import { saprolingToken } from './saproling_token';
import { scorchfangHound } from './scorchfang_hound';
import { shatteredIntent } from './shattered_intent';
import { shellOfTheDeep } from './shell_of_the_deep';
import { shoalHatchling } from './shoal_hatchling';
import { siftTheDepths } from './sift_the_depths';
import { silverSpire } from './silver_spire';
import { skyMessenger } from './sky_messenger';
import { skyguardGriffin } from './skyguard_griffin';
import { smokeWarlock } from './smoke_warlock';
import { smolderingDevourer } from './smoldering_devourer';
import { smolderingJungle } from './smoldering_jungle';
import { snapjawStrike } from './snapjaw_strike';
import { soldierToken } from './soldier_token';
import { soulSiphon } from './soul_siphon';
import { sparkVolley } from './spark_volley';
import { spireJudgment } from './spire_judgment';
import { spiritToken } from './spirit_token';
import { spitfireImp } from './spitfire_imp';
import { splittingFlame } from './splitting_flame';
import { sporecall } from './sporecall';
import { sporecapShambler } from './sporecap_shambler';
import { springhornStag } from './springhorn_stag';
import { squallSkimmer } from './squall_skimmer';
import { staticJolt } from './static_jolt';
import { stokeTheForge } from './stoke_the_forge';
import { stormflare } from './stormflare';
import { stormglassDrake } from './stormglass_drake';
import { sunantlerMonarch } from './sunantler_monarch';
import { sunbladePaladin } from './sunblade_paladin';
import { sunbrand } from './sunbrand';
import { sunlitCanyon } from './sunlit_canyon';
import { sunmeadowHerald } from './sunmeadow_herald';
import { sunsteelLancer } from './sunsteel_lancer';
import { sureSwipe } from './sure_swipe';
import { swamp } from './swamp';
import { tanglejawCroc } from './tanglejaw_croc';
import { templeBlade } from './temple_blade';
import { templeDragon } from './temple_dragon';
import { territorialBeast } from './territorial_beast';
import { thorngladeArcher } from './thornglade_archer';
import { thousandBlowsMonk } from './thousand_blows_monk';
import { thunderheadDjinn } from './thunderhead_djinn';
import { tidalInsight } from './tidal_insight';
import { tidecrestMutant } from './tidecrest_mutant';
import { timberlandRhino } from './timberland_rhino';
import { titheCollector } from './tithe_collector';
import { trailScout } from './trail_scout';
import { tribeElder } from './tribe_elder';
import { turnTheTide } from './turn_the_tide';
import { twinStrike } from './twin_strike';
import { undertideLore } from './undertide_lore';
import { undertow } from './undertow';
import { veilbornSpecter } from './veilborn_specter';
import { venomDuel } from './venom_duel';
import { verdantSurge } from './verdant_surge';
import { vesperNovice } from './vesper_novice';
import { vesperVow } from './vesper_vow';
import { vesperhallMatriarch } from './vesperhall_matriarch';
import { warrenHare } from './warren_hare';
import { wavecrestMystic } from './wavecrest_mystic';
import { wayfarerDruid } from './wayfarer_druid';
import { wildBlossom } from './wild_blossom';
import { wildlandColossus } from './wildland_colossus';
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
  vesperNovice,
  titheCollector,
  chantryGuard,
  ghostlitPenitent,
  censerBearer,
  sanguineChorister,
  ashveilExecutioner,
  lanternwingAngel,
  gildedConfessor,
  vesperhallMatriarch,
  penance,
  vesperVow,
  riteOfLanterns,
  lastRites,
  bloodTithe,
  spitfireImp,
  bloodhungryGhoul,
  pitfireRaider,
  brimstoneSkirmisher,
  blisteringHellion,
  pyreGhast,
  gorehornMinotaur,
  scorchfangHound,
  cindermawDemon,
  splittingFlame,
  bloodfireBolt,
  rendFlesh,
  bloodFrenzy,
  grimKindling,
  shoalHatchling,
  reefwingFledgling,
  kelpweaverDruid,
  tidecrestMutant,
  mossfinLurker,
  tanglejawCroc,
  mistfinDrake,
  coralhideBehemoth,
  deepgroveLeviathan,
  snapjawStrike,
  shellOfTheDeep,
  adaptiveBloom,
  undertideLore,
  riptideRecall,
  cloisterLancer,
  templeBlade,
  brazierDisciple,
  ashwingKestrel,
  flamecrestMentor,
  thousandBlowsMonk,
  craterElemental,
  templeDragon,
  palmStrike,
  sparkVolley,
  lavaFist,
  twinStrike,
  dragonsBreath,
  flameCut,
  cliffLynx,
  trailScout,
  tribeElder,
  quakeBoar,
  springhornStag,
  boulderSpider,
  territorialBeast,
  peakGiant,
  wildlandColossus,
  openPath,
  deepSowing,
  fertileRift,
  avalancheFury,
  sureSwipe,
  herdRoar,
  silverSpire,
  ashHarbor,
  smolderingJungle,
  sunlitCanyon,
  mistyMeadow,
  prismaticFount,
  wayfarerDruid,
  skyMessenger,
  smokeWarlock,
  rootWarden,
  meadowGriffin,
  smolderingDevourer,
  canyonTitan,
  prismaticDragon,
  spireJudgment,
  ashStorm,
  councilVeto,
  convergentVision,
  purifyingFire,
  soldierToken,
  elementalToken,
  saprolingToken,
  spiritToken,
  monkToken,
  beastToken,
];
