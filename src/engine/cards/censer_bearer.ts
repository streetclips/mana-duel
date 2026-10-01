import type { CardDef } from '../types';

export const censerBearer: CardDef = {
  id: 'censer_bearer',
  name: 'Censer Bearer',
  types: ['creature'],
  subtypes: ['Human', 'Cleric'],
  cost: '{2}{W}',
  power: 1,
  toughness: 3,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'spirit_token', amount: 1 }] }],
  flavor: 'Where the smoke drifts, the departed follow.',
};
