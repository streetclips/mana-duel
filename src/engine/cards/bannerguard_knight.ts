import type { CardDef } from '../types';

export const bannerguardKnight: CardDef = {
  id: 'bannerguard_knight',
  name: 'Bannerguard Knight',
  types: ['creature'],
  subtypes: ['Human', 'Knight'],
  cost: '{2}{W}',
  power: 2,
  toughness: 2,
  keywords: ['vigilance'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 1 }] }],
  flavor: 'Where her banner goes, a squire is never far behind.',
};
