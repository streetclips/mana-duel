import { useEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import {
  castBlocker,
  countersLabel,
  formatPump,
  getCardDef,
  hasKeyword,
  keywordName,
  keywordReminder,
  landPlayError,
  refusalText,
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
import { cardText } from '../text/card';
import { gameText } from '../text/game';
import { DetailCard, DetailFace, RulesLine } from './Card';
import type { AudioToggles } from './SoundToggles';

interface SheetProps {
  label: string;
  raised?: boolean;
  testId?: string;
  onClose: () => void;
  children: ComponentChildren;
}

export function Sheet({ label, raised = false, testId = 'card-sheet', onClose, children }: SheetProps) {
  return (
    <div class={`scrim${raised ? ' raised' : ''}`} onClick={onClose} data-testid={testId}>
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
            <b>{keywordName(keyword)}:</b> {keywordReminder(keyword)}
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

interface CardDefSheetProps {
  def: CardDef;
  statuses?: Status[];
  raised?: boolean;
  onClose: () => void;
  children?: ComponentChildren;
}

export function CardDefSheet({ def, statuses, raised, onClose, children }: CardDefSheetProps) {
  return (
    <Sheet label={def.name} raised={raised} onClose={onClose}>
      <CardDetail def={def} face={<DetailFace def={def} />} statuses={statuses} />
      {children}
    </Sheet>
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
  const text = cardText().actions;
  if (action.type === 'playLand') return text.play(getCardDef(s.cards[action.card]?.def ?? '').name);
  if (action.type === 'cast') return text.cast(getCardDef(s.cards[action.card]?.def ?? '').name);
  if (action.type === 'activate') {
    const ability = getCardDef(s.cards[action.card]?.def ?? '').activated?.[action.ability];
    if (!ability) return text.activate;
    const cost = [ability.cost === '{0}' ? '' : ability.cost, ability.tap ? '{T}' : '', ability.sacrifice ? text.sacrifice : '']
      .filter(Boolean)
      .join(', ');
    return text.activateWith(cost, ability.effects.map(effectHint).join(', '));
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
  if (!reason) return def.types.includes('land') ? null : cardText().noLegalTargets;
  const text = refusalText(reason);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function battlefieldStatuses(s: GameState, id: CardId, human: PlayerId): Status[] {
  const card = s.cards[id];
  if (card?.zone !== 'battlefield') return [];
  const def = getCardDef(card.def);
  const text = cardText();
  const statuses: Status[] = [];
  if (card.tapped) statuses.push({ text: text.statuses.tapped });
  if (card.summoningSick && def.types.includes('creature') && !hasKeyword(s, id, 'haste')) {
    statuses.push({ text: text.summoningSickness });
  }
  if (card.damage > 0) statuses.push({ text: text.statuses.damage(card.damage), tone: 'bad' });
  if (card.counters > 0) statuses.push({ text: countersLabel(card.counters), tone: 'good' });
  const pumps = s.effects.filter((effect) => effect.card === id);
  for (const pump of pumps) {
    const tone = pump.power < 0 || pump.toughness < 0 ? 'bad' : 'good';
    statuses.push({ text: text.statuses.thisTurn(formatPump(pump.power, pump.toughness, pump.keywords)), tone });
  }
  if (card.controller !== human) statuses.push({ text: text.statuses.opponents });
  return statuses;
}

function zoneLabel(card: CardInstance, human: PlayerId): string {
  const mine = card.owner === human;
  const text = cardText();
  switch (card.zone) {
    case 'library':
      return text.zones.library(mine);
    case 'hand':
      return text.zones.hand(mine);
    case 'battlefield':
      return text.zones.battlefield;
    case 'graveyard':
      return text.zones.graveyard(mine);
    case 'command':
      return text.relic(mine);
    case 'stack':
      return text.zones.stack;
    case 'gone':
      return text.zones.gone;
  }
}

export function CardSheet({ s, id, human, actions, onAction, onClose }: CardSheetProps) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const buttons = distinctActions(actions);
  const hidden = card.zone === 'hand' && card.owner !== human;
  const statuses: Status[] = [
    ...(card.zone === 'stack' ? [{ text: cardText().zones.stack }] : []),
    ...(card.zone === 'command' ? [{ text: zoneLabel(card, human) }] : []),
    ...battlefieldStatuses(s, id, human),
  ];
  const note = buttons.length === 0 ? whyNot(s, id, human) : null;
  return (
    <Sheet label={hidden ? cardText().hiddenCard : def.name} onClose={onClose}>
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
  const statuses: Status[] = [{ text: zoneLabel(card, human) }, ...battlefieldStatuses(s, id, human)];
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
  const text = gameText();
  return (
    <>
      <div class="scrim clear" onClick={onClose} />
      <aside class="log-panel" data-testid="log-panel" aria-label={text.log}>
        <header>
          <h2>{text.log}</h2>
          <button type="button" class="icon-btn" aria-label={text.closeLog} onClick={onClose}>
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
  onNewGame?: () => void;
  onConcede: () => void;
  onLog: () => void;
  onDecks?: () => void;
  onToggleSpeed: () => void;
  onToggleAutoPass: () => void;
  onHome: () => void;
  homeLabel?: string;
  onClose: () => void;
}

export function Menu({
  gameOver,
  fast,
  autoPass,
  audio,
  onNewGame,
  onConcede,
  onLog,
  onDecks,
  onToggleSpeed,
  onToggleAutoPass,
  onHome,
  homeLabel,
  onClose,
}: MenuProps) {
  const text = gameText();
  return (
    <>
      <div class="scrim clear" onClick={onClose} />
      <div class="popover" role="menu" data-testid="menu">
        <button type="button" role="menuitem" data-testid="menu-log" onClick={onLog}>
          {text.log}
        </button>
        {onDecks && (
          <button type="button" role="menuitem" data-testid="menu-decks" onClick={onDecks}>
            {text.decks}
          </button>
        )}
        <button type="button" role="menuitem" data-testid="menu-speed" onClick={onToggleSpeed}>
          {text.aiSpeed(fast)}
        </button>
        <button type="button" role="menuitemcheckbox" aria-checked={autoPass} data-testid="menu-autopass" onClick={onToggleAutoPass}>
          {text.autoPass(autoPass)}
        </button>
        {audio && (
          <>
            <button type="button" role="menuitemcheckbox" aria-checked={audio.music} data-testid="menu-music" onClick={audio.onToggleMusic}>
              {text.music(audio.music)}
            </button>
            <button type="button" role="menuitemcheckbox" aria-checked={audio.sfx} data-testid="menu-sfx" onClick={audio.onToggleSfx}>
              {text.sfx(audio.sfx)}
            </button>
          </>
        )}
        {onNewGame && (
          <button type="button" role="menuitem" data-testid="menu-new-game" onClick={onNewGame}>
            {text.newGame}
          </button>
        )}
        <button type="button" role="menuitem" data-testid="menu-home" onClick={onHome}>
          {homeLabel ?? text.home}
        </button>
        {!gameOver && (
          <button type="button" role="menuitem" class="danger" data-testid="menu-concede" onClick={onConcede}>
            {text.concede}
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
  continueLabel?: string;
  onContinue?: () => void;
  onLog: () => void;
  onClose: () => void;
}

export function GameOverModal({ s, human, title, detail, onNewGame, onHome, continueLabel, onContinue, onLog, onClose }: GameOverProps) {
  const opponent: PlayerId = human === 0 ? 1 : 0;
  const text = gameText();
  return (
    <div class="scrim center-modal" data-testid="game-over" onClick={onClose}>
      <div class="modal" role="dialog" aria-label={title} onClick={(event) => event.stopPropagation()}>
        <h2 data-testid="game-over-title">{title}</h2>
        {detail && <p>{detail}</p>}
        <div class="stats">
          <span>
            <b class="num">{s.turn}</b>
            {text.turns(s.turn)}
          </span>
          <span>
            <b class="num">{s.players[human].life}</b>
            {text.yourLife}
          </span>
          <span>
            <b class="num">{s.players[opponent].life}</b>
            {text.opponentLife}
          </span>
        </div>
        <div class="sheet-actions">
          {onContinue ? (
            <button type="button" class="btn" data-testid="btn-mode-continue" onClick={onContinue}>
              {continueLabel}
            </button>
          ) : (
            <>
              <button type="button" class="btn" data-testid="btn-play-again" onClick={onNewGame}>
                {text.playAgain}
              </button>
              <button type="button" class="btn secondary" data-testid="btn-home" onClick={onHome}>
                {text.home}
              </button>
            </>
          )}
          <button type="button" class="btn secondary" data-testid="btn-view-log" onClick={onLog}>
            {text.viewLog}
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
