import type { CardDef } from '../types';

export const undertow: CardDef = {
  id: 'undertow',
  name: 'Contracorriente',
  types: ['instant'],
  cost: '{1}{U}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'bounce', to: 0 }],
  },
  flavor: 'El mar devuelve lo que se lleva. Tarde o temprano.',
};
