import type { CardDef } from '../types';

export const vesperNovice: CardDef = {
  id: 'vesper_novice',
  name: 'Vesper Novice',
  types: ['creature'],
  subtypes: ['Human', 'Cleric'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'lifeGain', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Every answered prayer leaves her a little stronger.',
};
