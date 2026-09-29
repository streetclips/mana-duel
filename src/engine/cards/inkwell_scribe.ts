import type { CardDef } from '../types';

export const inkwellScribe: CardDef = {
  id: 'inkwell_scribe',
  name: 'Inkwell Scribe',
  types: ['creature'],
  subtypes: ['Human', 'Wizard'],
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
  flavor: "She writes down everything, then drowns the pages she doesn't need.",
};
