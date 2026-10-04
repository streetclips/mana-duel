import type { CardDef } from '../types';

export const prismaticFount: CardDef = {
  id: 'prismatic_fount',
  name: 'Fuente prismática',
  types: ['land'],
  entersTapped: true,
  mana: ['W', 'U', 'B', 'R', 'G'],
  flavor: 'Una sola agua, cinco colores.',
};
