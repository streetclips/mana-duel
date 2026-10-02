import type { CardDef } from '../types';

export const kindlingCaller: CardDef = {
  id: 'kindling_caller',
  name: 'Invocadora de yesca',
  types: ['creature'],
  subtypes: ['Chamán', 'Humano'],
  cost: '{1}{R}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'elemental_token', amount: 1 }] }],
  flavor: 'Golpea el yunque una vez. Algo le devuelve el golpe.',
};
