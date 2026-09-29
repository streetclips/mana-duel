import type { CardDef } from '../types';

export const gloamwoodElder: CardDef = {
  id: 'gloamwood_elder',
  name: 'Gloamwood Elder',
  types: ['creature'],
  subtypes: ['Treefolk', 'Shaman'],
  cost: '{3}{B}{G}',
  power: 3,
  toughness: 4,
  keywords: ['reach'],
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 1 }] }],
  flavor: 'Every death in the wood is a seed it plants.',
};
