import type { CardDef } from '../types';

export const scorchfangHound: CardDef = {
  id: 'scorchfang_hound',
  name: 'Scorchfang Hound',
  types: ['creature'],
  subtypes: ['Hound'],
  cost: '{3}{R}',
  power: 3,
  toughness: 2,
  keywords: ['haste'],
  triggers: [
    {
      on: 'attacks',
      targets: [{ kind: 'player', controller: 'opponent' }],
      effects: [{ kind: 'damage', amount: 1, to: 0 }],
    },
  ],
  flavor: 'It leaves a trail of burning pawprints straight to your door.',
};
