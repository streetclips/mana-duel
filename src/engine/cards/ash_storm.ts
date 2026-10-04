import type { CardDef } from '../types';

export const ashStorm: CardDef = {
  id: 'ash_storm',
  name: 'Tormenta de ceniza',
  types: ['sorcery'],
  cost: '{U}{B}{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 2, to: 0 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Del puerto sube una nube que piensa, recuerda y arde.',
};
