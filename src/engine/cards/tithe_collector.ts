import type { CardDef } from '../types';

export const titheCollector: CardDef = {
  id: 'tithe_collector',
  name: 'Diezmero',
  types: ['creature'],
  subtypes: ['Bribón', 'Humano'],
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
  flavor: 'El templo cobra lo suyo en monedas, en sangre o en años.',
};
