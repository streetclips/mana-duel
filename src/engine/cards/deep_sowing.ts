import type { CardDef } from '../types';

export const deepSowing: CardDef = {
  id: 'deep_sowing',
  name: 'Siembra profunda',
  types: ['sorcery'],
  cost: '{2}{G}',
  spell: { targets: [], effects: [{ kind: 'searchLand', land: 'forest', battlefield: 1, hand: 1, tapped: true }] },
  flavor: 'Una semilla para hoy y otra para la cosecha de mañana.',
};
