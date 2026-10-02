import type { CardDef } from '../types';

export const cryptGhoul: CardDef = {
  id: 'crypt_ghoul',
  name: 'Gul de la cripta',
  types: ['creature'],
  subtypes: ['Zombie'],
  cost: '{2}{B}',
  power: 3,
  toughness: 2,
  triggers: [
    {
      on: 'dies',
      targets: [{ kind: 'player', controller: 'opponent' }],
      effects: [{ kind: 'damage', amount: 1, to: 0 }],
    },
  ],
};
