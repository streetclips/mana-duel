import type { CardDef } from '../types';

export const trailScout: CardDef = {
  id: 'trail_scout',
  name: 'Guía del sendero',
  types: ['creature'],
  subtypes: ['Explorador', 'Elfo'],
  cost: '{1}{G}',
  power: 1,
  toughness: 1,
  triggers: [
    { on: 'enters', targets: [], effects: [{ kind: 'searchLand', land: 'forest', battlefield: 1, tapped: true }] },
  ],
  flavor: 'Donde ella pisa hoy, mañana habrá un bosque.',
};
