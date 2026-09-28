import type { CardDef } from '../types';

export const shatteredIntent: CardDef = {
  id: 'shattered_intent',
  name: 'Shattered Intent',
  types: ['instant'],
  cost: '{1}{U}{R}',
  spell: {
    targets: [{ kind: 'spell' }],
    effects: [{ kind: 'counter', to: 0 }],
  },
  flavor: 'Magic is glass. Strike it at the right moment.',
};
