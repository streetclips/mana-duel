import type { CardDef } from '../types';

export const duskmireShade: CardDef = {
  id: 'duskmire_shade',
  name: 'Sombra de cieno',
  types: ['creature'],
  subtypes: ['Sombra'],
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
  flavor: 'Cuanto más oscura es la noche, más crece.',
};
