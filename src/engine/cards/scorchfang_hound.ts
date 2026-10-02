import type { CardDef } from '../types';

export const scorchfangHound: CardDef = {
  id: 'scorchfang_hound',
  name: 'Sabueso calcinador',
  types: ['creature'],
  subtypes: ['Sabueso'],
  cost: '{3}{R}',
  power: 3,
  toughness: 2,
  keywords: ['haste'],
  triggers: [
    {
      on: 'attacks',
      targets: [{ kind: 'player', controller: 'opponent' }],
      effects: [{ kind: 'damage', amount: 1, to: 0 }],
    },
  ],
  flavor: 'Deja un rastro de huellas ardientes hasta tu puerta.',
};
