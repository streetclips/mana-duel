import type { CardDef } from '../types';

export const forgewingGriffin: CardDef = {
  id: 'forgewing_griffin',
  name: 'Grifo alaforja',
  types: ['creature'],
  subtypes: ['Grifo'],
  cost: '{3}{W}',
  power: 2,
  toughness: 2,
  keywords: ['flying'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 1 }] }],
  flavor: 'Sus plumas son acero templado; sus jinetes, reclutas novatos.',
};
