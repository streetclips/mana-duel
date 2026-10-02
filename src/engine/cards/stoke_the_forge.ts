import type { CardDef } from '../types';

export const stokeTheForge: CardDef = {
  id: 'stoke_the_forge',
  name: 'Avivar la forja',
  types: ['sorcery'],
  cost: '{3}{R}',
  spell: {
    targets: [],
    effects: [{ kind: 'createTokens', token: 'elemental_token', amount: 2 }],
  },
  flavor: 'Más carbón. Más chispas. Más soldados.',
};
