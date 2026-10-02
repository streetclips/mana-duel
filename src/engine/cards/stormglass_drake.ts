import type { CardDef } from '../types';

export const stormglassDrake: CardDef = {
  id: 'stormglass_drake',
  name: 'Draco de tormenta',
  types: ['creature'],
  subtypes: ['Draco'],
  cost: '{2}{U}{R}',
  power: 2,
  toughness: 3,
  keywords: ['flying'],
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Cada tormenta deja un poco más de relámpago dentro de su cristal.',
};
