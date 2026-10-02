import type { CardDef } from '../types';

export const hammerfallRaider: CardDef = {
  id: 'hammerfall_raider',
  name: 'Asaltante martillador',
  types: ['creature'],
  subtypes: ['Guerrero', 'Humano'],
  cost: '{2}{R}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'createTokens', token: 'elemental_token', amount: 1 }] }],
  flavor: 'Cada golpe que asesta hace saltar otra chispa.',
};
