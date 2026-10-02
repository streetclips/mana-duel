import type { CardDef } from '../types';

export const sporecall: CardDef = {
  id: 'sporecall',
  name: 'Llamada de esporas',
  types: ['sorcery'],
  cost: '{2}{G}',
  spell: {
    targets: [],
    effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 2 }],
  },
  flavor: 'Donde algo se pudre, brotan cien cosas.',
};
