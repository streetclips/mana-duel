import type { CardDef } from '../types';

export const siftTheDepths: CardDef = {
  id: 'sift_the_depths',
  name: 'Cribar el fondo',
  types: ['instant'],
  cost: '{1}{U}',
  spell: {
    targets: [],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'discard', amount: 1 },
    ],
  },
  flavor: 'Casi todo lo que guarda el río es barro. Casi todo.',
};
