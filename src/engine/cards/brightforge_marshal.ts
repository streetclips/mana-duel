import type { CardDef } from '../types';

export const brightforgeMarshal: CardDef = {
  id: 'brightforge_marshal',
  name: 'Brightforge Marshal',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{2}{R}{W}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 2 }] }],
  flavor: 'She never marches alone, and never with fewer than three.',
};
