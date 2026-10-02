import type { CardDef } from '../types';

export const gildedConfessor: CardDef = {
  id: 'gilded_confessor',
  name: 'Confesor dorado',
  types: ['creature'],
  subtypes: ['Clérigo', 'Humano'],
  cost: '{2}{W}{B}',
  power: 3,
  toughness: 3,
  triggers: [
    {
      on: 'enters',
      targets: [{ kind: 'creature', controller: 'opponent' }],
      effects: [
        { kind: 'pump', power: -1, toughness: -1, to: 0 },
        { kind: 'gainLife', amount: 2 },
      ],
    },
  ],
  flavor: 'Confiesa y quedarás más ligero. Niégate y quedarás más ligero todavía.',
};
