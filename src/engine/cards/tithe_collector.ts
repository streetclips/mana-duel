import type { CardDef } from '../types';

export const titheCollector: CardDef = {
  id: 'tithe_collector',
  name: 'Tithe Collector',
  types: ['creature'],
  subtypes: ['Human', 'Rogue'],
  cost: '{1}{B}',
  power: 2,
  toughness: 1,
  triggers: [
    {
      on: 'enters',
      targets: [],
      effects: [
        { kind: 'loseLife', amount: 1, who: 'opponent' },
        { kind: 'gainLife', amount: 1 },
      ],
    },
  ],
  flavor: 'The hall takes its due in coin, in blood or in years.',
};
