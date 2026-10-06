import type { CardDef } from '../types';

export const brazierDisciple: CardDef = {
  id: 'brazier_disciple',
  name: 'Discípula del brasero',
  types: ['creature'],
  subtypes: ['Monje', 'Humano'],
  cost: '{1}{R}',
  power: 1,
  toughness: 2,
  keywords: ['prowess'],
  triggers: [
    {
      on: 'spell',
      targets: [],
      effects: [{ kind: 'pump', power: 0, toughness: 0, to: 'self', keywords: ['firstStrike'] }],
    },
  ],
  flavor: 'Aprendió a respirar al ritmo del fuego.',
};
