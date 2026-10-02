import type { CardDef } from '../types';

export const mossbarkBear: CardDef = {
  id: 'mossbark_bear',
  name: 'Oso musgoso',
  types: ['creature'],
  subtypes: ['Oso'],
  cost: '{3}{G}',
  power: 3,
  toughness: 3,
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'you' }],
      effects: [{ kind: 'addCounters', amount: 1, to: 0 }],
    },
  ],
};
