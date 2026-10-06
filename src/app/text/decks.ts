import { colorName, type Color } from '../../engine';
import { count, messages, plural } from '../../i18n';

export const deckBuildingText = messages({
  es: {
    defaultName: 'Mi mazo',
    description: (creatures: number, spells: number, lands: number) =>
      `Mazo propio: ${count(creatures, 'criatura', 'criaturas')}, ${count(spells, 'hechizo', 'hechizos')} y ${count(lands, 'tierra', 'tierras')}.`,
    unnamed: 'Ponle un nombre al mazo.',
    tooFew: (missing: number, min: number) =>
      `${plural(missing, 'Falta', 'Faltan')} ${count(missing, 'carta', 'cartas')}: un mazo tiene al menos ${min}.`,
    tooMany: (extra: number, max: number) =>
      `${plural(extra, 'Sobra', 'Sobran')} ${count(extra, 'carta', 'cartas')}: un mazo tiene como mucho ${max}.`,
    notInPool: (name: string) => `${name} no está entre las cartas que puedes usar.`,
    tooManyCopies: (copies: number, name: string, max: number) =>
      `Llevas ${copies} copias de ${name}: puedes llevar ${max}.`,
    landCount: (lands: number, size: number) =>
      `Llevas ${count(lands, 'tierra', 'tierras')} de ${size}: la mayoría de los mazos llevan entre 15 y 17.`,
    unpaidColor: (color: Color) =>
      `Nada en el mazo da maná ${colorName(color, 'mana')}: tus cartas ${colorName(color, 'cards')} no podrán pagarse.`,
  },
  en: {
    defaultName: 'My deck',
    description: (creatures: number, spells: number, lands: number) =>
      `Custom deck: ${count(creatures, 'creature', 'creatures')}, ${count(spells, 'spell', 'spells')}, and ${count(lands, 'land', 'lands')}.`,
    unnamed: 'Give the deck a name.',
    tooFew: (missing: number, min: number) => `${count(missing, 'card', 'cards')} short: a deck has at least ${min}.`,
    tooMany: (extra: number, max: number) => `${count(extra, 'card', 'cards')} too many: a deck has at most ${max}.`,
    notInPool: (name: string) => `${name} isn't among the cards you can use.`,
    tooManyCopies: (copies: number, name: string, max: number) =>
      `You have ${copies} copies of ${name}: you can have up to ${max}.`,
    landCount: (lands: number, size: number) =>
      `You have ${count(lands, 'land', 'lands')} out of ${size}: most decks run 15 to 17.`,
    unpaidColor: (color: Color) =>
      `Nothing in the deck makes ${colorName(color, 'mana')} mana: your ${colorName(color, 'cards')} cards can't be paid for.`,
  },
});
