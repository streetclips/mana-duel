import type { CardDef } from '../types';

export const purifyingFire: CardDef = {
  id: 'purifying_fire',
  name: 'Fuego purificador',
  types: ['instant'],
  cost: '{R}{W}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 2, to: 0 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Quema lo que sobra y calienta lo que queda.',
};
