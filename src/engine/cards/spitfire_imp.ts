import type { CardDef } from '../types';

export const spitfireImp: CardDef = {
  id: 'spitfire_imp',
  name: 'Spitfire Imp',
  types: ['creature'],
  subtypes: ['Imp'],
  cost: '{R}',
  power: 1,
  toughness: 1,
  keywords: ['haste'],
  triggers: [{ on: 'dies', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] }],
  flavor: 'It cackles all the way down, and then it explodes.',
};
