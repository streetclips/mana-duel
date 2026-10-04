import type { CardDef } from '../types';

export const openPath: CardDef = {
  id: 'open_path',
  name: 'Senda abierta',
  types: ['sorcery'],
  cost: '{1}{G}',
  spell: {
    targets: [],
    effects: [
      { kind: 'extraLands', amount: 1 },
      { kind: 'draw', amount: 1 },
    ],
  },
  flavor: 'Los árboles se apartan para quien sabe adónde va.',
};
