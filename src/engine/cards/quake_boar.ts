import type { CardDef } from '../types';

export const quakeBoar: CardDef = {
  id: 'quake_boar',
  name: 'Jabalí sísmico',
  types: ['creature'],
  subtypes: ['Jabalí'],
  cost: '{1}{G}',
  power: 1,
  toughness: 2,
  triggers: [{ on: 'landfall', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Cada temblor le endurece un poco más los colmillos.',
};
