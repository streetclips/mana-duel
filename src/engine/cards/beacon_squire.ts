import type { CardDef } from '../types';

export const beaconSquire: CardDef = {
  id: 'beacon_squire',
  name: 'Beacon Squire',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{1}{W}',
  power: 2,
  toughness: 2,
  keywords: ['vigilance'],
  flavor: 'Someone has to be awake when the dawn comes.',
};
