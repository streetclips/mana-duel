import type { CardDef } from '../types';

export const lavaFist: CardDef = {
  id: 'lava_fist',
  name: 'Puño de lava',
  types: ['instant'],
  cost: '{1}{R}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [{ kind: 'bite', a: 0, b: 1 }],
  },
  flavor: 'Primero arde el puño; luego, todo lo que toca.',
};
