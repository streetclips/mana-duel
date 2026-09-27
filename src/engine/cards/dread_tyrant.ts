import type { CardDef } from '../types';

export const dreadTyrant: CardDef = {
  id: 'dread_tyrant',
  name: 'Dread Tyrant',
  types: ['creature'],
  subtypes: ['Demon'],
  cost: '{3}{B}{B}',
  power: 5,
  toughness: 4,
  keywords: ['flying'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'loseLife', amount: 2 }] }],
  flavor: 'Every tyrant demands tribute. This one takes it first.',
};
