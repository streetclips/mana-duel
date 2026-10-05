import { formatCost } from './mana';
import { getCardDef, getCost } from './registry';
import { EVOLVE_TRIGGER, PROWESS_TRIGGER, UNDYING_TRIGGER, getCard, getPower, getToughness, isCreatureDef, isRelicDef } from './state';
import { isPlayerTarget } from './targets';
import type {
  CardDef,
  CardId,
  CardType,
  Color,
  Effect,
  EffectTarget,
  GameEvent,
  GameState,
  Keyword,
  PlayerId,
  Step,
  Target,
  TargetSpec,
  TriggerCondition,
  TriggerEvent,
} from './types';

export const KEYWORD_NAMES: Record<Keyword, string> = {
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

export const KEYWORD_REMINDERS: Record<Keyword, string> = {
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
  prowess: 'Siempre que lances un hechizo que no sea de criatura, esta criatura obtiene +1/+1 hasta el final del turno.',
};

export const STEP_NAMES: Record<Step, string> = {
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

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function signed(value: number): string {
  return value >= 0 ? `+${value}` : String(value);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function startsWithI(word: string): boolean {
  return /^h?[ií](?![aeiouáéíóú])/i.test(word);
}

function conjunction(last: string): string {
  return startsWithI(last) ? 'e' : 'y';
}

function withA(phrase: string): string {
  return phrase.startsWith('el ') ? `al ${phrase.slice(3)}` : `a ${phrase}`;
}

export function formatModifier(power: number, toughness: number): string {
  return `${signed(power)}/${signed(toughness)}`;
}

export function typeLine(def: CardDef): string {
  const words = [
    ...def.types.map((type) => TYPE_NAMES[type]),
    ...(def.token ? ['ficha'] : []),
    ...(def.supertypes ?? []).map((supertype) => SUPERTYPE_NAMES[supertype] ?? supertype),
  ];
  const main = words.map((word, index) => (index === 0 ? word : lowerFirst(word))).join(' ');
  const subtypes = (def.subtypes ?? []).map((subtype, index) => (index === 0 ? subtype : lowerFirst(subtype))).join(' ');
  return subtypes ? `${main} — ${subtypes}` : main;
}

const COLOR_COUNT = 5;

const COLOR_WORDS: Record<Color, [string, string]> = {
  W: ['blanca', 'blancas'],
  U: ['azul', 'azules'],
  B: ['negra', 'negras'],
  R: ['roja', 'rojas'],
  G: ['verde', 'verdes'],
};

function andList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items.at(-1) as string;
  return `${items.slice(0, -1).join(', ')} ${conjunction(last)} ${last}`;
}

export function keywordList(keywords: readonly Keyword[]): string {
  return andList(keywords.map((keyword) => KEYWORD_ABILITIES[keyword]));
}

function abilityPhrase(keywords: readonly Keyword[]): string {
  return `${plural(keywords.length, 'la habilidad', 'las habilidades')} de ${keywordList(keywords)}`;
}

export function formatPump(power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  if (keywords.length === 0) return formatModifier(power, toughness);
  if (power === 0 && toughness === 0) return keywordList(keywords);
  return `${formatModifier(power, toughness)}, ${keywordList(keywords)}`;
}

export function tokenDescription(defId: string, amount = 1): string {
  const token = getCardDef(defId);
  const form = amount === 1 ? 0 : 1;
  const colors = token.colors?.length
    ? andList(token.colors.map((color) => COLOR_WORDS[color][form]))
    : plural(amount, 'incolora', 'incoloras');
  const noun = [plural(amount, 'ficha', 'fichas'), 'de criatura', ...(token.subtypes ?? [])].join(' ');
  const keywords = token.keywords?.length ? ` con ${abilityPhrase(token.keywords)}` : '';
  return `${noun} ${colors} ${token.power}/${token.toughness}${keywords}`;
}

export function targetPhrase(spec: TargetSpec): string {
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

export function targetChoice(spec: TargetSpec): string {
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

export function countersLabel(count: number): string {
  return `${count} ${plural(count, 'contador', 'contadores')} +1/+1`;
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
  if (battlefield === 0) return `${search}, ${hand === 1 ? 'revélala, ponla' : 'revélalas, ponlas'} en tu mano y luego baraja.`;
  return `${search}, pon una en el campo de batalla${tapped ? ' girada' : ''} y la otra en tu mano, y luego baraja.`;
}

function extraLandsText(amount: number): string {
  return amount === 1 ? 'una tierra adicional' : `${countWord(amount)} tierras adicionales`;
}

function damagePoints(amount: number): string {
  return `${amount} ${plural(amount, 'punto', 'puntos')} de daño`;
}

function lifeAmount(amount: number): string {
  return `${amount} ${plural(amount, 'vida', 'vidas')}`;
}

function cardsCount(amount: number): string {
  return amount === 1 ? 'una carta' : `${countWord(amount)} cartas`;
}

function gainsText(verb: 'obtiene' | 'obtienen', power: number, toughness: number, keywords: readonly Keyword[] = []): string {
  const gain = verb === 'obtiene' ? 'gana' : 'ganan';
  if (keywords.length === 0) return `${verb} ${formatModifier(power, toughness)}`;
  if (power === 0 && toughness === 0) return `${gain} ${abilityPhrase(keywords)}`;
  return `${verb} ${formatModifier(power, toughness)} y ${gain} ${abilityPhrase(keywords)}`;
}

interface SelfReference {
  subject: string;
  object: string;
}

type Role = keyof SelfReference;

interface SentenceContext {
  subject: string;
  on?: TriggerEvent;
}

const NO_SELF: SelfReference = { subject: '', object: '' };

function withSubject(subject: string, predicate: string): string {
  return subject ? `${subject} ${predicate}` : predicate;
}

function effectSentence(effect: Effect, ref: (target: EffectTarget, role: Role) => string, context: SentenceContext): string {
  switch (effect.kind) {
    case 'damage':
      return withSubject(context.subject, `hace ${damagePoints(effect.amount)} ${withA(ref(effect.to, 'object'))}.`);
    case 'pump':
      return withSubject(ref(effect.to, 'subject'), `${gainsText('obtiene', effect.power, effect.toughness, effect.keywords)} hasta el final del turno.`);
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
      return effect.who === 'opponent' ? `Cada oponente pierde ${lifeAmount(effect.amount)}.` : `Pierdes ${lifeAmount(effect.amount)}.`;
    case 'fight':
      return withSubject(ref(effect.a, 'subject'), `lucha contra ${ref(effect.b, 'object')}.`);
    case 'bite':
      return withSubject(ref(effect.a, 'subject'), `hace una cantidad de daño igual a su fuerza ${withA(ref(effect.b, 'object'))}.`);
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

function sentences(effects: Effect[], specs: TargetSpec[], context: SentenceContext, self: SelfReference): string {
  const named = new Set<number>();
  const ref = (target: EffectTarget, role: Role): string => {
    if (target === 'self') return self[role];
    const spec = specs[target];
    if (!spec) return '';
    if (named.has(target)) return repeatedPhrase(spec);
    named.add(target);
    return targetPhrase(spec);
  };
  const lines: string[] = [];
  effects.forEach((effect, index) => {
    const previous = effects[index - 1];
    if (effect.kind === 'damage' && previous?.kind === 'damage' && lines.length > 0) {
      lines.push(`${(lines.pop() as string).replace(/\.$/, '')} y ${damagePoints(effect.amount)} ${withA(ref(effect.to, 'object'))}.`);
      return;
    }
    const text = capitalize(effectSentence(effect, ref, context));
    if (effect.kind === 'discard' && effect.who !== 'opponent' && previous?.kind === 'draw' && lines.length > 0) {
      lines.push(`${(lines.pop() as string).replace(/\.$/, '')} y luego ${lowerFirst(text)}`);
    } else lines.push(text);
  });
  return lines.join(' ');
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

const OPENER_NAMES_IT: ReadonlySet<TriggerEvent> = new Set(['enters', 'dies', 'attacks', 'damagesPlayer']);

export function manaChoice(colors: readonly Color[]): string {
  if (colors.length === COLOR_COUNT) return 'un maná de cualquier color';
  const symbols = colors.map((color) => `{${color}}`);
  if (symbols.length === 1) return symbols.join('');
  return `${symbols.slice(0, -1).join(', ')} o ${symbols.at(-1)}`;
}

export function rulesText(def: CardDef): string[] {
  const lines: string[] = [];
  if (def.keywords?.length) {
    lines.push(`${def.keywords.map((keyword, i) => (i === 0 ? KEYWORD_NAMES[keyword] : lowerFirst(KEYWORD_NAMES[keyword]))).join(', ')}.`);
  }
  if (def.entersTapped) lines.push('Esta tierra entra girada.');
  if (def.mana?.length) lines.push(`{T}: Agrega ${manaChoice(def.mana)}.`);
  if (def.spell) {
    lines.push(sentences(def.spell.effects, def.spell.targets, { subject: def.name }, NO_SELF));
  }
  (def.triggers ?? []).forEach((_, index) => lines.push(triggerText(def, index)));
  (def.activated ?? []).forEach((_, index) => lines.push(activatedText(def, index)));
  return lines;
}

export function triggerText(def: CardDef, index: number): string {
  if (index === UNDYING_TRIGGER) {
    return `${TRIGGER_OPENERS.dies}, si no tenía contadores +1/+1 sobre ella, regrésala al campo de batalla bajo el control de su propietario con un contador +1/+1.`;
  }
  if (index === EVOLVE_TRIGGER) {
    return `${TRIGGER_OPENERS.allyEnters}, si la fuerza o la resistencia de esa criatura es mayor que la de esta criatura, pon un contador +1/+1 sobre esta criatura.`;
  }
  if (index === PROWESS_TRIGGER) return KEYWORD_REMINDERS.prowess;
  const trigger = def.triggers?.[index];
  if (!trigger) return '';
  const self: SelfReference = OPENER_NAMES_IT.has(trigger.on)
    ? { subject: '', object: 'ella' }
    : { subject: 'esta criatura', object: 'esta criatura' };
  const condition = trigger.condition ? `${TRIGGER_CONDITIONS[trigger.condition]}, ` : '';
  const opener = (isRelicDef(def) ? RELIC_OPENERS[trigger.on] : undefined) ?? TRIGGER_OPENERS[trigger.on];
  return `${opener}, ${condition}${lowerFirst(sentences(trigger.effects, trigger.targets, { subject: self.subject, on: trigger.on }, self))}`;
}

export function activatedText(def: CardDef, index: number): string {
  const ability = def.activated?.[index];
  if (!ability) return '';
  const cost = [
    ability.cost && ability.cost !== '{0}' ? ability.cost : '',
    ability.tap ? '{T}' : '',
    ability.sacrifice ? 'sacrificar esta criatura' : '',
  ]
    .filter(Boolean)
    .join(', ');
  const self: SelfReference = ability.sacrifice ? { subject: '', object: 'esta criatura' } : { subject: 'esta criatura', object: 'esta criatura' };
  return `${capitalize(cost)}: ${sentences(ability.effects, ability.targets, { subject: self.subject }, self)}`;
}

export function cardSummary(defId: string): string {
  const def = getCardDef(defId);
  const parts = [def.name];
  if (def.cost) parts.push(formatCost(getCost(defId)));
  parts.push(typeLine(def));
  if (isCreatureDef(def)) parts.push(`${def.power}/${def.toughness}`);
  const text = rulesText(def);
  if (text.length) parts.push(text.join(' '));
  return parts.join(' · ');
}

function playerLabel(player: PlayerId, viewer: PlayerId): string {
  return player === viewer ? 'tú' : RIVAL;
}

export function cardName(s: GameState, id: CardId): string {
  const card = s.cards[id];
  return card ? getCardDef(card.def).name : id;
}

export interface CardMention {
  card: CardId;
  name: string;
}

export type TextPart = string | CardMention;

type TextPiece = TextPart | TextPart[] | number;

export function plainText(parts: readonly TextPart[]): string {
  return parts.map((part) => (typeof part === 'string' ? part : part.name)).join('');
}

function line(literals: TemplateStringsArray, ...pieces: TextPiece[]): TextPart[] {
  const parts: TextPart[] = [];
  const add = (part: TextPart): void => {
    const last = parts.at(-1);
    if (typeof part === 'string' && typeof last === 'string') parts[parts.length - 1] = last + part;
    else if (part !== '') parts.push(part);
  };
  literals.forEach((literal, index) => {
    add(literal);
    const piece = pieces[index];
    if (piece === undefined) return;
    if (Array.isArray(piece)) piece.forEach(add);
    else add(typeof piece === 'number' ? String(piece) : piece);
  });
  return parts;
}

function joined(items: (TextPart | TextPart[])[], separator: string): TextPart[] {
  return items.flatMap((item, index) => [...(index === 0 ? [] : [separator]), ...(Array.isArray(item) ? item : [item])]);
}

function joinedAnd(items: TextPart[][]): TextPart[] {
  const last = items.at(-1);
  if (!last || items.length === 1) return last ?? [];
  return [...joined(items.slice(0, -1), ', '), ` ${conjunction(plainText(last))} `, ...last];
}

function capitalizeParts(parts: TextPart[]): TextPart[] {
  const [first, ...rest] = parts;
  return typeof first === 'string' ? [capitalize(first), ...rest] : parts;
}

function mention(s: GameState, id: CardId): TextPart {
  const card = s.cards[id];
  return card ? { card: id, name: getCardDef(card.def).name } : id;
}

function cardRefParts(s: GameState, id: CardId, viewer: PlayerId): TextPart[] {
  const card = s.cards[id];
  if (!card) return [id];
  return card.controller === viewer ? line`tu ${mention(s, id)}` : line`${mention(s, id)} del rival`;
}

export function cardRef(s: GameState, id: CardId, viewer: PlayerId): string {
  return plainText(cardRefParts(s, id, viewer));
}

function targetRefParts(s: GameState, target: Target, viewer: PlayerId): TextPart[] {
  return isPlayerTarget(target) ? [playerLabel(target.player, viewer)] : cardRefParts(s, target.card, viewer);
}

export function targetRef(s: GameState, target: Target, viewer: PlayerId): string {
  return plainText(targetRefParts(s, target, viewer));
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
    return target.player === viewer ? line`te hace ${damagePoints(amount)}` : line`hace ${damagePoints(amount)} al rival`;
  }
  return line`hace ${damagePoints(amount)} a ${cardRefParts(s, target.card, viewer)}`;
}

export function describeEvent(s: GameState, event: GameEvent, viewer: PlayerId): string | null {
  const parts = describeEventParts(s, event, viewer);
  return parts && plainText(parts);
}

export function describeEventParts(s: GameState, event: GameEvent, viewer: PlayerId): TextPart[] | null {
  switch (event.t) {
    case 'start':
      return event.startingPlayer === viewer ? line`Empiezas tú.` : line`Empieza el rival.`;
    case 'mulligan':
      return line`${act(event.player, viewer, 'haces', 'hace')} mulligan (${event.count}).`;
    case 'keep':
      return line`${act(event.player, viewer, 'te quedas', 'se queda')} con ${event.handSize} ${plural(event.handSize, 'carta', 'cartas')}.`;
    case 'bottom':
      return line`${act(event.player, viewer, 'pones', 'pone')} ${event.count} ${plural(event.count, 'carta', 'cartas')} en el fondo de ${event.player === viewer ? 'tu' : 'su'} biblioteca.`;
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
      const source = own ? line`${event.player === viewer ? 'tu' : 'su'} ${mention(s, event.card)}` : cardRefParts(s, event.card, viewer);
      return line`${act(event.player, viewer, 'activas', 'activa')} ${source}${targetsSuffix(s, event.targets, viewer)}.`;
    }
    case 'trigger':
      return line`Se dispara ${cardRefParts(s, event.card, viewer)}${targetsSuffix(s, event.targets, viewer)}.`;
    case 'fizzle': {
      const subject = event.item.kind === 'spell' ? [mention(s, event.item.card)] : line`La habilidad de ${mention(s, event.item.source)}`;
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
      return event.delta > 0 ? line`${act(event.player, viewer, 'ganas', 'gana')} ${lifeAmount(event.delta)} (${event.life}).` : null;
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

function permanentLabel(s: GameState, id: CardId): string {
  const card = getCard(s, id);
  const def = getCardDef(card.def);
  const flags: string[] = [];
  if (card.tapped) flags.push('girada');
  if (card.summoningSick && isCreatureDef(def)) flags.push('mareo');
  if (card.damage > 0) flags.push(`${card.damage} de daño`);
  if (card.counters > 0) flags.push(countersLabel(card.counters));
  if (s.combat?.attackers.includes(id)) flags.push('atacando');
  const block = s.combat?.blocks.find((candidate) => candidate.blocker === id);
  if (block) flags.push(`bloqueando a ${block.attacker}`);
  const stats = isCreatureDef(def) ? ` ${getPower(s, id)}/${getToughness(s, id)}` : '';
  return `${def.name}(${id})${stats}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
}

export function describeState(s: GameState, viewer: PlayerId = 0, revealAll = false): string {
  const lines: string[] = [];
  lines.push(`Turno ${s.turn} · ${STEP_NAMES[s.step]} · activo: ${s.players[s.activePlayer].name} (p${s.activePlayer})`);
  for (const player of [viewer, viewer === 0 ? 1 : 0] as PlayerId[]) {
    const ps = s.players[player];
    const showHand = revealAll || player === viewer;
    const hand = showHand ? ps.hand.map((id) => `${cardName(s, id)}(${id})`).join(', ') : `${ps.hand.length} cartas`;
    lines.push(`${ps.name} (p${player}): ${lifeAmount(ps.life)} · biblioteca ${ps.library.length} · cementerio ${ps.graveyard.length}`);
    lines.push(`  mano: ${hand || '—'}`);
    lines.push(`  campo de batalla: ${ps.battlefield.map((id) => permanentLabel(s, id)).join(', ') || '—'}`);
    if (ps.command.length > 0) lines.push(`  reliquias: ${ps.command.map((id) => `${cardName(s, id)}(${id})`).join(', ')}`);
  }
  const stack = [...s.stack]
    .reverse()
    .map((item) => {
      const source = item.kind === 'spell' ? item.card : item.source;
      const label = item.kind === 'spell' ? cardName(s, source) : `habilidad de ${cardName(s, source)}`;
      return `${label}${plainText(targetsSuffix(s, item.targets, viewer))}`;
    })
    .join(' ← ');
  lines.push(`pila: ${stack || '—'}`);
  const pending = s.pending;
  if (pending) {
    const who = pending.kind === 'gameOver' ? '' : ` (${s.players[pending.player].name})`;
    lines.push(`esperando: ${pending.kind}${who}`);
  }
  return lines.join('\n');
}
