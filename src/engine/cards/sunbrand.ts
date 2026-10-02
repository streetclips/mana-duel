import type { CardDef } from '../types';

export const sunbrand: CardDef = {
  id: 'sunbrand',
  name: 'Marca solar',
  types: ['instant'],
  cost: '{1}{R}{W}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 3, to: 0 },
      { kind: 'gainLife', amount: 3 },
    ],
  },
  flavor: 'Quema al enemigo y reconforta al amigo.',
};
