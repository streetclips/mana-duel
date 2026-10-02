import type { CardDef } from '../types';

export const wavecrestMystic: CardDef = {
  id: 'wavecrest_mystic',
  name: 'Místico marino',
  types: ['creature'],
  subtypes: ['Hechicero', 'Tritón'],
  cost: '{3}{U}',
  power: 2,
  toughness: 3,
  keywords: ['flash'],
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'opponent' }],
      effects: [{ kind: 'bounce', to: 0 }],
    },
  ],
};
