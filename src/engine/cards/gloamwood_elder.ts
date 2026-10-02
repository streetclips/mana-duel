import type { CardDef } from '../types';

export const gloamwoodElder: CardDef = {
  id: 'gloamwood_elder',
  name: 'Anciano umbrío',
  types: ['creature'],
  subtypes: ['Chamán', 'Pueblo-arbóreo'],
  cost: '{3}{B}{G}',
  power: 3,
  toughness: 4,
  keywords: ['reach'],
  triggers: [{ on: 'allyDies', targets: [], effects: [{ kind: 'createTokens', token: 'saproling_token', amount: 1 }] }],
  flavor: 'Cada muerte en la selva es una semilla que planta.',
};
