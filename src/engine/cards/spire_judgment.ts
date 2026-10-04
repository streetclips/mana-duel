import type { CardDef } from '../types';

export const spireJudgment: CardDef = {
  id: 'spire_judgment',
  name: 'Juicio de la aguja',
  types: ['instant'],
  cost: '{1}{W}{U}{B}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [
      { kind: 'destroy', to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'La aguja no juzga dos veces.',
};
