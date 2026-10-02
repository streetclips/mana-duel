import type { CardDef } from '../types';

export const wildBlossom: CardDef = {
  id: 'wild_blossom',
  name: 'Floración salvaje',
  types: ['instant'],
  cost: '{1}{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'addCounters', amount: 2, to: 0 }],
  },
  flavor: 'Algunas flores brotan en primavera. Otras, en la batalla.',
};
