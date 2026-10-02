import type { CardDef } from '../types';

export const sanguineChorister: CardDef = {
  id: 'sanguine_chorister',
  name: 'Corista sanguínea',
  types: ['creature'],
  subtypes: ['Clérigo', 'Vampiro'],
  cost: '{1}{W}{B}',
  power: 2,
  toughness: 2,
  triggers: [{ on: 'lifeGain', targets: [], effects: [{ kind: 'loseLife', amount: 1, who: 'opponent' }] }],
  flavor: 'Su himno es dulce para los fieles y ruinoso para todos los demás.',
};
