import type { CardDef } from '../types';

export const brineRebuke: CardDef = {
  id: 'brine_rebuke',
  name: 'Brine Rebuke',
  types: ['instant'],
  cost: '{2}{U}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'bounce', to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'The sea has opinions about trespassers.',
};
