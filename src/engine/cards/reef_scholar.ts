import type { CardDef } from '../types';

export const reefScholar: CardDef = {
  id: 'reef_scholar',
  name: 'Sabia del arrecife',
  types: ['creature'],
  subtypes: ['Hechicero', 'Tritón'],
  cost: '{2}{U}',
  power: 1,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'draw', amount: 1 }] }],
  flavor: 'El mar escribe sus secretos en corrientes. Ella los lee.',
};
