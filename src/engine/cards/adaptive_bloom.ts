import type { CardDef } from '../types';

export const adaptiveBloom: CardDef = {
  id: 'adaptive_bloom',
  name: 'Floración adaptativa',
  types: ['instant'],
  cost: '{G}{U}',
  spell: {
    targets: [{ kind: 'creature', controller: 'you' }],
    effects: [
      { kind: 'addCounters', amount: 1, to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Cada cambio es una lección, y cada lección, un cambio.',
};
