import type { CardDef } from '../types';

export const sunantlerMonarch: CardDef = {
  id: 'sunantler_monarch',
  name: 'Sunantler Monarch',
  types: ['creature'],
  subtypes: ['Elk'],
  cost: '{3}{G}{W}',
  power: 4,
  toughness: 4,
  keywords: ['vigilance'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'addCountersTeam', amount: 1 }] }],
  flavor: 'When it walks the meadow at dawn, every blade of grass stands taller.',
};
