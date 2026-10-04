import type { CardDef } from '../types';

export const twinStrike: CardDef = {
  id: 'twin_strike',
  name: 'Golpe doble',
  types: ['instant'],
  cost: '{1}{R}',
  spell: {
    targets: [{ kind: 'creature' }],
    effects: [{ kind: 'pump', power: 0, toughness: 0, to: 0, keywords: ['doubleStrike'] }],
  },
  flavor: 'El segundo golpe llega antes de que el primero duela.',
};
