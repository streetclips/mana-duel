import type { CardDef } from '../types';

export const gloomWisp: CardDef = {
  id: 'gloom_wisp',
  name: 'Gloom Wisp',
  types: ['creature'],
  subtypes: ['Spirit'],
  cost: '{B}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'dies', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'Snuff it out and its last flicker shows you a secret.',
};
