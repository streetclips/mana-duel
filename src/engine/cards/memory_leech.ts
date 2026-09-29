import type { CardDef } from '../types';

export const memoryLeech: CardDef = {
  id: 'memory_leech',
  name: 'Memory Leech',
  types: ['creature'],
  subtypes: ['Leech'],
  cost: '{2}{B}',
  power: 2,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'discard', amount: 1, who: 'opponent' }] }],
  flavor: "It feeds on the plans you haven't made yet.",
};
