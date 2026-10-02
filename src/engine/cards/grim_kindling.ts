import type { CardDef } from '../types';

export const grimKindling: CardDef = {
  id: 'grim_kindling',
  name: 'Yesca siniestra',
  types: ['sorcery'],
  cost: '{1}{B}{R}',
  spell: {
    targets: [{ kind: 'player', controller: 'opponent' }],
    effects: [
      { kind: 'draw', amount: 2 },
      { kind: 'damage', amount: 1, to: 0 },
    ],
  },
  flavor: 'Dale al fuego tus secretos y te responderá en susurros.',
};
