import type { CardDef } from '../types';

export const censerBearer: CardDef = {
  id: 'censer_bearer',
  name: 'Portaincienso',
  types: ['creature'],
  subtypes: ['Clérigo', 'Humano'],
  cost: '{2}{W}',
  power: 1,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'spirit_token', amount: 1 }] }],
  flavor: 'Allá donde va el humo, lo siguen los difuntos.',
};
