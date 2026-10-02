import type { CardDef } from '../types';

export const fogslipThief: CardDef = {
  id: 'fogslip_thief',
  name: 'Ladrón de la niebla',
  types: ['creature'],
  subtypes: ['Bribón', 'Humano'],
  cost: '{1}{U}',
  power: 2,
  toughness: 2,
  keywords: ['skulk'],
  triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'Cuando echas de menos tu bolsa, la niebla ya se ha ido.',
};
