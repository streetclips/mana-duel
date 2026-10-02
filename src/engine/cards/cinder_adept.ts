import type { CardDef } from '../types';

export const cinderAdept: CardDef = {
  id: 'cinder_adept',
  name: 'Adepto del ascua',
  types: ['creature'],
  subtypes: ['Chamán', 'Humano'],
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
