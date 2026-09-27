import type { CardDef } from '../types';

export const nightveilWraith: CardDef = {
  id: 'nightveil_wraith',
  name: 'Nightveil Wraith',
  types: ['creature'],
  subtypes: ['Spirit'],
  cost: '{3}{B}',
  power: 3,
  toughness: 2,
  keywords: ['flying'],
  triggers: [
    {
      on: 'dies',
      targets: [{ kind: 'player', controller: 'opponent' }],
      effects: [{ kind: 'damage', amount: 2, to: 0 }],
    },
  ],
  flavor: 'When it fades, it takes something of yours with it.',
};
