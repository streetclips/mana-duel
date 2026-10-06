import {
  activatedText,
  cardSummary,
  describeEvent,
  formatPump,
  getCard,
  getCardDef,
  getDeck,
  getKeywords,
  getPower,
  getToughness,
  hasDeck,
  isCreature,
  isPlayerTarget,
  keywordName,
  localizeDeck,
  manaSources,
  opponent,
  rulesText,
  stackItemSource,
  stepName,
  triggerText,
  type CardId,
  type DeckDef,
  type DeckSpec,
  type GameState,
  type PlayerId,
  type StackItem,
  type Target,
} from '../engine';
import { getLocale } from '../i18n';
import { viewText } from './text/view';

export type Side = 'you' | 'opponent';

export interface CardRefView {
  id: CardId;
  name: string;
}

export interface LandView extends CardRefView {
  tapped?: true;
}

export interface CreatureView extends CardRefView {
  token?: true;
  power: number;
  toughness: number;
  keywords?: string[];
  plusOneCounters?: number;
  untilEndOfTurn?: string;
  damage?: number;
  tapped?: true;
  summoningSick?: true;
  attacking?: true;
  blockedBy?: CardId[];
  blocking?: CardId;
}

export interface SideView {
  life: number;
  libraryCards: number;
  handSize: number;
  hand?: CardRefView[];
  lands: LandView[];
  creatures: CreatureView[];
  graveyard: string[];
  relics?: CardRefView[];
  availableMana: string[];
  landsPlayedThisTurn: number;
  extraLandsThisTurn?: number;
  damagedThisTurn?: true;
  mulligans: number;
}

export interface StackEntryView extends CardRefView {
  kind: string;
  controller: Side;
  text?: string;
  targets: string[];
}

export interface PlayerView {
  turn: number;
  step: string;
  activePlayer: Side;
  startingPlayer: Side;
  you: SideView;
  opponent: SideView;
  stack: StackEntryView[];
}

export function sideOf(viewer: PlayerId, player: PlayerId): Side {
  return player === viewer ? 'you' : 'opponent';
}

function isPublic(s: GameState, id: CardId): boolean {
  const zone = s.cards[id]?.zone;
  return zone === 'battlefield' || zone === 'graveyard' || zone === 'stack' || zone === 'command';
}

function visibleTo(s: GameState, id: CardId, viewer: PlayerId): boolean {
  const card = s.cards[id];
  if (!card) return false;
  return isPublic(s, id) || (card.zone === 'hand' && card.owner === viewer);
}

export function cardLabel(s: GameState, id: CardId, viewer: PlayerId): string {
  const text = viewText();
  if (!visibleTo(s, id, viewer)) return text.goneCard;
  const card = getCard(s, id);
  const name = getCardDef(card.def).name;
  const mine = card.controller === viewer;
  if (card.zone === 'stack') return mine ? text.yourSpell(name, id) : text.opponentSpell(name, id);
  return mine ? text.yours(name, id) : text.opponents(name, id);
}

export function targetLabel(s: GameState, target: Target, viewer: PlayerId): string {
  if (isPlayerTarget(target)) return target.player === viewer ? viewText().you : viewText().opponent;
  return cardLabel(s, target.card, viewer);
}

function creatureView(s: GameState, id: CardId): CreatureView {
  const card = getCard(s, id);
  const def = getCardDef(card.def);
  const view: CreatureView = { id, name: def.name, power: getPower(s, id), toughness: getToughness(s, id) };
  if (def.token) view.token = true;
  const keywords = getKeywords(s, id);
  if (keywords.length > 0) view.keywords = keywords.map((keyword) => keywordName(keyword));
  if (card.counters > 0) view.plusOneCounters = card.counters;
  const pumps = s.effects.filter((effect) => effect.card === id);
  if (pumps.length > 0) {
    const power = pumps.reduce((sum, effect) => sum + effect.power, 0);
    const toughness = pumps.reduce((sum, effect) => sum + effect.toughness, 0);
    const granted = [...new Set(pumps.flatMap((effect) => effect.keywords ?? []))];
    view.untilEndOfTurn = formatPump(power, toughness, granted);
  }
  if (card.damage > 0) view.damage = card.damage;
  if (card.tapped) view.tapped = true;
  if (card.summoningSick) view.summoningSick = true;
  const combat = s.combat;
  if (combat?.attackers.includes(id)) {
    view.attacking = true;
    const blockers = combat.blocks.filter((block) => block.attacker === id).map((block) => block.blocker);
    if (blockers.length > 0) view.blockedBy = blockers;
  }
  const blocking = combat?.blocks.find((block) => block.blocker === id);
  if (blocking) view.blocking = blocking.attacker;
  return view;
}

