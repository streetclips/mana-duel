import type { CardDef } from '../types';

export const snapjawStrike: CardDef = {
  id: 'snapjaw_strike',
  name: 'Dentellada',
  types: ['sorcery'],
  cost: '{1}{G}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [{ kind: 'bite', a: 0, b: 1 }],
  },
  flavor: 'Un mordisco. Es todo lo que el río necesita.',
};
