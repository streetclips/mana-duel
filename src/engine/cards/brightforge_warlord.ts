import type { CardDef } from '../types';

export const brightforgeWarlord: CardDef = {
  id: 'brightforge_warlord',
  name: 'Caudillo de forja',
  types: ['creature'],
  subtypes: ['Caballero', 'Humano'],
  cost: '{3}{R}{W}',
  power: 4,
  toughness: 4,
  triggers: [
    {
      on: 'enters',
      targets: [],
      effects: [{ kind: 'pumpTeam', power: 1, toughness: 0, keywords: ['haste'] }],
    },
  ],
  flavor: 'Cuando el Caudillo sale a cabalgar, toda la forja lo sigue, aún incandescente.',
};
