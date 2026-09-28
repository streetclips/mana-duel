import type { CardDef } from '../types';

export const sunmeadowHerald: CardDef = {
  id: 'sunmeadow_herald',
  name: 'Sunmeadow Herald',
  types: ['creature'],
  subtypes: ['Human', 'Soldier'],
  cost: '{2}{W}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'pumpTeam', power: 1, toughness: 0 }] }],
  flavor: 'One note, and the whole meadow charges.',
};
