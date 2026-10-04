import type { CardDef } from '../types';

export const cliffLynx: CardDef = {
  id: 'cliff_lynx',
  name: 'Lince del risco',
  types: ['creature'],
  subtypes: ['Felino'],
  cost: '{G}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'landfall', targets: [], effects: [{ kind: 'pump', power: 2, toughness: 2, to: 'self' }] }],
  flavor: 'Salta de risco en risco antes de que la piedra se asiente.',
};
