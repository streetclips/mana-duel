import {
  STEP_NAMES,
  cardName,
  getCardDef,
  isLand,
  stackItemSource,
  targetRef,
  type CardId,
  type GameState,
  type PlayerId,
  type Step,
} from '../../engine';
import { cardColorVar, cssVars } from '../cardInfo';
import type { BarModel, UiButton, UiCommand } from '../model';

interface PlayerBarProps {
  s: GameState;
  player: PlayerId;
  human: PlayerId;
  deckName?: string;
  targetable: boolean;
  lifeFx?: { key: number; text: string; kind: 'minus' | 'plus' };
  onTap: () => void;
}

export function PlayerBar({ s, player, human, deckName, targetable, lifeFx, onTap }: PlayerBarProps) {
  const ps = s.players[player];
  const hasPriority = s.pending?.kind === 'priority' && s.pending.player === player;
  const label = `${ps.name}: ${ps.life} life, ${ps.hand.length} cards in hand, ${ps.library.length} in library, ${ps.graveyard.length} in graveyard`;
  return (
    <div class="player-bar">
      <button
        type="button"
        class={`player-chip${targetable ? ' targetable' : ''}`}
        data-testid={`player-${player}`}
        data-targetable={targetable ? 'true' : undefined}
        aria-label={targetable ? `Target ${ps.name}` : label}
        onClick={onTap}
      >
        <span class="avatar" aria-hidden="true">
          {player === human ? 'You' : ps.name.slice(0, 2)}
        </span>
        <span class={`life num${ps.life <= 5 ? ' low' : ''}`} data-testid={`life-${player}`}>
          {ps.life}
          {lifeFx && (
            <span key={lifeFx.key} class={`float ${lifeFx.kind}`}>
              {lifeFx.text}
            </span>
          )}
        </span>
        <span class="player-meta">
          <b>
            {ps.name}
            {deckName && (
              <span class="deck-name" data-testid={`deck-name-${player}`}>
                {' '}
                · {deckName}
              </span>
            )}
          </b>
          <span class="num" data-testid={`counts-${player}`}>
            Hand {ps.hand.length} · Deck {ps.library.length} · Grave {ps.graveyard.length}
          </span>
        </span>
      </button>
      <span class="spacer" />
      {hasPriority && <span class="priority-dot" title="Has priority" aria-label="Has priority" />}
    </div>
  );
}

export function Lands({ s, player }: { s: GameState; player: PlayerId }) {
  const lands = s.players[player].battlefield.filter((id) => isLand(s, id));
  const untapped = lands.filter((id) => !s.cards[id]?.tapped).length;
  return (
    <div class="lands" data-testid={`lands-${player}`} aria-label={`${untapped} of ${lands.length} lands untapped`}>
      {lands.length === 0 && <span class="empty">No lands</span>}
      {lands.map((id) => {
        const def = getCardDef(s.cards[id]?.def ?? '');
        return (
          <span
            key={id}
            class={`land-pip${s.cards[id]?.tapped ? ' tapped' : ''}`}
            style={cssVars({ '--pip': cardColorVar(def) })}
            data-color={(def.mana ?? []).join('')}
            title={`${def.name}${s.cards[id]?.tapped ? ' (tapped)' : ''}`}
            data-testid={`card-${id}`}
            data-card={id}
            data-def={def.id}
            data-zone="battlefield"
            data-tapped={s.cards[id]?.tapped ? 'true' : 'false'}
          >
            {(def.mana ?? []).join('')}
          </span>
        );
      })}
    </div>
  );
}

const PHASES: { label: string; steps: Step[] }[] = [
  { label: 'Beginning', steps: ['untap', 'upkeep', 'draw'] },
  { label: 'Main', steps: ['main1'] },
  { label: 'Combat', steps: ['beginCombat', 'declareAttackers', 'declareBlockers', 'firstStrikeDamage', 'combatDamage', 'endCombat'] },
  { label: 'Main 2', steps: ['main2'] },
  { label: 'End', steps: ['end', 'cleanup'] },
];

interface CenterStripProps {
  s: GameState;
  human: PlayerId;
  bar: BarModel;
  targets: Set<string> | null;
  onStackTap: (card: CardId) => void;
}

export function CenterStrip({ s, human, bar, targets, onStackTap }: CenterStripProps) {
  const whose = s.turn === 0 ? 'Opening hand' : s.activePlayer === human ? 'Your turn' : `${s.players[s.activePlayer].name}'s turn`;
  return (
    <section class="center" aria-live="polite">
      <div class="phase-row">
        <span class="phase-label" data-testid="phase">
          {s.turn > 0 ? `Turn ${s.turn} · ` : ''}
          {whose}
          {s.turn > 0 ? ` · ${STEP_NAMES[s.step]}` : ''}
        </span>
        {s.turn > 0 && (
          <span class="phase-track" aria-hidden="true">
            {PHASES.map((phase) => (
              <span key={phase.label} class={phase.steps.includes(s.step) ? 'on' : ''} title={phase.label} />
            ))}
          </span>
        )}
      </div>
      <div>
        <div class="prompt-title" data-testid="prompt">
          {bar.prompt.title}
        </div>
        {bar.prompt.detail && (
          <div class="prompt-detail" data-testid="prompt-detail">
            {bar.prompt.detail}
          </div>
        )}
      </div>
      {s.stack.length > 0 && (
        <div class="stack" data-testid="stack">
          {[...s.stack].reverse().map((item) => {
            const source = stackItemSource(item);
            const def = getCardDef(s.cards[source]?.def ?? '');
            const aimedAt = item.targets.map((target) => targetRef(s, target, human)).join(', ');
            const targetable = item.kind === 'spell' && !!targets?.has(source);
            const who = item.controller === human ? 'You' : s.players[item.controller].name;
            const what = item.kind === 'spell' ? cardName(s, source) : `${cardName(s, source)} ability`;
            return (
              <button
                key={item.id}
                type="button"
                class={`stack-item${targetable ? ' targetable' : ''}${targets && !targetable ? ' dim' : ''}`}
                style={cssVars({ '--card-color': cardColorVar(def) })}
                data-testid={`stack-${item.id}`}
                data-card={source}
                data-targetable={targetable ? 'true' : undefined}
                aria-label={targetable ? `Target ${what}` : `${who}: ${what}${aimedAt ? ` → ${aimedAt}` : ''}`}
                onClick={() => onStackTap(source)}
              >
                <span class="who">{who}</span>
                <span>
                  {what}
                  {aimedAt ? ` → ${aimedAt}` : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ActionBarProps {
  bar: BarModel;
  thinking: boolean;
  opponentName: string;
  onCommand: (command: UiCommand) => void;
}

export function ActionBar({ bar, thinking, opponentName, onCommand }: ActionBarProps) {
  return (
    <div class="action-bar">
      {thinking && (
        <span class="thinking" data-testid="thinking">
          {opponentName}
          <i />
          <i />
          <i />
        </span>
      )}
      <div class="buttons">
        {bar.buttons.map((button: UiButton) => (
          <button
            key={button.id}
            type="button"
            class={`btn${button.tone && button.tone !== 'primary' ? ` ${button.tone}` : ''}`}
            data-testid={`btn-${button.id}`}
            disabled={button.disabled}
            onClick={() => onCommand(button.command)}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
}
