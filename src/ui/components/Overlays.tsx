import { useEffect, useRef } from 'preact/hooks';
import {
  KEYWORD_NAMES,
  KEYWORD_REMINDERS,
  castBlocker,
  getCardDef,
  hasKeyword,
  landPlayError,
  rulesText,
  typeLine,
  type Action,
  type CardId,
  type GameState,
  type PlayerId,
} from '../../engine';
import type { LogEntry } from '../../app/controller';
import { effectHint } from '../cardInfo';
import { DetailCard, RulesLine } from './Card';

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
    const cost = [ability.cost, ability.tap ? '{T}' : ''].filter(Boolean).join(', ');
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

export function CardSheet({ s, id, human, actions, onAction, onClose }: CardSheetProps) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const buttons = distinctActions(actions);
  const hidden = card.zone === 'hand' && card.owner !== human;
  const statuses: { text: string; tone?: 'good' | 'bad' }[] = [];
  if (card.zone === 'battlefield') {
    if (card.tapped) statuses.push({ text: 'Tapped' });
    if (card.summoningSick && def.types.includes('creature') && !hasKeyword(s, id, 'haste')) {
      statuses.push({ text: 'Summoning sick' });
    }
    if (card.damage > 0) statuses.push({ text: `${card.damage} damage`, tone: 'bad' });
    const pumps = s.effects.filter((effect) => effect.card === id);
    for (const pump of pumps) statuses.push({ text: `+${pump.power}/+${pump.toughness} this turn`, tone: 'good' });
    if (card.controller !== human) statuses.push({ text: `${s.players[card.controller].name}'s` });
  }
  const note = buttons.length === 0 ? whyNot(s, id, human) : null;
  return (
    <div class="scrim" onClick={onClose} data-testid="card-sheet">
      <div class="sheet" onClick={(event) => event.stopPropagation()} role="dialog" aria-label={hidden ? 'Hidden card' : def.name}>
        <div class="sheet-grip" />
        <div class="detail">
          <DetailCard s={s} id={id} />
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
      </div>
    </div>
  );
}

export function LogPanel({ entries, onClose }: { entries: LogEntry[]; onClose: () => void }) {
  const list = useRef<HTMLOListElement>(null);
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
            <li key={entry.id} class={entry.event.t === 'turn' ? 'turn' : ''}>
              {entry.text}
            </li>
          ))}
        </ol>
      </aside>
    </>
  );
}

interface MenuProps {
  gameOver: boolean;
  fast: boolean;
  onNewGame: () => void;
  onConcede: () => void;
  onLog: () => void;
  onToggleSpeed: () => void;
  onHome: () => void;
  onClose: () => void;
}

export function Menu({ gameOver, fast, onNewGame, onConcede, onLog, onToggleSpeed, onHome, onClose }: MenuProps) {
  return (
    <>
      <div class="scrim clear" onClick={onClose} />
      <div class="popover" role="menu" data-testid="menu">
        <button type="button" role="menuitem" data-testid="menu-log" onClick={onLog}>
          Game log
        </button>
        <button type="button" role="menuitem" data-testid="menu-speed" onClick={onToggleSpeed}>
          AI speed: {fast ? 'fast' : 'normal'}
        </button>
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
  onLog: () => void;
  onClose: () => void;
}

export function GameOverModal({ s, human, title, detail, onNewGame, onLog, onClose }: GameOverProps) {
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
          <button type="button" class="btn secondary" onClick={onLog}>
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

export function LogIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M4 5h10M4 9h10M4 13h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  );
}
