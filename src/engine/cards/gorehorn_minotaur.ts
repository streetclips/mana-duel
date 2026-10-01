import type { CardDef } from '../types';

export const gorehornMinotaur: CardDef = {
  id: 'gorehorn_minotaur',
  name: 'Gorehorn Minotaur',
  types: ['creature'],
  subtypes: ['Minotaur', 'Berserker'],
  cost: '{2}{B}{R}',
  power: 3,
  toughness: 3,
  keywords: ['menace'],
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 1, to: 'self' }],
    },
  ],
  flavor: 'It follows the screams to the fight.',
};
