import type { CardDef } from '../types';

export const pyreGhast: CardDef = {
  id: 'pyre_ghast',
  name: 'Espanto de la pira',
  types: ['creature'],
  subtypes: ['Espíritu', 'Zombie'],
  cost: '{2}{B}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'dies', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 2, to: 0 }] }],
  flavor: 'Ardió una vez y arderá para siempre.',
};
