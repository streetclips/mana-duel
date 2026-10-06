export type PlayerId = 0 | 1;
export type CardId = string;

export type Color = 'W' | 'U' | 'B' | 'R' | 'G';
export const COLORS: readonly Color[] = ['W', 'U', 'B', 'R', 'G'];

export interface ManaCost {
  generic: number;
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
}

export type CardType = 'land' | 'creature' | 'instant' | 'sorcery' | 'relic';

export type Keyword =
  | 'flying'
  | 'reach'
  | 'haste'
  | 'vigilance'
  | 'trample'
  | 'firstStrike'
  | 'doubleStrike'
  | 'deathtouch'
  | 'lifelink'
  | 'menace'
  | 'defender'
  | 'flash'
  | 'skulk'
  | 'undying'
  | 'hexproof'
  | 'evolve'
  | 'prowess';

export const KEYWORDS: readonly Keyword[] = [
  'flying',
  'reach',
  'haste',
  'vigilance',
  'trample',
  'firstStrike',
  'doubleStrike',
  'deathtouch',
  'lifelink',
  'menace',
  'defender',
  'flash',
  'skulk',
  'undying',
  'hexproof',
  'evolve',
  'prowess',
];

export type TargetSpec =
  | { kind: 'any' }
  | { kind: 'creature'; controller?: 'you' | 'opponent'; tapped?: boolean }
  | { kind: 'player'; controller?: 'you' | 'opponent' }
  | { kind: 'spell' };

export type Target = { player: PlayerId } | { card: CardId };

export type EffectTarget = number | 'self';

export type Who = 'you' | 'opponent';

export type Effect =
  | { kind: 'damage'; amount: number; to: EffectTarget }
  | { kind: 'pump'; power: number; toughness: number; to: EffectTarget; keywords?: Keyword[] }
  | { kind: 'destroy'; to: EffectTarget }
  | { kind: 'bounce'; to: EffectTarget }
  | { kind: 'counter'; to: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'gainLife'; amount: number }
  | { kind: 'loseLife'; amount: number; who?: Who }
  | { kind: 'fight'; a: EffectTarget; b: EffectTarget }
  | { kind: 'bite'; a: EffectTarget; b: EffectTarget }
  | { kind: 'pumpTeam'; power: number; toughness: number; keywords?: Keyword[] }
  | { kind: 'addCounters'; amount: number; to: EffectTarget }
  | { kind: 'addCountersTeam'; amount: number }
  | { kind: 'createTokens'; token: string; amount: number }
  | { kind: 'discard'; amount: number; who?: Who }
  | { kind: 'returnToBattlefield'; counters: number }
  | { kind: 'extraLands'; amount: number }
  | { kind: 'searchLand'; land: string; battlefield: number; hand?: number; tapped?: boolean };

export type TriggerEvent =
  | 'upkeep'
  | 'enters'
  | 'dies'
  | 'attacks'
  | 'spell'
  | 'allyEnters'
  | 'allyDies'
  | 'damagesPlayer'
  | 'lifeGain'
  | 'landfall';

export type TriggerCondition = 'opponentDamaged' | 'emptyHand';

export interface TriggeredAbility {
  on: TriggerEvent;
  condition?: TriggerCondition;
  targets: TargetSpec[];
  effects: Effect[];
}

export interface ActivatedAbility {
  cost: string;
  tap?: boolean;
  sacrifice?: boolean;
  targets: TargetSpec[];
  effects: Effect[];
}

export interface SpellAbility {
  targets: TargetSpec[];
  effects: Effect[];
}

export interface CardDef {
  id: string;
  name: string;
  types: CardType[];
  supertypes?: string[];
  subtypes?: string[];
  cost?: string;
  power?: number;
  toughness?: number;
  keywords?: Keyword[];
  mana?: Color[];
  entersTapped?: boolean;
  token?: boolean;
  colors?: Color[];
  spell?: SpellAbility;
  triggers?: TriggeredAbility[];
  activated?: ActivatedAbility[];
  flavor?: string;
}

export type Zone = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'command' | 'stack' | 'gone';

export interface CardInstance {
  id: CardId;
  def: string;
  owner: PlayerId;
  controller: PlayerId;
  zone: Zone;
  tapped: boolean;
  summoningSick: boolean;
  damage: number;
  deathtouchDamage: boolean;
  counters: number;
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  life: number;
  library: CardId[];
  hand: CardId[];
  battlefield: CardId[];
  graveyard: CardId[];
  command: CardId[];
  landsPlayedThisTurn: number;
  mulligans: number;
  kept: boolean;
  bottomed: boolean;
  drewFromEmptyLibrary: boolean;
  conceded: boolean;
  damagedThisTurn: boolean;
  extraLandsThisTurn: number;
  openingHand?: number;
  drawOnFirstTurn?: boolean;
}

export type Step =
  | 'mulligan'
  | 'untap'
  | 'upkeep'
  | 'draw'
  | 'main1'
  | 'beginCombat'
  | 'declareAttackers'
  | 'declareBlockers'
  | 'firstStrikeDamage'
  | 'combatDamage'
  | 'endCombat'
  | 'main2'
  | 'end'
  | 'cleanup';

