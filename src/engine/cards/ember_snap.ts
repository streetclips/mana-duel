import type { CardDef } from '../types';

export const emberSnap: CardDef = {
  id: 'ember_snap',
  name: 'Ember Snap',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [{ kind: 'damage', amount: 2, to: 0 }],
  },
  flavor: 'Quick as a spark, twice as rude.',
};
