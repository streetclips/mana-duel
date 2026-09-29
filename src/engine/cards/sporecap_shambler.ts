import type { CardDef } from '../types';

export const sporecapShambler: CardDef = {
  id: 'sporecap_shambler',
  name: 'Sporecap Shambler',
  types: ['creature'],
  subtypes: ['Fungus'],
  cost: '{2}{G}',
  power: 2,
  toughness: 1,
  triggers: [{ on: 'dies', targets: [], effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 2 }] }],
  flavor: "Kill it, and you'll have to kill it again, smaller each time.",
};
