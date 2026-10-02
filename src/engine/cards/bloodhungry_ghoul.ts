import type { CardDef } from '../types';

export const bloodhungryGhoul: CardDef = {
  id: 'bloodhungry_ghoul',
  name: 'Necrófago ávido',
  types: ['creature'],
  subtypes: ['Zombie'],
  cost: '{1}{B}',
  power: 2,
  toughness: 1,
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 1, to: 'self' }],
    },
  ],
  flavor: 'Huele una herida a tres valles de distancia.',
};
