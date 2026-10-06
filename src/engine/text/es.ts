import { count, plural } from '../../i18n/plural';
import { getCardDef } from '../registry';
import type { Refusal } from '../refusals';
import { isPlayerTarget } from '../targets';
import {
  COLORS,
  type CardDef,
  type CardId,
  type CardType,
  type Color,
  type Effect,
  type GameEvent,
  type GameState,
  type Keyword,
  type PlayerId,
  type Step,
  type Target,
  type TargetSpec,
  type TriggerCondition,
  type TriggerEvent,
} from '../types';
import {
  capitalize,
  capitalizeParts,
  formatModifier,
  joined,
  line,
  lowerFirst,
  mention,
  plainText,
  type TextPart,
} from './parts';
import {
  activatedText,
  describeState,
  rulesText,
  triggerText,
  type RulesGrammar,
  type SentenceContext,
  type StateWords,
  type TargetRef,
} from './shared';
import type { ColorNoun, EngineText } from './types';

const KEYWORD_NAMES: Record<Keyword, string> = {
  flying: 'Vuela',
  reach: 'Alcance',
  haste: 'Prisa',
  vigilance: 'Vigilancia',
  trample: 'Arrolla',
  firstStrike: 'Daña primero',
  doubleStrike: 'Daña dos veces',
  deathtouch: 'Toque mortal',
  lifelink: 'Vínculo vital',
  menace: 'Amenaza',
  defender: 'Defensor',
  flash: 'Destello',
  skulk: 'Escurridizo',
  undying: 'Resiliencia',
  hexproof: 'Antimaleficio',
  evolve: 'Evolucionar',
  prowess: 'Destreza',
};

const KEYWORD_ABILITIES: Record<Keyword, string> = {
  flying: 'volar',
  reach: 'alcance',
  haste: 'prisa',
  vigilance: 'vigilancia',
  trample: 'arrollar',
  firstStrike: 'dañar primero',
  doubleStrike: 'dañar dos veces',
  deathtouch: 'toque mortal',
  lifelink: 'vínculo vital',
  menace: 'amenaza',
  defender: 'defensor',
  flash: 'destello',
  skulk: 'escurridizo',
  undying: 'resiliencia',
  hexproof: 'antimaleficio',
  evolve: 'evolucionar',
  prowess: 'destreza',
};

const KEYWORD_REMINDERS: Record<Keyword, string> = {
  flying: 'No puede ser bloqueada excepto por criaturas con la habilidad de volar o alcance.',
  reach: 'Puede bloquear criaturas con la habilidad de volar.',
  haste: 'Puede atacar y {T} tan pronto como esté bajo tu control.',
  vigilance: 'Atacar no hace que se gire.',
  trample: 'El daño de combate que supere lo letal para sus bloqueadoras se le hace al jugador defensor.',
  firstStrike: 'Hace su daño de combate antes que las criaturas sin la habilidad de dañar primero.',
  doubleStrike: 'Hace tanto daño de combate de dañar primero como daño de combate normal.',
  deathtouch: 'Cualquier cantidad de daño que haga a una criatura basta para destruirla.',
  lifelink: 'El daño que hace también hace que su controlador gane esa misma cantidad de vidas.',
  menace: 'No puede ser bloqueada excepto por dos o más criaturas.',
  defender: 'No puede atacar.',
  flash: 'Puedes lanzarla en cualquier momento en que pudieras lanzar un instantáneo.',
  skulk: 'No puede ser bloqueada por criaturas con mayor fuerza.',
  undying: 'Cuando muere, si no tenía contadores +1/+1, regresa al campo de batalla con un contador +1/+1.',
  hexproof: 'No puede ser objetivo de hechizos o habilidades que controlan tus oponentes.',
  evolve: 'Recibe un contador +1/+1 siempre que otra criatura con más fuerza o más resistencia entre bajo tu control.',
  prowess:
    'Siempre que lances un hechizo que no sea de criatura, esta criatura obtiene +1/+1 hasta el final del turno.',
};

const STEP_NAMES: Record<Step, string> = {
  mulligan: 'Mano inicial',
  untap: 'Paso de enderezar',
  upkeep: 'Mantenimiento',
  draw: 'Paso de robar',
  main1: 'Fase principal',
  beginCombat: 'Inicio del combate',
  declareAttackers: 'Declarar atacantes',
  declareBlockers: 'Declarar bloqueadoras',
  firstStrikeDamage: 'Primer daño de combate',
  combatDamage: 'Daño de combate',
  endCombat: 'Final del combate',
  main2: 'Segunda fase principal',
  end: 'Paso final',
  cleanup: 'Limpieza',
};

