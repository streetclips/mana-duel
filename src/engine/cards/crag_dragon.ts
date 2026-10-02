import type { CardDef } from '../types';

export const cragDragon: CardDef = {
  id: 'crag_dragon',
  name: 'Dragón del risco',
  types: ['creature'],
  subtypes: ['Dragón'],
  cost: '{3}{R}{R}',
  power: 4,
  toughness: 4,
  keywords: ['flying'],
  activated: [
    {
      cost: '{R}',
      targets: [],
      effects: [{ kind: 'pump', power: 1, toughness: 0, to: 'self' }],
    },
  ],
};
