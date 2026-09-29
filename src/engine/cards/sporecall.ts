import type { CardDef } from '../types';

export const sporecall: CardDef = {
  id: 'sporecall',
  name: 'Sporecall',
  types: ['sorcery'],
  cost: '{2}{G}',
  spell: {
    targets: [],
    effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 2 }],
  },
  flavor: 'Where one thing rots, a hundred things sprout.',
};
