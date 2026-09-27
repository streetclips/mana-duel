import type { CardDef } from '../types';

export const cinderAdept: CardDef = {
  id: 'cinder_adept',
  name: 'Cinder Adept',
  types: ['creature'],
  subtypes: ['Human', 'Shaman'],
  cost: '{2}{R}',
  power: 2,
  toughness: 2,
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'any' }],
      effects: [{ kind: 'damage', amount: 1, to: 0 }],
    },
  ],
};
