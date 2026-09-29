import type { CardDef } from '../types';

export const siftTheDepths: CardDef = {
  id: 'sift_the_depths',
  name: 'Sift the Depths',
  types: ['instant'],
  cost: '{1}{U}',
  spell: {
    targets: [],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'discard', amount: 1 },
    ],
  },
  flavor: 'Most of what the river keeps is mud. Most.',
};
