import type { CardDef } from '../types';

export const pyreGhast: CardDef = {
  id: 'pyre_ghast',
  name: 'Pyre Ghast',
  types: ['creature'],
  subtypes: ['Zombie', 'Spirit'],
  cost: '{2}{B}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'dies', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 2, to: 0 }] }],
  flavor: 'Burned once, it burns forever.',
};
