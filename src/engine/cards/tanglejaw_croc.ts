import type { CardDef } from '../types';

export const tanglejawCroc: CardDef = {
  id: 'tanglejaw_croc',
  name: 'Cocodrilo de algas',
  types: ['creature'],
  subtypes: ['Cocodrilo'],
  cost: '{2}{G}{U}',
  power: 3,
  toughness: 3,
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'opponent' }],
      effects: [{ kind: 'bounce', to: 0 }],
    },
  ],
  flavor: 'El río devuelve lo que no quiere.',
};