const TYPE_NAMES: Record<CardType, string> = {
  land: 'Tierra',
  creature: 'Criatura',
  instant: 'Instantáneo',
  sorcery: 'Conjuro',
  relic: 'Reliquia',
};

const SUPERTYPE_NAMES: Record<string, string> = { Basic: 'básica' };

const NUMBER_WORDS = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez'];

const RIVAL = 'el rival';

function startsWithI(word: string): boolean {
  return /^h?[ií](?![aeiouáéíóú])/i.test(word);
}

function conjunction(last: string): string {
  return startsWithI(last) ? 'e' : 'y';
}

function withA(phrase: string): string {
  return phrase.startsWith('el ') ? `al ${phrase.slice(3)}` : `a ${phrase}`;
}

function typeLine(def: CardDef): string {
  const words = [
    ...def.types.map((type) => TYPE_NAMES[type]),
    ...(def.token ? ['ficha'] : []),
    ...(def.supertypes ?? []).map((supertype) => SUPERTYPE_NAMES[supertype] ?? supertype),
  ];
  const main = words.map((word, index) => (index === 0 ? word : lowerFirst(word))).join(' ');
  const subtypes = (def.subtypes ?? [])
    .map((subtype, index) => (index === 0 ? subtype : lowerFirst(subtype)))
    .join(' ');
  return subtypes ? `${main} — ${subtypes}` : main;
}

const COLOR_WORDS: Record<Color, Record<ColorNoun, string>> = {
  W: { mana: 'blanco', card: 'blanca', cards: 'blancas' },
  U: { mana: 'azul', card: 'azul', cards: 'azules' },
  B: { mana: 'negro', card: 'negra', cards: 'negras' },
  R: { mana: 'rojo', card: 'roja', cards: 'rojas' },
  G: { mana: 'verde', card: 'verde', cards: 'verdes' },
};

function andList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items.at(-1) as string;
  return `${items.slice(0, -1).join(', ')} ${conjunction(last)} ${last}`;
}

function keywordList(keywords: readonly Keyword[]): string {
  return andList(keywords.map((keyword) => KEYWORD_ABILITIES[keyword]));
}

function abilityPhrase(keywords: readonly Keyword[]): string {
  return `${plural(keywords.length, 'la habilidad', 'las habilidades')} de ${keywordList(keywords)}`;
}

function formatPump(power: number, toughness: number, keywords: readonly Keyword[]): string {
  if (keywords.length === 0) return formatModifier(power, toughness);
  if (power === 0 && toughness === 0) return keywordList(keywords);
  return `${formatModifier(power, toughness)}, ${keywordList(keywords)}`;
}

function tokenDescription(defId: string, amount: number): string {
  const token = getCardDef(defId);
  const form = plural(amount, 'card', 'cards');
  const colors = token.colors?.length
    ? andList(token.colors.map((color) => COLOR_WORDS[color][form]))
    : plural(amount, 'incolora', 'incoloras');
  const noun = [plural(amount, 'ficha', 'fichas'), 'de criatura', ...(token.subtypes ?? [])].join(' ');
  const keywords = token.keywords?.length ? ` con ${abilityPhrase(token.keywords)}` : '';
  return `${noun} ${colors} ${token.power}/${token.toughness}${keywords}`;
}

function targetPhrase(spec: TargetSpec): string {
  switch (spec.kind) {
    case 'any':
      return 'cualquier objetivo';
    case 'creature': {
      const noun = spec.tapped ? 'la criatura girada objetivo' : 'la criatura objetivo';
      if (spec.controller === 'you') return `${noun} que controlas`;
      if (spec.controller === 'opponent') return `${noun} que no controlas`;
      return noun;
    }
    case 'player':
      if (spec.controller === 'opponent') return 'el oponente objetivo';
      if (spec.controller === 'you') return 'ti';
      return 'el jugador objetivo';
    case 'spell':
      return 'el hechizo objetivo';
  }
}