function sideView(s: GameState, player: PlayerId, viewer: PlayerId): SideView {
  const ps = s.players[player];
  const name = (id: CardId): string => getCardDef(getCard(s, id).def).name;
  const view: SideView = {
    life: ps.life,
    libraryCards: ps.library.length,
    handSize: ps.hand.length,
    lands: ps.battlefield
      .filter((id) => !isCreature(s, id))
      .map((id) => (getCard(s, id).tapped ? { id, name: name(id), tapped: true } : { id, name: name(id) })),
    creatures: ps.battlefield.filter((id) => isCreature(s, id)).map((id) => creatureView(s, id)),
    graveyard: ps.graveyard.map(name),
    availableMana: manaSources(s, player).map((source) => source.colors.join('/')),
    landsPlayedThisTurn: ps.landsPlayedThisTurn,
    mulligans: ps.mulligans,
  };
  if (ps.command.length > 0) view.relics = ps.command.map((id) => ({ id, name: name(id) }));
  if (ps.extraLandsThisTurn > 0) view.extraLandsThisTurn = ps.extraLandsThisTurn;
  if (ps.damagedThisTurn) view.damagedThisTurn = true;
  if (player === viewer) view.hand = ps.hand.map((id) => ({ id, name: name(id) }));
  return view;
}

function stackEntry(s: GameState, item: StackItem, viewer: PlayerId): StackEntryView {
  const source = stackItemSource(item);
  const def = getCardDef(getCard(s, source).def);
  const entry: StackEntryView = {
    id: source,
    name: def.name,
    kind: viewText().stackKinds[item.kind],
    controller: sideOf(viewer, item.controller),
    targets: item.targets.map((target) => targetLabel(s, target, viewer)),
  };
  if (item.kind === 'spell') entry.text = rulesText(def).join(' ');
  if (item.kind === 'trigger') entry.text = triggerText(def, item.ability);
  if (item.kind === 'activated') entry.text = activatedText(def, item.ability);
  return entry;
}

export function playerView(s: GameState, viewer: PlayerId): PlayerView {
  return {
    turn: s.turn,
    step: stepName(s.step),
    activePlayer: sideOf(viewer, s.activePlayer),
    startingPlayer: sideOf(viewer, s.startingPlayer),
    you: sideView(s, viewer, viewer),
    opponent: sideView(s, opponent(viewer), viewer),
    stack: [...s.stack].reverse().map((item) => stackEntry(s, item, viewer)),
  };
}

export function visibleCardDefs(s: GameState, viewer: PlayerId): string[] {
  const defs = new Set<string>();
  for (const id in s.cards) {
    if (visibleTo(s, id, viewer)) defs.add(getCard(s, id).def);
  }
  return [...defs];
}

export function cardGlossary(defIds: Iterable<string>): string[] {
  const unique = [...new Set(defIds)];
  return unique
    .sort((a, b) => getCardDef(a).name.localeCompare(getCardDef(b).name, getLocale()))
    .map((id) => cardSummary(id));
}

function deckOf(spec: DeckSpec): DeckDef | null {
  if (typeof spec !== 'string') return localizeDeck(spec);
  return hasDeck(spec) ? getDeck(spec) : null;
}

export function deckLine(spec: DeckSpec): string | null {
  const deck = deckOf(spec);
  if (!deck) return null;
  const cards = deck.cards.map((entry) => `${entry.count} ${getCardDef(entry.card).name}`).join(', ');
  return `${JSON.stringify(deck.name)} (${JSON.stringify(deck.description)}): ${cards}`;
}

export function deckCardDefs(spec: DeckSpec): string[] {
  return deckOf(spec)?.cards.map((entry) => entry.card) ?? [];
}

export function thoughtLine(s: GameState, viewer: PlayerId, reason: string): string {
  if (s.step === 'mulligan') return `${stepName('mulligan')}: ${reason}`;
  return viewText().thought(s.turn, s.activePlayer === viewer, stepName(s.step), reason);
}

export function eventLines(s: GameState, viewer: PlayerId): string[] {
  const lines: string[] = [];
  for (const event of s.events) {
    if (event.t === 'draw' && s.turn === 0) continue;
    const text = describeEvent(s, event, viewer);
    if (text) lines.push(text);
  }
  return lines;
}
