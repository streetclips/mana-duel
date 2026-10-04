import type { CardDef } from '../types';

export const smokeWarlock: CardDef = {
  id: 'smoke_warlock',
  name: 'Brujo del humo',
  types: ['creature'],
  subtypes: ['Brujo', 'Humano'],
  cost: '{B}{R}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'enters', targets: [{ kind: 'any' }], effects: [{ kind: 'damage', amount: 1, to: 0 }] }],
  flavor: 'Habla en volutas, y cada palabra quema.',
};
