import type { CardDef } from '../types';

export const forgewingGriffin: CardDef = {
  id: 'forgewing_griffin',
  name: 'Forgewing Griffin',
  types: ['creature'],
  subtypes: ['Griffin'],
  cost: '{3}{W}',
  power: 2,
  toughness: 2,
  keywords: ['flying'],
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 1 }] }],
  flavor: 'Its feathers are quenched steel; its riders, fresh recruits.',
};
