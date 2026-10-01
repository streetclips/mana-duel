import type { CardDef } from '../types';

export const undertideLore: CardDef = {
  id: 'undertide_lore',
  name: 'Undertide Lore',
  types: ['sorcery'],
  cost: '{2}{U}',
  spell: { targets: [], effects: [{ kind: 'draw', amount: 2 }] },
  flavor: 'The deep keeps its secrets in the roots of the grove.',
};
