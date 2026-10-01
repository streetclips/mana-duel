import type { CardDef } from '../types';

export const cindermawDemon: CardDef = {
  id: 'cindermaw_demon',
  name: 'Cindermaw Demon',
  types: ['creature'],
  subtypes: ['Demon'],
  cost: '{3}{B}{R}',
  power: 3,
  toughness: 3,
  keywords: ['flying'],
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 2, to: 'self' }],
    },
  ],
  flavor: 'It wakes hungry, and it wakes to the smell of blood.',
};
