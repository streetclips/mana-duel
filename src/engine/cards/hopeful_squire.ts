import type { CardDef } from '../types';

export const hopefulSquire: CardDef = {
  id: 'hopeful_squire',
  name: 'Hopeful Squire',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Every battle makes her a little more of a knight.',
};
