import type { CardDef } from '../types';

export const musterSergeant: CardDef = {
  id: 'muster_sergeant',
  name: 'Muster Sergeant',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 1 }] }],
  flavor: 'One shout, and the line doubles.',
};
