import type { CardDef } from '../types';

export const brightforgeMarshal: CardDef = {
  id: 'brightforge_marshal',
  name: 'Mariscal de forja',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{2}{R}{W}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 2 }] }],
  flavor: 'Nunca marcha sola, y nunca con menos de tres.',
};
