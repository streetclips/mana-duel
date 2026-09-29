import type { CardDef } from '../types';

export const drownTheTruth: CardDef = {
  id: 'drown_the_truth',
  name: 'Drown the Truth',
  types: ['instant'],
  cost: '{2}{U}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'destroy', to: 0 }],
  },
  flavor: 'Some secrets are safest at the bottom of the lake.',
};
