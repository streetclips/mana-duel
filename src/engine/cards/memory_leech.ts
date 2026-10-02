import type { CardDef } from '../types';

export const memoryLeech: CardDef = {
  id: 'memory_leech',
  name: 'Sanguijuela mental',
  types: ['creature'],
  subtypes: ['Sanguijuela'],
  cost: '{2}{B}',
  power: 2,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'discard', amount: 1, who: 'opponent' }] }],
  flavor: 'Se alimenta de los planes que aún no has trazado.',
};
