import type { CardDef } from '../types';

export const graveHexer: CardDef = {
  id: 'grave_hexer',
  name: 'Brujo de tumbas',
  types: ['creature'],
  subtypes: ['Brujo', 'Humano'],
  cost: '{2}{B}',
  power: 2,
  toughness: 2,
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'opponent' }],
      effects: [{ kind: 'pump', power: -1, toughness: -1, to: 0 }],
    },
  ],
};
