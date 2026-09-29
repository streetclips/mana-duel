import type { CardDef } from '../types';

export const dragBelow: CardDef = {
  id: 'drag_below',
  name: 'Drag Below',
  types: ['instant'],
  cost: '{1}{U}{B}',
  spell: {
    targets: [{ kind: 'creature', controller: 'opponent' }],
    effects: [
      { kind: 'bounce', to: 0 },
      { kind: 'discard', amount: 1, who: 'opponent' },
    ],
  },
  flavor: 'The tide takes the body. The mist takes the memory.',
};
