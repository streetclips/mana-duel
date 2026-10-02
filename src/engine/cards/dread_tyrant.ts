import type { CardDef } from '../types';

export const dreadTyrant: CardDef = {
  id: 'dread_tyrant',
  name: 'Tirano del pavor',
  types: ['creature'],
  subtypes: ['Demonio'],
  cost: '{3}{B}{B}',
  power: 5,
  toughness: 4,
  keywords: ['flying'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'loseLife', amount: 2 }] }],
  flavor: 'Todo tirano exige tributo. Este se lo cobra por adelantado.',
};
