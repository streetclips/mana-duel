import type { CardDef } from '../types';

export const stokeTheForge: CardDef = {
  id: 'stoke_the_forge',
  name: 'Stoke the Forge',
  types: ['sorcery'],
  cost: '{3}{R}',
  spell: {
    targets: [],
    effects: [{ kind: 'createTokens', token: 'elemental_token', amount: 2 }],
  },
  flavor: 'More coal. More sparks. More soldiers.',
};
