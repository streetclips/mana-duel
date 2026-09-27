import type { CardDef } from '../types';
import { ashenDuelist } from './ashen_duelist';
import { auroraSeraph } from './aurora_seraph';
import { beaconSquire } from './beacon_squire';
import { bloodReaver } from './blood_reaver';
import { bogLurker } from './bog_lurker';
import { brambleWarden } from './bramble_warden';
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
import { gloomWisp } from './gloom_wisp';
import { graveHexer } from './grave_hexer';
import { graveSentence } from './grave_sentence';
import { groveTender } from './grove_tender';
import { island } from './island';
import { magmaLance } from './magma_lance';
import { mireProwler } from './mire_prowler';
import { mistSprite } from './mist_sprite';
import { mossViper } from './moss_viper';
import { mountain } from './mountain';
import { nightsBargain } from './nights_bargain';
import { nightveilWraith } from './nightveil_wraith';
import { plains } from './plains';
import { radiantBlessing } from './radiant_blessing';
import { readTheRoots } from './read_the_roots';
import { reefScholar } from './reef_scholar';
import { reefshellCrab } from './reefshell_crab';
import { ridgeMarauder } from './ridge_marauder';
import { soulSiphon } from './soul_siphon';
import { sunbladePaladin } from './sunblade_paladin';
import { swamp } from './swamp';
import { tidalInsight } from './tidal_insight';
import { timberlandRhino } from './timberland_rhino';
import { turnTheTide } from './turn_the_tide';
import { undertow } from './undertow';
import { verdantSurge } from './verdant_surge';
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
];
