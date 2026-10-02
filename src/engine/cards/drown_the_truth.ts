import type { CardDef } from '../types';

export const drownTheTruth: CardDef = {
  id: 'drown_the_truth',
  name: 'Ahogar la verdad',
  types: ['instant'],
  cost: '{2}{U}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'destroy', to: 0 }],
  },
  flavor: 'Algunos secretos están más seguros en el fondo del lago.',
};
