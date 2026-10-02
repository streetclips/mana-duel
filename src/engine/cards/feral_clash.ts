import type { CardDef } from '../types';

export const feralClash: CardDef = {
  id: 'feral_clash',
  name: 'Choque salvaje',
  types: ['sorcery'],
  cost: '{1}{G}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [{ kind: 'fight', a: 0, b: 1 }],
  },
};
