import type { CardDef } from '../types';

export const brineRebuke: CardDef = {
  id: 'brine_rebuke',
  name: 'Reprimenda salobre',
  types: ['instant'],
  cost: '{2}{U}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'bounce', to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'El mar tiene su opinión sobre los intrusos.',
};
