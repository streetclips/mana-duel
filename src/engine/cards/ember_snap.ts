import type { CardDef } from '../types';

export const emberSnap: CardDef = {
  id: 'ember_snap',
  name: 'Chasquido de brasas',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [{ kind: 'damage', amount: 2, to: 0 }],
  },
  flavor: 'Rápido como una chispa y el doble de grosero.',
};