function targetChoice(spec: TargetSpec): string {
  switch (spec.kind) {
    case 'any':
      return 'cualquier objetivo';
    case 'creature': {
      const noun = spec.tapped ? 'una criatura girada objetivo' : 'una criatura objetivo';
      if (spec.controller === 'you') return `${noun} que controles`;
      if (spec.controller === 'opponent') return `${noun} que no controles`;
      return noun;
    }
    case 'player':
      if (spec.controller === 'opponent') return 'un oponente objetivo';
      if (spec.controller === 'you') return 'a ti mismo';
      return 'un jugador objetivo';
    case 'spell':
      return 'un hechizo objetivo';
  }
}

function repeatedPhrase(spec: TargetSpec): string {
  switch (spec.kind) {
    case 'creature':
      return 'esa criatura';
    case 'player':
      return 'ese jugador';
    case 'spell':
      return 'ese hechizo';
    case 'any':
      return 'ese objetivo';
  }
}

function countWord(amount: number): string {
  return NUMBER_WORDS[amount] ?? String(amount);
}

function plusCounters(amount: number): string {
  return amount === 1 ? 'un contador +1/+1' : `${countWord(amount)} contadores +1/+1`;
}

function countersLabel(amount: number): string {
  return `${count(amount, 'contador', 'contadores')} +1/+1`;
}

function landCards(defId: string, amount: number): string {
  const def = getCardDef(defId);
  const basic = def.supertypes?.includes('Basic') ? ` ${def.name.endsWith('a') ? 'básica' : 'básico'}` : '';
  return `${cardsCount(amount)} de ${def.name}${basic}`;
}

function searchLandSentence(land: string, battlefield: number, hand: number, tapped: boolean): string {
  const search = `Busca en tu biblioteca ${landCards(land, battlefield + hand)}`;
  if (hand === 0) {
    const put = battlefield === 1 ? 'ponla' : 'ponlas';
    const turned = tapped ? (battlefield === 1 ? ' girada' : ' giradas') : '';
    return `${search}, ${put} en el campo de batalla${turned} y luego baraja.`;
  }
  if (battlefield === 0)
    return `${search}, ${hand === 1 ? 'revélala, ponla' : 'revélalas, ponlas'} en tu mano y luego baraja.`;
  return `${search}, pon una en el campo de batalla${tapped ? ' girada' : ''} y la otra en tu mano, y luego baraja.`;
}

function extraLandsText(amount: number): string {
  return amount === 1 ? 'una tierra adicional' : `${countWord(amount)} tierras adicionales`;
}

function damagePoints(amount: number): string {
  return `${count(amount, 'punto', 'puntos')} de daño`;
}

function lifeAmount(amount: number): string {
  return count(amount, 'vida', 'vidas');
}

function cardsCount(amount: number): string {
  return amount === 1 ? 'una carta' : `${countWord(amount)} cartas`;
}

function gainsText(
  verb: 'obtiene' | 'obtienen',
  power: number,
  toughness: number,
  keywords: readonly Keyword[] = [],
): string {
  const gain = verb === 'obtiene' ? 'gana' : 'ganan';
  if (keywords.length === 0) return `${verb} ${formatModifier(power, toughness)}`;
  if (power === 0 && toughness === 0) return `${gain} ${abilityPhrase(keywords)}`;
  return `${verb} ${formatModifier(power, toughness)} y ${gain} ${abilityPhrase(keywords)}`;
}

function withSubject(subject: string, predicate: string): string {
  return subject ? `${subject} ${predicate}` : predicate;
}

