import type { CardDef } from '../types';

export const splittingFlame: CardDef = {
  id: 'splitting_flame',
  name: 'Llama bífida',
  types: ['sorcery'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'creature' }, { kind: 'player', controller: 'opponent' }],
    effects: [
      { kind: 'damage', amount: 2, to: 0 },
      { kind: 'damage', amount: 2, to: 1 },
    ],
  },
  flavor: 'Una chispa para la bestia y otra para su amo.',
};
