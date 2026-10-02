import type { CardDef } from '../types';

export const sporecapShambler: CardDef = {
  id: 'sporecap_shambler',
  name: 'Seta errante',
  types: ['creature'],
  subtypes: ['Hongo'],
  cost: '{2}{G}',
  power: 2,
  toughness: 1,
  triggers: [{ on: 'dies', targets: [], effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 2 }] }],
  flavor: 'Mátala y tendrás que volver a matarla, cada vez más pequeña.',
};
