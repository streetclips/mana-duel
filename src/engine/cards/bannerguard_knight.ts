import type { CardDef } from '../types';

export const bannerguardKnight: CardDef = {
  id: 'bannerguard_knight',
  name: 'Abanderada',
  types: ['creature'],
  subtypes: ['Caballero', 'Humano'],
  cost: '{2}{W}',
  power: 2,
  toughness: 2,
  keywords: ['vigilance'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 1 }] }],
  flavor: 'Allá donde va su estandarte, siempre lo sigue de cerca un escudero.',
};
