import type { CardDef } from '../types';

export const undertideLore: CardDef = {
  id: 'undertide_lore',
  name: 'Saber bajo la marea',
  types: ['sorcery'],
  cost: '{2}{U}',
  spell: { targets: [], effects: [{ kind: 'draw', amount: 2 }] },
  flavor: 'El abismo guarda sus secretos en las raíces de la arboleda.',
};
