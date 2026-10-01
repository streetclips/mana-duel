import type { CardDef } from '../types';

export const adaptiveBloom: CardDef = {
  id: 'adaptive_bloom',
  name: 'Adaptive Bloom',
  types: ['instant'],
  cost: '{G}{U}',
  spell: {
    targets: [{ kind: 'creature', controller: 'you' }],
    effects: [
      { kind: 'addCounters', amount: 1, to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Every change is a lesson, and every lesson a change.',
};
