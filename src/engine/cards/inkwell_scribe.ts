import type { CardDef } from '../types';

export const inkwellScribe: CardDef = {
  id: 'inkwell_scribe',
  name: 'Escriba de tinta',
  types: ['creature'],
  subtypes: ['Hechicero', 'Humano'],
  cost: '{1}{U}',
  power: 1,
  toughness: 3,
  triggers: [
    {
      on: 'enters',
      targets: [],
      effects: [
        { kind: 'draw', amount: 1 },
        { kind: 'discard', amount: 1 },
      ],
    },
  ],
  flavor: 'Lo apunta todo y luego ahoga las páginas que no necesita.',
};
