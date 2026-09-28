import {
  KEYWORD_NAMES,
  STEP_NAMES,
  activatedText,
  cardSummary,
  describeEvent,
  formatModifier,
  getCard,
  getCardDef,
  getDeck,
  getKeywords,
  getPower,
  getToughness,
  hasDeck,
  isCreature,
  isPlayerTarget,
  manaSources,
  opponent,
  rulesText,
  stackItemSource,
  triggerText,
  type CardId,
  type GameState,
  type PlayerId,
  type StackItem,
  type Target,
} from '../engine';

export type Side = 'you' | 'opponent';

export interface CardRefView {
  id: CardId;
  name: string;
}

export interface LandView extends CardRefView {
  tapped?: true;
}

export interface CreatureView extends CardRefView {
  power: number;
  toughness: number;
  keywords?: string[];
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
  availableMana: string[];
  landsPlayedThisTurn: number;
  mulligans: number;
}

export interface StackEntryView extends CardRefView {
  kind: 'spell' | 'triggered ability' | 'activated ability';
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
  return zone === 'battlefield' || zone === 'graveyard' || zone === 'stack';
}

function visibleTo(s: GameState, id: CardId, viewer: PlayerId): boolean {
  const card = s.cards[id];
  if (!card) return false;
  return isPublic(s, id) || (card.zone === 'hand' && card.owner === viewer);
}

export function cardLabel(s: GameState, id: CardId, viewer: PlayerId): string {
  if (!visibleTo(s, id, viewer)) return 'a card that is no longer in play';
  const card = getCard(s, id);
  const name = getCardDef(card.def).name;
  if (card.zone === 'stack') return `${card.controller === viewer ? 'your' : "opponent's"} spell ${name} (${id})`;
  return `${card.controller === viewer ? 'your' : "opponent's"} ${name} (${id})`;
}

export function targetLabel(s: GameState, target: Target, viewer: PlayerId): string {
  if (isPlayerTarget(target)) return target.player === viewer ? 'you' : 'opponent';
  return cardLabel(s, target.card, viewer);
}

function creatureView(s: GameState, id: CardId): CreatureView {
  const card = getCard(s, id);
  const view: CreatureView = { id, name: getCardDef(card.def).name, power: getPower(s, id), toughness: getToughness(s, id) };
  const keywords = getKeywords(s, id);
  if (keywords.length > 0) view.keywords = keywords.map((keyword) => KEYWORD_NAMES[keyword]);
  const pumps = s.effects.filter((effect) => effect.card === id);
  if (pumps.length > 0) {
    const power = pumps.reduce((sum, effect) => sum + effect.power, 0);
    const toughness = pumps.reduce((sum, effect) => sum + effect.toughness, 0);
    view.untilEndOfTurn = formatModifier(power, toughness);
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
  if (player === viewer) view.hand = ps.hand.map((id) => ({ id, name: name(id) }));
  return view;
}

function stackEntry(s: GameState, item: StackItem, viewer: PlayerId): StackEntryView {
  const source = stackItemSource(item);
  const def = getCardDef(getCard(s, source).def);
  const entry: StackEntryView = {
    id: source,
    name: def.name,
    kind: item.kind === 'spell' ? 'spell' : item.kind === 'trigger' ? 'triggered ability' : 'activated ability',
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
    step: STEP_NAMES[s.step],
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
  return unique.sort((a, b) => getCardDef(a).name.localeCompare(getCardDef(b).name)).map((id) => cardSummary(id));
}

export function deckLine(deckId: string): string | null {
  if (!hasDeck(deckId)) return null;
  const deck = getDeck(deckId);
  const cards = deck.cards.map((entry) => `${entry.count} ${getCardDef(entry.card).name}`).join(', ');
  return `${deck.name} (${deck.description}): ${cards}`;
}

export function deckCardDefs(deckId: string): string[] {
  return hasDeck(deckId) ? getDeck(deckId).cards.map((entry) => entry.card) : [];
}

function withSeatNames(s: GameState, viewer: PlayerId): GameState {
  const players = s.players.map((player) => ({ ...player, name: player.id === viewer ? 'You' : 'Opponent' }));
  return { ...s, players: players as GameState['players'] };
}

export function thoughtLine(s: GameState, viewer: PlayerId, reason: string): string {
  if (s.step === 'mulligan') return `${STEP_NAMES.mulligan}: ${reason}`;
  return `Turn ${s.turn} (${s.activePlayer === viewer ? 'your' : "opponent's"} turn), ${STEP_NAMES[s.step]}: ${reason}`;
}

export function eventLines(s: GameState, viewer: PlayerId): string[] {
  const named = withSeatNames(s, viewer);
  const lines: string[] = [];
  for (const event of s.events) {
    if (event.t === 'draw' && s.turn === 0) continue;
    const text = describeEvent(named, event, viewer);
    if (text) lines.push(text);
  }
  return lines;
}