function effectSentence(effect: Effect, ref: TargetRef, context: SentenceContext): string {
  switch (effect.kind) {
    case 'damage':
      return withSubject(context.subject, `hace ${damagePoints(effect.amount)} ${withA(ref(effect.to, 'object'))}.`);
    case 'pump':
      return withSubject(
        ref(effect.to, 'subject'),
        `${gainsText('obtiene', effect.power, effect.toughness, effect.keywords)} hasta el final del turno.`,
      );
    case 'destroy':
      return `Destruye ${ref(effect.to, 'object')}.`;
    case 'bounce':
      return `Regresa ${ref(effect.to, 'object')} a la mano de su propietario.`;
    case 'counter':
      return `Contrarresta ${ref(effect.to, 'object')}.`;
    case 'draw':
      return `Roba ${cardsCount(effect.amount)}.`;
    case 'gainLife':
      return `Ganas ${lifeAmount(effect.amount)}.`;
    case 'loseLife':
      return effect.who === 'opponent'
        ? `Cada oponente pierde ${lifeAmount(effect.amount)}.`
        : `Pierdes ${lifeAmount(effect.amount)}.`;
    case 'fight':
      return withSubject(ref(effect.a, 'subject'), `lucha contra ${ref(effect.b, 'object')}.`);
    case 'bite':
      return withSubject(
        ref(effect.a, 'subject'),
        `hace una cantidad de daño igual a su fuerza ${withA(ref(effect.b, 'object'))}.`,
      );
    case 'pumpTeam':
      return `Las criaturas que controlas ${gainsText('obtienen', effect.power, effect.toughness, effect.keywords)} hasta el final del turno.`;
    case 'addCounters':
      return `Pon ${plusCounters(effect.amount)} sobre ${ref(effect.to, 'object')}.`;
    case 'addCountersTeam':
      return `Pon ${plusCounters(effect.amount)} sobre cada criatura que controlas.`;
    case 'createTokens':
      return `Crea ${effect.amount === 1 ? 'una' : countWord(effect.amount)} ${tokenDescription(effect.token, effect.amount)}.`;
    case 'discard':
      if (effect.who !== 'opponent') return `Descarta ${cardsCount(effect.amount)}.`;
      if (context.on === 'damagesPlayer') return `Ese jugador descarta ${cardsCount(effect.amount)}.`;
      return `Cada oponente descarta ${cardsCount(effect.amount)}.`;
    case 'returnToBattlefield':
      return `Regrésala al campo de batalla bajo el control de su propietario con ${plusCounters(effect.counters)}.`;
    case 'extraLands':
      return `Puedes jugar ${extraLandsText(effect.amount)} este turno.`;
    case 'searchLand':
      return searchLandSentence(effect.land, effect.battlefield, effect.hand ?? 0, effect.tapped ?? false);
  }
}

const TRIGGER_OPENERS: Record<TriggerEvent, string> = {
  upkeep: 'Al comienzo de tu mantenimiento',
  enters: 'Cuando esta criatura entre',
  dies: 'Cuando esta criatura muera',
  attacks: 'Siempre que esta criatura ataque',
  spell: 'Siempre que lances un hechizo de instantáneo o de conjuro',
  allyEnters: 'Siempre que otra criatura que controlas entre',
  allyDies: 'Siempre que otra criatura que controlas muera',
  damagesPlayer: 'Siempre que esta criatura haga daño de combate a un jugador',
  lifeGain: 'Siempre que ganes vidas',
  landfall: 'Aterrizaje — Siempre que una tierra que controlas entre',
};

const RELIC_OPENERS: Partial<Record<TriggerEvent, string>> = {
  allyEnters: 'Siempre que una criatura que controlas entre',
  allyDies: 'Siempre que una criatura que controlas muera',
};

const TRIGGER_CONDITIONS: Record<TriggerCondition, string> = {
  opponentDamaged: 'si un oponente recibió daño este turno',
  emptyHand: 'si no tienes cartas en la mano',
};

function manaChoice(colors: readonly Color[]): string {
  if (colors.length === COLORS.length) return 'un maná de cualquier color';
  const symbols = colors.map((color) => `{${color}}`);
  if (symbols.length === 1) return symbols.join('');
  return `${symbols.slice(0, -1).join(', ')} o ${symbols.at(-1)}`;
}

function playerLabel(player: PlayerId, viewer: PlayerId): string {
  return player === viewer ? 'tú' : RIVAL;
}

function joinedAnd(items: TextPart[][]): TextPart[] {
  const last = items.at(-1);
  if (!last || items.length === 1) return last ?? [];
  return [...joined(items.slice(0, -1), ', '), ` ${conjunction(plainText(last))} `, ...last];
}

function cardRefParts(s: GameState, id: CardId, viewer: PlayerId): TextPart[] {
  const card = s.cards[id];
  if (!card) return [id];
  return card.controller === viewer ? line`tu ${mention(s, id)}` : line`${mention(s, id)} del rival`;
}

function targetRefParts(s: GameState, target: Target, viewer: PlayerId): TextPart[] {
  return isPlayerTarget(target) ? [playerLabel(target.player, viewer)] : cardRefParts(s, target.card, viewer);
}

