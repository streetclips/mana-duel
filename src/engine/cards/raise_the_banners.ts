import type { CardDef } from '../types';

export const raiseTheBanners: CardDef = {
  id: 'raise_the_banners',
  name: 'Izar banderas',
  types: ['instant'],
  cost: '{1}{W}',
  spell: {
    targets: [],
    effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 2 }],
  },
  flavor: 'La campana de la forja sonó una vez y la plaza se llenó de escudos.',
};
