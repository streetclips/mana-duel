import type { CardDef } from '../types';

export const raiseTheBanners: CardDef = {
  id: 'raise_the_banners',
  name: 'Raise the Banners',
  types: ['instant'],
  cost: '{1}{W}',
  spell: {
    targets: [],
    effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 2 }],
  },
  flavor: 'The forge bell rang once, and the square filled with shields.',
};
