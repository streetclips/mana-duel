import type { CardDef } from '../types';

export const kilnSprite: CardDef = {
  id: 'kiln_sprite',
  name: 'Kiln Sprite',
  types: ['creature'],
  subtypes: ['Elemental'],
  cost: '{R}',
  power: 1,
  toughness: 1,
  keywords: ['haste'],
  triggers: [{ on: 'spell', targets: [], effects: [{ kind: 'pump', power: 1, toughness: 1, to: 'self' }] }],
  flavor: "Born in the glassblower's fire, it never learned to sit still.",
};