export type StackItem =
  | { id: string; kind: 'spell'; controller: PlayerId; card: CardId; targets: Target[]; lost?: number[] }
  | {
      id: string;
      kind: 'trigger';
      controller: PlayerId;
      source: CardId;
      ability: number;
      targets: Target[];
      lost?: number[];
    }
  | {
      id: string;
      kind: 'activated';
      controller: PlayerId;
      source: CardId;
      ability: number;
      targets: Target[];
      lost?: number[];
    };

export interface ContinuousEffect {
  id: string;
  card: CardId;
  power: number;
  toughness: number;
  keywords?: Keyword[];
  until: 'endOfTurn';
}

export interface Block {
  blocker: CardId;
  attacker: CardId;
}

export interface CombatState {
  attackers: CardId[];
  blocks: Block[];
  blockersDeclared: boolean;
  blocked: CardId[];
  firstStrikers: CardId[] | null;
}

export interface PendingTrigger {
  id: string;
  controller: PlayerId;
  source: CardId;
  ability: number;
}

export type PendingDecision =
  | { kind: 'mulligan'; player: PlayerId }
  | { kind: 'bottom'; player: PlayerId; count: number }
  | { kind: 'priority'; player: PlayerId }
  | { kind: 'declareAttackers'; player: PlayerId }
  | { kind: 'declareBlockers'; player: PlayerId }
  | { kind: 'chooseTargets'; player: PlayerId; trigger: string }
  | { kind: 'discard'; player: PlayerId; count: number; source?: CardId }
  | { kind: 'gameOver'; winner: PlayerId | null; reason: GameOverReason };

export type GameOverReason = 'life' | 'decked' | 'concede' | 'turnLimit';

export type Action =
  | { type: 'keep'; player: PlayerId }
  | { type: 'mulligan'; player: PlayerId }
  | { type: 'bottom'; player: PlayerId; cards: CardId[] }
  | { type: 'pass'; player: PlayerId }
  | { type: 'playLand'; player: PlayerId; card: CardId }
  | { type: 'cast'; player: PlayerId; card: CardId; targets: Target[] }
  | { type: 'activate'; player: PlayerId; card: CardId; ability: number; targets: Target[] }
  | { type: 'declareAttackers'; player: PlayerId; attackers: CardId[] }
  | { type: 'declareBlockers'; player: PlayerId; blocks: Block[] }
  | { type: 'chooseTargets'; player: PlayerId; targets: Target[] }
  | { type: 'discard'; player: PlayerId; cards: CardId[] }
  | { type: 'concede'; player: PlayerId };

export type GameEvent =
  | { t: 'start'; startingPlayer: PlayerId }
  | { t: 'mulligan'; player: PlayerId; count: number }
  | { t: 'keep'; player: PlayerId; handSize: number }
  | { t: 'bottom'; player: PlayerId; count: number }
  | { t: 'turn'; turn: number; player: PlayerId }
  | { t: 'draw'; player: PlayerId; card: CardId }
  | { t: 'drawEmpty'; player: PlayerId }
  | { t: 'land'; player: PlayerId; card: CardId }
  | { t: 'cast'; player: PlayerId; card: CardId; targets: Target[] }
  | { t: 'activate'; player: PlayerId; card: CardId; ability: number; targets: Target[] }
  | { t: 'trigger'; player: PlayerId; card: CardId; ability: number; targets: Target[] }
  | { t: 'resolve'; item: StackItem }
  | { t: 'fizzle'; item: StackItem }
  | { t: 'counter'; card: CardId; player: PlayerId }
  | { t: 'bounce'; card: CardId; player: PlayerId }
  | { t: 'enter'; player: PlayerId; card: CardId }
  | { t: 'search'; player: PlayerId; card: CardId; to: 'battlefield' | 'hand' }
  | { t: 'extraLands'; player: PlayerId; amount: number }
  | { t: 'create'; player: PlayerId; card: CardId }
  | { t: 'return'; player: PlayerId; card: CardId }
  | { t: 'attack'; player: PlayerId; attackers: CardId[] }
  | { t: 'block'; player: PlayerId; blocks: Block[] }
  | { t: 'damage'; source: CardId; target: Target; amount: number; combat: boolean }
  | { t: 'life'; player: PlayerId; delta: number; life: number }
  | { t: 'loseLife'; player: PlayerId; amount: number }
  | { t: 'pump'; card: CardId; power: number; toughness: number; keywords?: Keyword[] }
  | { t: 'addCounters'; card: CardId; amount: number }
  | { t: 'fight'; a: CardId; b: CardId }
  | { t: 'bite'; a: CardId; b: CardId }
  | { t: 'dies'; card: CardId; player: PlayerId }
  | { t: 'discard'; player: PlayerId; card: CardId }
  | { t: 'concede'; player: PlayerId }
  | { t: 'gameOver'; winner: PlayerId | null; reason: GameOverReason };

export interface GameState {
  seed: number;
  rng: number;
  nextId: number;
  turn: number;
  activePlayer: PlayerId;
  startingPlayer: PlayerId;
  step: Step;
  stepStarted: boolean;
  priority: PlayerId | null;
  passes: number;
  players: [PlayerState, PlayerState];
  cards: Record<CardId, CardInstance>;
  stack: StackItem[];
  effects: ContinuousEffect[];
  combat: CombatState | null;
  triggers: PendingTrigger[];
  pending: PendingDecision | null;
  events: GameEvent[];
  actionCount: number;
  turnLimit: number;
}
