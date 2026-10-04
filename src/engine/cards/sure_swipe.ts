import type { CardDef } from '../types';

export const sureSwipe: CardDef = {
  id: 'sure_swipe',
  name: 'Zarpazo certero',
  types: ['instant'],
  cost: '{2}{G}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [{ kind: 'bite', a: 0, b: 1 }],
  },
  flavor: 'Tres surcos en la corteza: la firma de la bestia.',
};
