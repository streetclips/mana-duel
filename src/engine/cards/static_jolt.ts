import type { CardDef } from '../types';

export const staticJolt: CardDef = {
  id: 'static_jolt',
  name: 'Static Jolt',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 1, to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'A small spark, and a bright idea.',
};
