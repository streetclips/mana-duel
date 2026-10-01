import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  KEYWORD_NAMES,
  KEYWORD_REMINDERS,
  castBlocker,
  countersLabel,
  formatPump,
  getCardDef,
  hasKeyword,
  landPlayError,
  rulesText,
  typeLine,
  type Action,
  type CardDef,
  type CardId,
  type CardInstance,
  type GameState,
  type PlayerId,
} from '../../engine';
import type { LogEntry } from '../../app/controller';
import { effectHint } from '../cardInfo';
import { DetailCard, RulesLine } from './Card';
import type { AudioToggles } from './SoundToggles';

interface SheetProps {
  label: string;
  raised?: boolean;
  onClose: () => void;
  children: ComponentChildren;
}

export function Sheet({ label, raised = false, onClose, children }: SheetProps) {
  return (
    <div class={`scrim${raised ? ' raised' : ''}`} onClick={onClose} data-testid="card-sheet">
      <div class="sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={label}>
        <div class="sheet-grip" />
        {children}
      </div>
    </div>
  );
}

export interface Status {
  text: string;
  tone?: 'good' | 'bad';
}

export function CardDetail({ def, face, statuses = [] }: { def: CardDef; face: ComponentChildren; statuses?: Status[] }) {
  return (
    <div class="detail">
      {face}
      <div class="detail-info">
        <h3>{def.name}</h3>
        <div class="type-line">{typeLine(def)}</div>
        {rulesText(def).map((line) => (
          <p key={line}>
            <RulesLine text={line} />
          </p>
        ))}
        {(def.keywords ?? []).map((keyword) => (
          <p key={keyword} class="reminder">
            <b>{KEYWORD_NAMES[keyword]}:</b> {KEYWORD_REMINDERS[keyword]}
          </p>
        ))}
        {def.flavor && <p class="flavor">{def.flavor}</p>}
        {statuses.length > 0 && (
          <div class="status">
            {statuses.map((status) => (
              <span key={status.text} class={`tag${status.tone ? ` ${status.tone}` : ''}`}>
                {status.text}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CardSheetProps {
  s: GameState;
  id: CardId;
  human: PlayerId;
  actions: Action[];
  onAction: (action: Action) => void;
  onClose: () => void;
}

function actionLabel(s: GameState, action: Action): string {
  if (action.type === 'playLand') return `Play ${getCardDef(s.cards[action.card]?.def ?? '').name}`;
  if (action.type === 'cast') return `Cast ${getCardDef(s.cards[action.card]?.def ?? '').name}`;
  if (action.type === 'activate') {
    const ability = getCardDef(s.cards[action.card]?.def ?? '').activated?.[action.ability];
    if (!ability) return 'Activate';
    const cost = [ability.cost === '{0}' ? '' : ability.cost, ability.tap ? '{T}' : '', ability.sacrifice ? 'Sacrifice' : '']
      .filter(Boolean)
      .join(', ');
    return `Activate ${cost}: ${ability.effects.map(effectHint).join(', ')}`;
  }
  return action.type;
}

function distinctActions(actions: Action[]): Action[] {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.type === 'activate' ? `activate:${action.ability}` : action.type;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function whyNot(s: GameState, id: CardId, human: PlayerId): string | null {
  const card = s.cards[id];
  if (!card) return null;
  if (card.zone !== 'hand' || card.owner !== human) return null;
  const def = getCardDef(card.def);
  const reason = def.types.includes('land') ? landPlayError(s, human, id) : castBlocker(s, human, id);
  if (!reason) return def.types.includes('land') ? null : 'No legal targets right now';
  return reason.charAt(0).toUpperCase() + reason.slice(1);
}

function battlefieldStatuses(s: GameState, id: CardId, human: PlayerId): Status[] {
  const card = s.cards[id];
  if (card?.zone !== 'battlefield') return [];
  const def = getCardDef(card.def);
  const statuses: Status[] = [];
  if (card.tapped) statuses.push({ text: 'Tapped' });
  if (card.summoningSick && def.types.includes('creature') && !hasKeyword(s, id, 'haste')) {
    statuses.push({ text: 'Summoning sick' });
  }
  if (card.damage > 0) statuses.push({ text: `${card.damage} damage`, tone: 'bad' });
  if (card.counters > 0) statuses.push({ text: countersLabel(card.counters), tone: 'good' });
  const pumps = s.effects.filter((effect) => effect.card === id);
  for (const pump of pumps) {
    const tone = pump.power < 0 || pump.toughness < 0 ? 'bad' : 'good';
    statuses.push({ text: `${formatPump(pump.power, pump.toughness, pump.keywords)} this turn`, tone });
  }
  if (card.controller !== human) statuses.push({ text: `${s.players[card.controller].name}'s` });
  return statuses;
}

function zoneLabel(s: GameState, card: CardInstance, human: PlayerId): string {
  const whose = card.owner === human ? 'your' : `${s.players[card.owner].name}'s`;
  switch (card.zone) {
    case 'library':
      return `In ${whose} library`;
    case 'hand':
      return `In ${whose} hand`;
    case 'battlefield':
      return 'On the battlefield';
    case 'graveyard':
      return `In ${whose} graveyard`;
    case 'stack':
      return 'On the stack';
    case 'gone':
      return 'No longer in play';
  }
}

export function CardSheet({ s, id, human, actions, onAction, onClose }: CardSheetProps) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const buttons = distinctActions(actions);
  const hidden = card.zone === 'hand' && card.owner !== human;
  const statuses: Status[] = [...(card.zone === 'stack' ? [{ text: 'On the stack' }] : []), ...battlefieldStatuses(s, id, human)];
  const note = buttons.length === 0 ? whyNot(s, id, human) : null;
  return (
    <Sheet label={hidden ? 'Hidden card' : def.name} onClose={onClose}>
      <CardDetail def={def} face={<DetailCard s={s} id={id} />} statuses={statuses} />
      {buttons.length > 0 && (
        <div class="sheet-actions">
          {buttons.map((action) => (
            <button
              key={action.type === 'activate' ? `a${action.ability}` : action.type}
              type="button"
              class="btn"
              data-testid={`sheet-${action.type}`}
              onClick={() => onAction(action)}
            >
              <RulesLine text={actionLabel(s, action)} />
            </button>
          ))}
        </div>
      )}
      {note && <div class="sheet-note">{note}</div>}
    </Sheet>
  );
}

function LogCardSheet({ s, id, human, onClose }: { s: GameState; id: CardId; human: PlayerId; onClose: () => void }) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const statuses: Status[] = [{ text: zoneLabel(s, card, human) }, ...battlefieldStatuses(s, id, human)];
  return (
    <Sheet label={def.name} raised onClose={onClose}>
      <CardDetail def={def} face={<DetailCard s={s} id={id} />} statuses={statuses} />
    </Sheet>
  );
}

interface LogPanelProps {
  s: GameState;
  human: PlayerId;
  entries: LogEntry[];
  onClose: () => void;
}

export function LogPanel({ s, human, entries, onClose }: LogPanelProps) {
  const list = useRef<HTMLOListElement>(null);
  const [card, setCard] = useState<CardId | null>(null);
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [entries.length]);
  return (
    <>
      <div class="scrim clear" onClick={onClose} />
      <aside class="log-panel" data-testid="log-panel" aria-label="Game log">
        <header>
          <h2>Game log</h2>
          <button type="button" class="icon-btn" aria-label="Close log" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>
        <ol class="log-list" ref={list}>
          {entries.map((entry) => (
            <li key={entry.id} class={entry.event ? (entry.event.t === 'turn' ? 'turn' : '') : 'note'}>
              {entry.parts.map((part, index) =>
                typeof part === 'string' ? (
                  part
                ) : (
                  <button key={index} type="button" class="log-card" data-testid={`log-card-${part.card}`} onClick={() => setCard(part.card)}>
                    {part.name}
                  </button>
                ),
              )}
            </li>
          ))}
        </ol>
      </aside>
      {card && <LogCardSheet s={s} id={card} human={human} onClose={() => setCard(null)} />}
    </>
  );
}

interface MenuProps {
  gameOver: boolean;
  fast: boolean;
  autoPass: boolean;
  audio?: AudioToggles;
  onNewGame: () => void;
  onConcede: () => void;
  onLog: () => void;
  onDecks?: () => void;
  onToggleSpeed: () => void;
  onToggleAutoPass: () => void;
  onHome: () => void;
  onClose: () => void;
}

export function Menu({ gameOver, fast, autoPass, audio, onNewGame, onConcede, onLog, onDecks, onToggleSpeed, onToggleAutoPass, onHome, onClose }: MenuProps) {
  return (
    <>
      <div class="scrim clear" onClick={onClose} />
      <div class="popover" role="menu" data-testid="menu">
        <button type="button" role="menuitem" data-testid="menu-log" onClick={onLog}>
          Game log
        </button>
        {onDecks && (
          <button type="button" role="menuitem" data-testid="menu-decks" onClick={onDecks}>
            Decks
          </button>
        )}
        <button type="button" role="menuitem" data-testid="menu-speed" onClick={onToggleSpeed}>
          AI speed: {fast ? 'fast' : 'normal'}
        </button>
        <button type="button" role="menuitemcheckbox" aria-checked={autoPass} data-testid="menu-autopass" onClick={onToggleAutoPass}>
          Auto-pass: {autoPass ? 'on' : 'off'}
        </button>
        {audio && (
          <>
            <button type="button" role="menuitemcheckbox" aria-checked={audio.music} data-testid="menu-music" onClick={audio.onToggleMusic}>
              Music: {audio.music ? 'on' : 'off'}
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={audio.sfx} data-testid="menu-sfx" onClick={audio.onToggleSfx}>
              Sound effects: {audio.sfx ? 'on' : 'off'}
            </button>
          </>
        )}
        <button type="button" role="menuitem" data-testid="menu-new-game" onClick={onNewGame}>
          New game
        </button>
        <button type="button" role="menuitem" data-testid="menu-home" onClick={onHome}>
          Main menu
        </button>
        {!gameOver && (
          <button type="button" role="menuitem" class="danger" data-testid="menu-concede" onClick={onConcede}>
            Concede
          </button>
        )}
      </div>
    </>
  );
}

interface GameOverProps {
  s: GameState;
  human: PlayerId;
  title: string;
  detail?: string;
  onNewGame: () => void;
  onHome: () => void;
  onLog: () => void;
  onClose: () => void;
}

export function GameOverModal({ s, human, title, detail, onNewGame, onHome, onLog, onClose }: GameOverProps) {
  const opponent: PlayerId = human === 0 ? 1 : 0;
  return (
    <div class="scrim center-modal" data-testid="game-over" onClick={onClose}>
      <div class="modal" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2 data-testid="game-over-title">{title}</h2>
        {detail && <p>{detail}</p>}
        <div class="stats">
          <span>
            <b class="num">{s.turn}</b>
            {s.turn === 1 ? 'turn' : 'turns'}
          </span>
          <span>
            <b class="num">{s.players[human].life}</b>your life
          </span>
          <span>
            <b class="num">{s.players[opponent].life}</b>
            {s.players[opponent].name} life
          </span>
        </div>
        <div class="sheet-actions">
          <button type="button" class="btn" data-testid="btn-play-again" onClick={onNewGame}>
            Play again
          </button>
          <button type="button" class="btn secondary" data-testid="btn-home" onClick={onHome}>
            Main menu
          </button>
          <button type="button" class="btn secondary" data-testid="btn-view-log" onClick={onLog}>
            View log
          </button>
        </div>
      </div>
    </div>
  );
}

export function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="4" cy="9" r="1.6" fill="currentColor" />
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
      <circle cx="14" cy="9" r="1.6" fill="currentColor" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}
