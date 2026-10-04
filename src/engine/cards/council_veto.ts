import type { CardDef } from '../types';

export const councilVeto: CardDef = {
  id: 'council_veto',
  name: 'Veto del concilio',
  types: ['instant'],
  cost: '{1}{W}{U}',
  spell: {
    targets: [{ kind: 'spell' }],
    effects: [
      { kind: 'counter', to: 0 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Cinco voces, una sola respuesta: no.',
};
