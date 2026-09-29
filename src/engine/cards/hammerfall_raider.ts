import type { CardDef } from '../types';

export const hammerfallRaider: CardDef = {
  id: 'hammerfall_raider',
  name: 'Hammerfall Raider',
  types: ['creature'],
  subtypes: ['Human', 'Warrior'],
  cost: '{2}{R}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'createTokens', token: 'elemental_token', amount: 1 }] }],
  flavor: 'Every blow he lands knocks another spark loose.',
};
