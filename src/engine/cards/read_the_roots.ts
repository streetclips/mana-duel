import type { CardDef } from '../types';

export const readTheRoots: CardDef = {
  id: 'read_the_roots',
  name: 'Read the Roots',
  types: ['sorcery'],
  cost: '{2}{G}',
  spell: {
    targets: [],
    effects: [{ kind: 'draw', amount: 2 }],
  },
  flavor: 'Every tree remembers the forest.',
};
