import type { CardDef } from '../types';

export const riteOfLanterns: CardDef = {
  id: 'rite_of_lanterns',
  name: 'Rite of Lanterns',
  types: ['sorcery'],
  cost: '{2}{W}',
  spell: { targets: [], effects: [{ kind: 'createTokens', token: 'spirit_token', amount: 2 }] },
  flavor: 'Light a lantern for each soul, and each soul returns to keep watch.',
};
