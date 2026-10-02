import type { CardDef } from '../types';

export const skyguardGriffin: CardDef = {
  id: 'skyguard_griffin',
  name: 'Grifo vigía',
  types: ['creature'],
  subtypes: ['Grifo'],
  cost: '{3}{W}',
  power: 2,
  toughness: 3,
  keywords: ['flying'],
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'you' }],
      effects: [{ kind: 'addCounters', amount: 1, to: 0 }],
    },
  ],
};
