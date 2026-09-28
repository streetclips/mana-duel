import type { CardDef } from '../types';

export const mossbarkBear: CardDef = {
  id: 'mossbark_bear',
  name: 'Mossbark Bear',
  types: ['creature'],
  subtypes: ['Bear'],
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
