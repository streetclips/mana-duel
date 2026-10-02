import type { CardDef } from '../types';

export const cindermawDemon: CardDef = {
  id: 'cindermaw_demon',
  name: 'Demonio de ceniza',
  types: ['creature'],
  subtypes: ['Demonio'],
  cost: '{3}{B}{R}',
  power: 3,
  toughness: 3,
  keywords: ['flying'],
  triggers: [
    {
      on: 'enters',
      condition: 'opponentDamaged',
      targets: [],
      effects: [{ kind: 'addCounters', amount: 2, to: 'self' }],
    },
  ],
  flavor: 'Despierta hambriento, y despierta con el olor de la sangre.',
};
