import type { CardDef } from '../types';

export const sunmeadowHerald: CardDef = {
  id: 'sunmeadow_herald',
  name: 'Heraldo del prado',
  types: ['creature'],
  subtypes: ['Soldado', 'Humano'],
  cost: '{2}{W}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'attacks', targets: [], effects: [{ kind: 'pumpTeam', power: 1, toughness: 0 }] }],
  flavor: 'Una nota, y todo el prado carga.',
};
