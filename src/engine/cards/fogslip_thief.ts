import type { CardDef } from '../types';

export const fogslipThief: CardDef = {
  id: 'fogslip_thief',
  name: 'Fogslip Thief',
  types: ['creature'],
  subtypes: ['Human', 'Rogue'],
  cost: '{1}{U}',
  power: 2,
  toughness: 2,
  keywords: ['skulk'],
  triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'By the time you miss your purse, the fog has moved on.',
};
