import type { CardDef } from '../types';

export const herdRoar: CardDef = {
  id: 'herd_roar',
  name: 'Rugido de la manada',
  types: ['sorcery'],
  cost: '{3}{G}',
  spell: { targets: [], effects: [{ kind: 'pumpTeam', power: 2, toughness: 2, keywords: ['trample'] }] },
  flavor: 'Primero tiembla el suelo; después, el enemigo.',
};