function targetObjectParts(s: GameState, target: Target, viewer: PlayerId): TextPart[] {
  if (isPlayerTarget(target)) return [target.player === viewer ? 'ti' : RIVAL];
  return cardRefParts(s, target.card, viewer);
}

function act(player: PlayerId, viewer: PlayerId, second: string, third: string): string {
  return player === viewer ? capitalize(second) : `El rival ${third}`;
}

function targetsSuffix(s: GameState, targets: Target[], viewer: PlayerId): TextPart[] {
  if (targets.length === 0) return [];
  return line` sobre ${joinedAnd(targets.map((target) => targetObjectParts(s, target, viewer)))}`;
}

function damageParts(s: GameState, target: Target, amount: number, viewer: PlayerId): TextPart[] {
  if (isPlayerTarget(target)) {
    return target.player === viewer
      ? line`te hace ${damagePoints(amount)}`
      : line`hace ${damagePoints(amount)} al rival`;
  }
  return line`hace ${damagePoints(amount)} a ${cardRefParts(s, target.card, viewer)}`;
}

function describeEventParts(s: GameState, event: GameEvent, viewer: PlayerId): TextPart[] | null {
  switch (event.t) {
    case 'start':
      return event.startingPlayer === viewer ? line`Empiezas tú.` : line`Empieza el rival.`;
    case 'mulligan':
      return line`${act(event.player, viewer, 'haces', 'hace')} mulligan (${event.count}).`;
    case 'keep':
      return line`${act(event.player, viewer, 'te quedas', 'se queda')} con ${count(event.handSize, 'carta', 'cartas')}.`;
    case 'bottom':
      return line`${act(event.player, viewer, 'pones', 'pone')} ${count(event.count, 'carta', 'cartas')} en el fondo de ${event.player === viewer ? 'tu' : 'su'} biblioteca.`;
    case 'turn':
      return line`Turno ${event.turn} — ${event.player === viewer ? 'tu turno' : 'turno del rival'}.`;
    case 'draw':
      return event.player === viewer ? line`Robas ${mention(s, event.card)}.` : line`El rival roba una carta.`;
    case 'drawEmpty':
      return event.player === viewer
        ? line`No puedes robar: tu biblioteca está vacía.`
        : line`El rival no puede robar: su biblioteca está vacía.`;
    case 'land':
      return line`${act(event.player, viewer, 'juegas', 'juega')} ${mention(s, event.card)}.`;
    case 'cast':
      return line`${act(event.player, viewer, 'lanzas', 'lanza')} ${mention(s, event.card)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'activate': {
      const own = s.cards[event.card]?.controller === event.player;
      const source = own
        ? line`${event.player === viewer ? 'tu' : 'su'} ${mention(s, event.card)}`
        : cardRefParts(s, event.card, viewer);
      return line`${act(event.player, viewer, 'activas', 'activa')} ${source}${targetsSuffix(s, event.targets, viewer)}.`;
    }
    case 'trigger':
      return line`Se dispara ${cardRefParts(s, event.card, viewer)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'fizzle': {
      const subject =
        event.item.kind === 'spell'
          ? [mention(s, event.item.card)]
          : line`La habilidad de ${mention(s, event.item.source)}`;
      return line`${subject} no se resuelve: sus objetivos ya no están.`;
    }
    case 'counter':
      return line`Se contrarresta ${cardRefParts(s, event.card, viewer)}.`;
    case 'bounce':
      return line`${mention(s, event.card)} regresa a ${event.player === viewer ? 'tu mano' : 'la mano del rival'}.`;
    case 'attack':
      if (event.attackers.length === 0) return null;
      return line`${act(event.player, viewer, 'atacas', 'ataca')} con ${joinedAnd(event.attackers.map((id) => [mention(s, id)]))}.`;
    case 'block':
      if (event.blocks.length === 0) return line`${act(event.player, viewer, 'no bloqueas', 'no bloquea')}.`;
      return line`${act(event.player, viewer, 'bloqueas', 'bloquea')}: ${joined(
        event.blocks.map((block) => line`${mention(s, block.blocker)} → ${mention(s, block.attacker)}`),
        ', ',
      )}.`;
    case 'damage':
      return line`${capitalizeParts(cardRefParts(s, event.source, viewer))} ${damageParts(s, event.target, event.amount, viewer)}.`;
    case 'life':
      return event.delta > 0
        ? line`${act(event.player, viewer, 'ganas', 'gana')} ${lifeAmount(event.delta)} (${event.life}).`
        : null;
    case 'loseLife':
      return line`${act(event.player, viewer, 'pierdes', 'pierde')} ${lifeAmount(event.amount)}.`;
    case 'pump':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} ${gainsText('obtiene', event.power, event.toughness, event.keywords)} hasta el final del turno.`;
    case 'create':
      return line`${act(event.player, viewer, 'creas', 'crea')} una ficha de ${mention(s, event.card)}.`;
    case 'return':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} regresa al campo de batalla.`;
    case 'addCounters':
      return line`${capitalizeParts(cardRefParts(s, event.card, viewer))} recibe ${event.amount === 1 ? 'un contador +1/+1' : `${event.amount} contadores +1/+1`}.`;
    case 'fight':
      return line`${capitalizeParts(cardRefParts(s, event.a, viewer))} lucha contra ${cardRefParts(s, event.b, viewer)}.`;
    case 'bite':
      return null;
    case 'dies':
      return line`Muere ${cardRefParts(s, event.card, viewer)}.`;
    case 'discard':
      return line`${act(event.player, viewer, 'descartas', 'descarta')} ${mention(s, event.card)}.`;
    case 'concede':
      return line`${act(event.player, viewer, 'te rindes', 'se rinde')}.`;
    case 'gameOver':
      if (event.winner === null) return line`La partida termina en empate.`;
      return event.winner === viewer ? line`¡Ganas!` : line`Gana el rival.`;
    case 'search': {
      const mine = event.player === viewer;
      const where = event.to === 'hand' ? (mine ? 'tu mano' : 'su mano') : 'el campo de batalla';
      return line`${act(event.player, viewer, 'buscas', 'busca')} en ${mine ? 'tu' : 'su'} biblioteca y ${mine ? 'pones' : 'pone'} ${mention(s, event.card)} en ${where}.`;
    }
    case 'extraLands':
      return line`${act(event.player, viewer, 'puedes', 'puede')} jugar ${extraLandsText(event.amount)} este turno.`;
    case 'resolve':
    case 'enter':
      return null;
  }
}

