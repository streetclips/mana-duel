import type { CardDef } from '../types';

export const bloodhungryGhoul: CardDef = {
  id: 'bloodhungry_ghoul',
  name: 'Bloodhungry Ghoul',
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
  flavor: 'It can smell a wound from three valleys away.',
};
