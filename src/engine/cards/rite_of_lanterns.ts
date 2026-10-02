import type { CardDef } from '../types';

export const riteOfLanterns: CardDef = {
  id: 'rite_of_lanterns',
  name: 'Rito de los faroles',
  types: ['sorcery'],
  cost: '{2}{W}',
  spell: { targets: [], effects: [{ kind: 'createTokens', token: 'spirit_token', amount: 2 }] },
  flavor: 'Enciende un farol por cada alma y cada alma volverá para velar.',
};
