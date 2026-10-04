import type { CardDef } from '../types';

export const sparkVolley: CardDef = {
  id: 'spark_volley',
  name: 'Ráfaga de chispas',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 1, to: 0 },
      { kind: 'pumpTeam', power: 1, toughness: 0 },
    ],
  },
  flavor: 'La primera chispa apunta; las demás prenden a los monjes.',
};
