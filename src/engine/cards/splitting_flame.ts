import type { CardDef } from '../types';

export const splittingFlame: CardDef = {
  id: 'splitting_flame',
  name: 'Splitting Flame',
  types: ['sorcery'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'creature' }, { kind: 'player', controller: 'opponent' }],
    effects: [
      { kind: 'damage', amount: 2, to: 0 },
      { kind: 'damage', amount: 2, to: 1 },
    ],
  },
  flavor: 'One spark for the beast, one for its master.',
};
