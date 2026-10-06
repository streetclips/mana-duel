import type { CardDef } from '../types';

export const peakGiant: CardDef = {
  id: 'peak_giant',
  name: 'Gigante de la cumbre',
  types: ['creature'],
  subtypes: ['Gigante'],
  cost: '{3}{G}',
  power: 3,
  toughness: 3,
  triggers: [
    { on: 'enters', targets: [], effects: [{ kind: 'searchLand', land: 'forest', battlefield: 1, tapped: true }] },
  ],
  flavor: 'Carga la montaña a cuestas para plantarla donde le place.',
};
