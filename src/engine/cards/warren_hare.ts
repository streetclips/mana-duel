import type { CardDef } from '../types';

export const warrenHare: CardDef = {
  id: 'warren_hare',
  name: 'Warren Hare',
  types: ['creature'],
  subtypes: ['Rabbit'],
  cost: '{G}',
  power: 1,
  toughness: 1,
  triggers: [
    {
      on: 'dies',
      targets: [{ kind: 'creature', controller: 'you' }],
      effects: [{ kind: 'addCounters', amount: 1, to: 0 }],
    },
  ],
  flavor: 'When one falls, the whole warren grows bolder.',
};
