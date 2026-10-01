import type { CardDef } from '../types';

export const tanglejawCroc: CardDef = {
  id: 'tanglejaw_croc',
  name: 'Tanglejaw Croc',
  types: ['creature'],
  subtypes: ['Crocodile'],
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
  flavor: "The river gives back what it doesn't want.",
};
