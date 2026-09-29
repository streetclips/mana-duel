import type { CardDef } from '../types';

export const kindlingCaller: CardDef = {
  id: 'kindling_caller',
  name: 'Kindling Caller',
  types: ['creature'],
  subtypes: ['Human', 'Shaman'],
  cost: '{1}{R}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'elemental_token', amount: 1 }] }],
  flavor: 'She strikes the anvil once. Something strikes back.',
};
