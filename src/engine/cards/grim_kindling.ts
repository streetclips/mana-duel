import type { CardDef } from '../types';

export const grimKindling: CardDef = {
  id: 'grim_kindling',
  name: 'Grim Kindling',
  types: ['sorcery'],
  cost: '{1}{B}{R}',
  spell: {
    targets: [{ kind: 'player', controller: 'opponent' }],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'damage', amount: 1, to: 0 },
    ],
  },
  flavor: 'Feed the fire your secrets and it whispers back.',
};
