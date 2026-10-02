import type { CardDef } from '../types';

export const verdantSurge: CardDef = {
  id: 'verdant_surge',
  name: 'Oleada verdeante',
  types: ['instant'],
  cost: '{G}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 3, toughness: 3, to: 0 }],
  },
  flavor: 'Crecer no es más que violencia con paciencia. Casi siempre.',
};
