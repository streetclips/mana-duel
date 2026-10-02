import type { CardDef } from '../types';

export const beaconSquire: CardDef = {
  id: 'beacon_squire',
  name: 'Escudero del faro',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{1}{W}',
  power: 2,
  toughness: 2,
  keywords: ['vigilance'],
  flavor: 'Alguien tiene que estar despierto cuando llegue el alba.',
};
