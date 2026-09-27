import type { CardDef } from '../types';

export const duskmireShade: CardDef = {
  id: 'duskmire_shade',
  name: 'Duskmire Shade',
  types: ['creature'],
  subtypes: ['Shade'],
  cost: '{2}{B}',
  power: 1,
  toughness: 1,
  activated: [
    {
      cost: '{B}',
      targets: [],
      effects: [{ kind: 'pump', power: 1, toughness: 1, to: 'self' }],
    },
  ],
  flavor: 'The darker the night, the larger it grows.',
};
