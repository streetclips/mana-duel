import type { CardDef } from '../types';

export const magmaLance: CardDef = {
  id: 'magma_lance',
  name: 'Lanza de magma',
  types: ['sorcery'],
  cost: '{2}{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'damage', amount: 4, to: 0 }],
  },
};
