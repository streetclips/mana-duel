import type { CardDef } from '../types';

export const sunbrand: CardDef = {
  id: 'sunbrand',
  name: 'Sunbrand',
  types: ['instant'],
  cost: '{1}{R}{W}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 3, to: 0 },
      { kind: 'gainLife', amount: 3 },
    ],
  },
  flavor: 'It burns the foe and warms the friend.',
};
