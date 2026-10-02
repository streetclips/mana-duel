import type { CardDef } from '../types';

export const dragBelow: CardDef = {
  id: 'drag_below',
  name: 'Arrastrar al fondo',
  types: ['instant'],
  cost: '{1}{U}{B}',
  spell: {
    targets: [{ kind: 'creature', controller: 'opponent' }],
    effects: [
      { kind: 'bounce', to: 0 },
      { kind: 'discard', amount: 1, who: 'opponent' },
    ],
  },
  flavor: 'La marea se lleva el cuerpo. La niebla, el recuerdo.',
};