function refusal(refused: Refusal): string {
  switch (refused.code) {
    case 'malformedAction':
      return 'acción mal formada';
    case 'unknownAction':
      return `tipo de acción desconocido «${refused.type}»`;
    case 'unknownPlayer':
      return 'jugador desconocido';
    case 'noDecision':
      return 'la partida no está esperando ninguna decisión';
    case 'gameOver':
      return 'la partida ha terminado';
    case 'notWaitingFor':
      return `la partida no está esperando la decisión «${refused.kind}»`;
    case 'notTheirDecision':
      return `no le toca decidir al jugador ${refused.player}`;
    case 'otherSeat':
      return 'solo puedes actuar por tu propio asiento';
    case 'notYourDecision':
      return 'no te toca decidir';
    case 'noMoreMulligans':
      return 'no se permiten más mulligans';
    case 'cardsNotList':
      return 'las cartas deben ser una lista';
    case 'chooseExactly':
      return `elige exactamente ${count(refused.count, 'carta', 'cartas')}`;
    case 'chosenNotInHand':
      return `${refused.card} no está en tu mano`;
    case 'chosenTwice':
      return `${refused.card} se eligió dos veces`;
    case 'notInHand':
      return 'esa carta no está en tu mano';
    case 'notALand':
      return 'esa carta no es una tierra';
    case 'landTiming':
      return 'las tierras solo se pueden jugar en tu fase principal con la pila vacía';
    case 'landPlayed':
      return 'ya has jugado una tierra este turno';
    case 'allLandsPlayed':
      return 'ya has jugado todas las tierras que puedes este turno';
    case 'landsAreNotCast':
      return 'las tierras se juegan, no se lanzan';
    case 'noPriority':
      return 'no tienes la prioridad';
    case 'sorceryTiming':
      return 'esto solo se puede lanzar en tu fase principal con la pila vacía';
    case 'notEnoughMana':
      return 'no hay suficiente maná';
    case 'notYourPermanent':
      return 'no controlas ese permanente';
    case 'noSuchAbility':
      return 'ese permanente no tiene esa habilidad';
    case 'tapped':
      return 'ese permanente está girado';
    case 'summoningSick':
      return 'esa criatura tiene mareo de invocación';
    case 'triggerGone':
      return 'esa habilidad disparada ya no espera objetivos';
    case 'targetsNotList':
      return 'los objetivos deben ser una lista';
    case 'targetCount':
      return `número de objetivos incorrecto: ${refused.given} en vez de ${refused.expected}`;
    case 'targetMalformed':
      return `el objetivo ${refused.index} está mal formado`;
    case 'illegalTarget':
      return `el objetivo ${refused.index} (${refused.target}) no es legal`;
    case 'sameTargetTwice':
      return 'no se puede elegir el mismo objetivo dos veces';
    case 'attackersNotList':
      return 'las atacantes deben ser una lista';
    case 'attackersNotIds':
      return 'las atacantes deben ser ids de carta';
    case 'attackerTwice':
      return `${refused.card} se declaró dos veces`;
    case 'cannotAttack':
      return `${refused.card} no puede atacar`;
    case 'blocksNotList':
      return 'los bloqueos deben ser una lista';
    case 'noCombat':
      return 'no hay combate';
    case 'malformedBlock':
      return 'bloqueo mal formado';
    case 'blockerTwice':
      return `${refused.card} solo puede bloquear a una atacante`;
    case 'cannotBlock':
      return `${refused.blocker} no puede bloquear a ${refused.attacker}`;
    case 'menace':
      return `${refused.attacker} tiene la habilidad de amenaza y no puede ser bloqueada excepto por dos o más criaturas`;
  }
}

