import type { CardDef } from '../types';

export const spitfireImp: CardDef = {
  id: 'spitfire_imp',
  name: 'Diablillo de fuego',
  types: ['creature'],
  subtypes: ['Diablillo'],
  cost: '{R}',
  power: 1,
  toughness: 1,
  keywords: ['haste'],
  triggers: [{ on: 'dies', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] }],
  flavor: 'Se ríe a carcajadas durante toda la caída y luego explota.',
};
