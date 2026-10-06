import type { CardDef } from '../types';

export const tribeElder: CardDef = {
  id: 'tribe_elder',
  name: 'Anciano de la tribu',
  types: ['creature'],
  subtypes: ['Chamán', 'Elfo'],
  cost: '{1}{G}',
  power: 1,
  toughness: 1,
  activated: [
    {
      cost: '{0}',
      sacrifice: true,
      targets: [],
      effects: [{ kind: 'searchLand', land: 'forest', battlefield: 1, tapped: true }],
    },
  ],
  flavor: 'Cuando su cuerpo vuelve a la tierra, la tierra se lo agradece.',
};
