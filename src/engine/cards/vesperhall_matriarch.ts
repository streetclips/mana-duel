import type { CardDef } from '../types';

export const vesperhallMatriarch: CardDef = {
  id: 'vesperhall_matriarch',
  name: 'Matriarca vesperal',
  types: ['creature'],
  subtypes: ['Noble', 'Vampiro'],
  cost: '{3}{W}{B}',
  power: 3,
  toughness: 3,
  keywords: ['flying'],
  triggers: [{ on: 'lifeGain', targets: [], effects: [{ kind: 'addCounters', amount: 1, to: 'self' }] }],
  flavor: 'Ha presidido todas las vísperas durante trescientos años y nunca ha pasado sed.',
};
