import type { CardDef } from '../types';

export const stormflare: CardDef = {
  id: 'stormflare',
  name: 'Fulgor de tormenta',
  types: ['sorcery'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [{ kind: 'damage', amount: 3, to: 0 }],
  },
  flavor: 'La tormenta no apunta. Quien la invoca, sí.',
};
