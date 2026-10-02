import type { CardDef } from '../types';

export const shatteredIntent: CardDef = {
  id: 'shattered_intent',
  name: 'Intención rota',
  types: ['instant'],
  cost: '{1}{U}{R}',
  spell: {
    targets: [{ kind: 'spell' }],
    effects: [{ kind: 'counter', to: 0 }],
  },
  flavor: 'La magia es cristal. Golpéala en el momento justo.',
};
