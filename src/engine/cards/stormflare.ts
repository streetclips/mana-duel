import type { CardDef } from '../types';

export const stormflare: CardDef = {
  id: 'stormflare',
  name: 'Stormflare',
  types: ['sorcery'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [{ kind: 'damage', amount: 3, to: 0 }],
  },
  flavor: 'The storm does not aim. The caller does.',
};
