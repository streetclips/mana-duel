import type { CardDef } from '../types';

export const undertow: CardDef = {
  id: 'undertow',
  name: 'Undertow',
  types: ['instant'],
  cost: '{1}{U}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'bounce', to: 0 }],
  },
  flavor: 'The sea gives back what it takes. Eventually.',
};
