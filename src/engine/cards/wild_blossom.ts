import type { CardDef } from '../types';

export const wildBlossom: CardDef = {
  id: 'wild_blossom',
  name: 'Wild Blossom',
  types: ['instant'],
  cost: '{1}{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'addCounters', amount: 2, to: 0 }],
  },
  flavor: 'Some flowers bloom in spring. Some bloom in battle.',
};
