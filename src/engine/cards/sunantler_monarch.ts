import type { CardDef } from '../types';

export const sunantlerMonarch: CardDef = {
  id: 'sunantler_monarch',
  name: 'Monarca astasol',
  types: ['creature'],
  subtypes: ['Alce'],
  cost: '{3}{G}{W}',
  power: 4,
  toughness: 4,
  keywords: ['vigilance'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'addCountersTeam', amount: 1 }] }],
  flavor: 'Cuando recorre el prado al alba, cada brizna de hierba se yergue.',
};
