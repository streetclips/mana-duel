import type { CardDef } from '../types';
import { ashenDuelist } from './ashen_duelist';
import { brambleWarden } from './bramble_warden';
import { canopySpider } from './canopy_spider';
import { cinderAdept } from './cinder_adept';
import { cinderwingDrake } from './cinderwing_drake';
import { cragDragon } from './crag_dragon';
import { emberHound } from './ember_hound';
import { emberSnap } from './ember_snap';
import { feralClash } from './feral_clash';
import { forest } from './forest';
import { groveTender } from './grove_tender';
import { magmaLance } from './magma_lance';
import { mossViper } from './moss_viper';
import { mountain } from './mountain';
import { readTheRoots } from './read_the_roots';
import { ridgeMarauder } from './ridge_marauder';
import { timberlandRhino } from './timberland_rhino';
import { verdantSurge } from './verdant_surge';

export const CORE_CARDS: readonly CardDef[] = [
  forest,
  mountain,
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
];
