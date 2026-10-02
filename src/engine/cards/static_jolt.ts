import type { CardDef } from '../types';

export const staticJolt: CardDef = {
  id: 'static_jolt',
  name: 'Descarga estática',
  types: ['instant'],
  cost: '{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 1, to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Una chispa pequeña y una idea brillante.',
};