const RULES: RulesGrammar = {
  keywordNames: KEYWORD_NAMES,
  keywordLine: (keywords) => `${keywords}.`,
  entersTapped: 'Esta tierra entra girada.',
  manaAbility: (colors) => `{T}: Agrega ${manaChoice(colors)}.`,
  triggerOpeners: TRIGGER_OPENERS,
  relicOpeners: RELIC_OPENERS,
  triggerConditions: TRIGGER_CONDITIONS,
  undying: `${TRIGGER_OPENERS.dies}, si no tenía contadores +1/+1 sobre ella, regrésala al campo de batalla bajo el control de su propietario con un contador +1/+1.`,
  evolve: `${TRIGGER_OPENERS.allyEnters}, si la fuerza o la resistencia de esa criatura es mayor que la de esta criatura, pon un contador +1/+1 sobre esta criatura.`,
  prowess: KEYWORD_REMINDERS.prowess,
  sacrificeCost: 'sacrificar esta criatura',
  selves: {
    pronoun: { subject: '', object: 'ella' },
    creature: { subject: 'esta criatura', object: 'esta criatura' },
    sacrificed: { subject: '', object: 'esta criatura' },
  },
  targetPhrase,
  repeatedPhrase,
  effectSentence,
  moreDamage: (amount, target) => `y ${damagePoints(amount)} ${withA(target)}.`,
  andThen: ' y luego ',
};

const STATE: StateWords = {
  stepName: (step) => STEP_NAMES[step],
  turn: 'Turno',
  active: 'activo',
  life: lifeAmount,
  library: 'biblioteca',
  graveyard: 'cementerio',
  hand: 'mano',
  hiddenHand: (cards) => `${cards} cartas`,
  battlefield: 'campo de batalla',
  relics: 'reliquias',
  stack: 'pila',
  ability: (source) => `habilidad de ${source}`,
  targets: targetsSuffix,
  waitingFor: 'esperando',
  tapped: 'girada',
  summoningSick: 'mareo',
  damage: (amount) => `${amount} de daño`,
  counters: countersLabel,
  attacking: 'atacando',
  blocking: (attacker) => `bloqueando a ${attacker}`,
};

export const es: EngineText = {
  playerNames: ['Tú', 'IA'],
  keywordName: (keyword) => KEYWORD_NAMES[keyword],
  keywordReminder: (keyword) => KEYWORD_REMINDERS[keyword],
  stepName: (step) => STEP_NAMES[step],
  colorName: (color, noun) => COLOR_WORDS[color][noun],
  typeLine,
  rulesText: (def) => rulesText(RULES, def),
  triggerText: (def, index) => triggerText(RULES, def, index),
  activatedText: (def, index) => activatedText(RULES, def, index),
  tokenDescription,
  targetChoice,
  formatPump,
  countersLabel,
  targetRefParts,
  describeEventParts,
  describeState: (s, viewer, revealAll) => describeState(STATE, s, viewer, revealAll),
  refusal,
};
