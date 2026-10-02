import type { CardDef } from '../types';

export const readTheRoots: CardDef = {
  id: 'read_the_roots',
  name: 'Leer las raíces',
  types: ['sorcery'],
  cost: '{2}{G}',
  spell: {
    targets: [],
    effects: [{ kind: 'draw', amount: 2 }],
  },
  flavor: 'Cada árbol recuerda el bosque.',
};
