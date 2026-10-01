import type { CardDef } from '../types';

export const vesperhallMatriarch: CardDef = {
  id: 'vesperhall_matriarch',
  name: 'Vesperhall Matriarch',
  types: ['creature'],
  subtypes: ['Vampire', 'Noble'],
  cost: '{3}{W}{B}',
  power: 3,
  toughness: 3,
  keywords: ['flying'],
  triggers: [{ on: 'lifeGain', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'She has led every vesper for three hundred years, and she has never once been thirsty.',
};
