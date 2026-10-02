import type { CardDef } from '../types';

export const soulSiphon: CardDef = {
  id: 'soul_siphon',
  name: 'Sifón de almas',
  types: ['sorcery'],
  cost: '{2}{B}',
  spell: {
    targets: [{ kind: 'any' }],
    effects: [
      { kind: 'damage', amount: 2, to: 0 },
      { kind: 'gainLife', amount: 2 },
    ],
  },
  flavor: 'Tu fuerza, mi fuerza. Ahora, mía.',
};
