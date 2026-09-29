import type { CardDef } from '../types';

export const hushwingBat: CardDef = {
  id: 'hushwing_bat',
  name: 'Hushwing Bat',
  types: ['creature'],
  subtypes: ['Bat'],
  cost: '{1}{B}',
  power: 1,
  toughness: 1,
  keywords: ['flying'],
  triggers: [{ on: 'damagesPlayer', targets: [], effects: [{ kind: 'discard', amount: 1, who: 'opponent' }] }],
  flavor: 'Its whisper steals the words right out of your head.',
};
