import type { CardDef } from '../types';

export const packPounce: CardDef = {
  id: 'pack_pounce',
  name: 'Acometida en manada',
  types: ['sorcery'],
  cost: '{1}{G}',
  spell: {
    targets: [
      { kind: 'creature', controller: 'you' },
      { kind: 'creature', controller: 'opponent' },
    ],
    effects: [
      { kind: 'addCounters', amount: 1, to: 0 },
      { kind: 'fight', a: 0, b: 1 },
    ],
  },
};
