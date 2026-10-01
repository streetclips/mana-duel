import type { CardDef } from '../types';

export const blisteringHellion: CardDef = {
  id: 'blistering_hellion',
  name: 'Blistering Hellion',
  types: ['creature'],
  subtypes: ['Hellion'],
  cost: '{2}{R}',
  power: 3,
  toughness: 2,
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 2, to: 'self' }],
    },
  ],
  flavor: 'The smell of blood makes it burn hotter.',
};
