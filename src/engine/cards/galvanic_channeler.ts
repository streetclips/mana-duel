import type { CardDef } from '../types';

export const galvanicChanneler: CardDef = {
  id: 'galvanic_channeler',
  name: 'Médium galvánico',
  types: ['creature'],
  subtypes: ['Chamán', 'Humano'],
  cost: '{2}{R}',
  power: 2,
  toughness: 2,
  triggers: [
    {
      on: 'spell',
      targets: [{ kind: 'player', controller: 'opponent' }],
      effects: [{ kind: 'damage', amount: 1, to: 0 }],
    },
  ],
};
