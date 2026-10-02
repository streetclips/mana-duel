import type { CardDef } from '../types';

export const musterSergeant: CardDef = {
  id: 'muster_sergeant',
  name: 'Sargento reclutador',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{1}{W}',
  power: 1,
  toughness: 1,
  triggers: [{ on: 'enters', targets: [], effects: [{ kind: 'createTokens', token: 'soldier_token', amount: 1 }] }],
  flavor: 'Un grito, y la fila se duplica.',
};
