import type { CardDef } from '../types';

export const sunbladePaladin: CardDef = {
  id: 'sunblade_paladin',
  name: 'Sunblade Paladin',
  types: ['creature'],
  subtypes: ['Human', 'Knight'],
  cost: '{1}{W}{W}',
  power: 2,
  toughness: 1,
  keywords: ['doubleStrike'],
  flavor: 'One blow for the wrong. One more for good measure.',
};
