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
import { cardColorVar, cssVars, manaFill } from '../cardInfo';
import type { CardFx, FxView, PlayerFx } from '../fx';
import type { BarModel, UiButton, UiCommand } from '../model';
import { fxDelay } from './Card';

export interface PlayerTag {
  text: string;
  title: string;
}

interface PlayerBarProps {
  s: GameState;
  player: PlayerId;
  human: PlayerId;
  deckName?: string;
  tag?: PlayerTag;
  badge?: string;
  targetable: boolean;
  aimed: boolean;
  fx?: PlayerFx;
  onTap: () => void;
}

export function PlayerBar({ s, player, human, deckName, tag, badge, targetable, aimed, fx, onTap }: PlayerBarProps) {
  const ps = s.players[player];
  const hasPriority = s.pending?.kind === 'priority' && s.pending.player === player;
  const label = `${ps.name}${tag ? ` (${tag.title})` : ''}: ${ps.life} ${ps.life === 1 ? 'vida' : 'vidas'}, ${ps.hand.length} en la mano, ${ps.library.length} en la biblioteca, ${ps.graveyard.length} en el cementerio`;
  return (
    <div class="player-bar">
      <button
        type="button"
        class={`player-chip${targetable ? ' targetable' : ''}${aimed ? ' aimed' : ''}`}
        data-testid={`player-${player}`}
        data-targetable={targetable ? 'true' : undefined}
        data-aimed={aimed ? 'true' : undefined}
        data-fx={fx?.kinds.join(' ')}
        data-fx-seq={fx?.seq}
        aria-label={targetable ? `Objetivo: ${ps.name}` : label}
        onClick={onTap}
      >
        <span class="avatar" aria-hidden="true">
          {player === human ? 'Tú' : ps.name.slice(0, 2)}
        </span>
        {fx?.drawn && (
          <span key={fx.drawn.key} class="fx-drawn" data-testid={`fx-drawn-${player}`} data-fx="draw" aria-hidden="true">
            <i />
            <span>+{fx.drawn.count}</span>
          </span>
        )}
        <span class="life-box">
          <span class={`life num${ps.life <= 5 ? ' low' : ''}`} data-testid={`life-${player}`}>
            {ps.life}
          </span>
          {fx?.life && (
            <span
              key={fx.life.key}
              class={`float ${fx.life.tone}`}
              data-testid={`fx-life-${player}`}
              style={fxDelay(fx.life.delay)}
              aria-hidden="true"
            >
              {fx.life.text}
            </span>
          )}
        </span>
        {fx?.life && (
          <span key={`chip-${fx.life.key}`} class={`fx-chip ${fx.life.tone}`} style={fxDelay(fx.life.delay)} aria-hidden="true" />
        )}
        <span class="player-meta">
          <b>
            {ps.name}
            {deckName && (
              <span class="deck-name" data-testid={`deck-name-${player}`}>
                {' '}
                · {deckName}
              </span>
            )}
            {tag && (
              <span class="player-tag" data-testid={`player-tag-${player}`} title={tag.title}>
                {tag.text}
              </span>
            )}
            {badge && (
              <span class="player-tag duel-badge" data-testid={`duel-badge-${player}`}>
                {badge}
              </span>
            )}
          </b>
          <span class="num counts" data-testid={`counts-${player}`}>
            Mano {ps.hand.length} · Mazo {ps.library.length} · Cementerio {ps.graveyard.length}
          </span>
        </span>
      </button>
      <span class="spacer" />
      {hasPriority && <span class="priority-dot" title="Tiene la prioridad" aria-label="Tiene la prioridad" />}
    </div>
  );
}

export function Lands({ s, player, cardFx }: { s: GameState; player: PlayerId; cardFx?: Map<CardId, CardFx> }) {
  const lands = s.players[player].battlefield.filter((id) => isLand(s, id));
  const untapped = lands.filter((id) => !s.cards[id]?.tapped).length;
  return (
    <div class="lands" data-testid={`lands-${player}`} aria-label={`${untapped} de ${lands.length} tierras enderezadas`}>
      {lands.length === 0 && <span class="empty">Sin tierras</span>}
      {lands.map((id) => {
        const def = getCardDef(s.cards[id]?.def ?? '');
        const mana = def.mana ?? [];
        const multi = mana.length > 1;
        return (
          <span
            key={id}
            class={`land-pip${multi ? ' multi' : ''}${s.cards[id]?.tapped ? ' tapped' : ''}`}
            style={cssVars(multi ? { '--pip': cardColorVar(def), '--pip-fill': manaFill(mana) } : { '--pip': cardColorVar(def) })}
            data-color={mana.join('')}
            title={`${def.name}${s.cards[id]?.tapped ? ' (girada)' : ''}`}
            data-testid={`card-${id}`}
            data-card={id}
            data-def={def.id}
            data-zone="battlefield"
            data-tapped={s.cards[id]?.tapped ? 'true' : 'false'}
            data-fx={cardFx?.get(id)?.kinds.join(' ')}
          >
            {multi ? '' : mana.join('')}
          </span>
        );
      })}
    </div>
  );
}

const PHASES: { label: string; steps: Step[] }[] = [
  { label: 'Inicio', steps: ['untap', 'upkeep', 'draw'] },
  { label: 'Principal', steps: ['main1'] },
  { label: 'Combate', steps: ['beginCombat', 'declareAttackers', 'declareBlockers', 'firstStrikeDamage', 'combatDamage', 'endCombat'] },
  { label: 'Principal 2', steps: ['main2'] },
  { label: 'Final', steps: ['end', 'cleanup'] },
];

interface CenterStripProps {
  s: GameState;
  human: PlayerId;
  bar: BarModel;
  targets: Set<string> | null;
  aimed: Set<string>;
  fx: FxView;
  onStackTap: (card: CardId) => void;
}

function turnOwner(player: PlayerId, human: PlayerId): string {
  return player === human ? 'Tu turno' : 'Turno del rival';
}

export function CenterStrip({ s, human, bar, targets, aimed, fx, onStackTap }: CenterStripProps) {
  const whose = s.turn === 0 ? 'Mano inicial' : turnOwner(s.activePlayer, human);
  return (
    <section class="center" aria-live="polite">
      {fx.turn && (
        <div key={fx.turn.key} class="fx-turn" data-testid="fx-turn" data-fx="turn" data-player={fx.turn.player} aria-hidden="true">
          <span>
            {turnOwner(fx.turn.player, human)}
            <small>Turno {fx.turn.turn}</small>
          </span>
        </div>
      )}
      <div class="phase-row">
        <span class="phase-label" data-testid="phase">
          {s.turn > 0 ? `Turno ${s.turn} · ` : ''}
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
            const isAimed = item.kind === 'spell' && aimed.has(source);
            const who = item.controller === human ? 'Tú' : s.players[item.controller].name;
            const what = item.kind === 'spell' ? cardName(s, source) : `Habilidad de ${cardName(s, source)}`;
            return (
              <button
                key={item.id}
                type="button"
                class={`stack-item${targetable ? ' targetable' : ''}${targets && !targetable ? ' dim' : ''}${isAimed ? ' aimed' : ''}`}
                style={cssVars({ '--card-color': cardColorVar(def) })}
                data-testid={`stack-${item.id}`}
                data-card={source}
                data-targetable={targetable ? 'true' : undefined}
                data-aimed={isAimed ? 'true' : undefined}
                data-fx={fx.stack.get(source)}
                aria-label={targetable ? `Objetivo: ${what}` : `${who}: ${what}${aimedAt ? ` → ${aimedAt}` : ''}`}
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
          <span class="thinker">{opponentName}</span>
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
