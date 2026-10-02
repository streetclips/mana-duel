import { Fragment, type ComponentChildren, type CSSProperties } from 'preact';
import {
  costSymbols,
  countersLabel,
  getCardDef,
  getCost,
  getKeywords,
  getPower,
  getToughness,
  hasKeyword,
  isReadyToTap,
  parseCost,
  rulesText,
  typeLine,
  type ActivatedAbility,
  type CardDef,
  type CardId,
  type GameState,
  type Keyword,
} from '../../engine';
import { abilityHints, cardArtUrl, cardColorVar, cssVars, effectHint, lastingTriggers, manaName, triggerHint } from '../cardInfo';
import type { CardFx, GhostFx } from '../fx';
import { usePress } from '../useController';
import { CardIcon } from './KeywordIcon';

export function CardArt({ defId }: { defId: string }) {
  return (
    <span class="art" aria-hidden="true">
      <img src={cardArtUrl(defId)} alt="" draggable={false} />
    </span>
  );
}

function ManaSymbol({ symbol }: { symbol: string }) {
  if (symbol === 'T') {
    return (
      <span class="pip tap" aria-label="girar">
        T
      </span>
    );
  }
  if (/^\d+$/.test(symbol)) {
    return (
      <span class="pip generic" aria-label={`${symbol} genérico`}>
        {symbol}
      </span>
    );
  }
  return (
    <span class="pip" style={cssVars({ '--pip': `var(--mana-${symbol})` })} data-color={symbol} aria-label={manaName(symbol)}>
      {symbol}
    </span>
  );
}

export function ManaCost({ defId }: { defId: string }) {
  const symbols = costSymbols(getCost(defId));
  if (symbols.length === 0) return null;
  return (
    <span class="pips" aria-label={`Coste: ${symbols.map(manaName).join(', ')}`}>
      {symbols.map((symbol, index) => (
        <ManaSymbol key={index} symbol={symbol} />
      ))}
    </span>
  );
}

export function RulesLine({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\})/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        const match = /^\{([^}]+)\}$/.exec(part);
        return match ? <ManaSymbol key={index} symbol={match[1] as string} /> : part;
      })}
    </>
  );
}

export interface CardFlags {
  selected?: boolean;
  selectable?: boolean;
  targetable?: boolean;
  playable?: boolean;
  attacking?: boolean;
  blocking?: boolean;
  dim?: boolean;
  aimed?: boolean;
  usable?: number[];
  badge?: { kind: 'attack' | 'block'; value: number };
}

export function fxDelay(delay: number): CSSProperties | undefined {
  return delay > 0 ? cssVars({ '--fx-delay': `${delay}ms` }) : undefined;
}

function classes(base: string, flags: CardFlags, extra: string[] = []): string {
  const names = [base, ...extra];
  if (flags.selected) names.push('selected');
  if (flags.selectable) names.push('selectable');
  if (flags.targetable) names.push('targetable');
  if (flags.playable) names.push('playable');
  if (flags.attacking) names.push('attacking');
  if (flags.blocking) names.push('blocking');
  if (flags.dim) names.push('dim');
  if (flags.aimed) names.push('aimed');
  return names.join(' ');
}

function FxFlash({ fx }: { fx?: CardFx }) {
  if (!fx?.flash) return null;
  return <span key={fx.flash.key} class={`flash ${fx.flash.tone}`} style={fxDelay(fx.flash.delay)} />;
}

function FxOverlays({ id, fx }: { id: CardId; fx?: CardFx }) {
  if (!fx) return null;
  return (
    <>
      {fx.ring && <span key={`ring-${fx.ring.key}`} class={`fx-ring ${fx.ring.tone}`} aria-hidden="true" />}
      {fx.burst && <span key={`burst-${fx.burst.key}`} class="fx-burst" style={fxDelay(fx.burst.delay)} aria-hidden="true" />}
      {fx.float && (
        <span
          key={`float-${fx.float.key}`}
          class={`float ${fx.float.tone}`}
          data-testid={`fx-float-${id}`}
          style={fxDelay(fx.float.delay)}
          aria-hidden="true"
        >
          {fx.float.text}
        </span>
      )}
    </>
  );
}

function CardIcons({ def, keywords }: { def: CardDef; keywords: readonly Keyword[] }) {
  const lasting = lastingTriggers(def);
  if (keywords.length === 0 && lasting.length === 0) return null;
  return (
    <span class="icons" aria-hidden="true">
      {keywords.map((keyword) => (
        <CardIcon key={keyword} name={keyword} />
      ))}
      {lasting.length > 0 && <CardIcon name="trigger" title={lasting.map(triggerHint).join(' · ')} />}
    </span>
  );
}

function leadsWithSymbol(ability: ActivatedAbility): boolean {
  return Boolean(ability.tap) || (!ability.sacrifice && ability.cost !== '{0}');
}

function AbilityCost({ ability }: { ability: ActivatedAbility }) {
  const parts: ComponentChildren[] = [];
  if (ability.tap) parts.push(<ManaSymbol symbol="T" />);
  if (ability.sacrifice) parts.push('Sacr.');
  if (ability.cost !== '{0}') parts.push(costSymbols(parseCost(ability.cost)).map((symbol, index) => <ManaSymbol key={index} symbol={symbol} />));
  return (
    <span class="cost">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && ', '}
          {part}
        </Fragment>
      ))}
      :
    </span>
  );
}

function abilityEffect(ability: ActivatedAbility): string {
  return ability.effects
    .map(effectHint)
    .join(', ')
    .replace(/(\d) /g, '$1\u00a0');
}

interface AbilityPillsProps {
  def: CardDef;
  id?: CardId;
  usable?: readonly number[];
  manaSpent?: boolean;
}

function AbilityPills({ def, id, usable = [], manaSpent = false }: AbilityPillsProps) {
  const mana = def.types.includes('creature') ? (def.mana ?? []) : [];
  const activated = def.activated ?? [];
  if (mana.length === 0 && activated.length === 0) return null;
  return (
    <span class="abilities" aria-hidden="true">
      {mana.length > 0 && (
        <span class="ability symbol-led" data-testid={id && `ability-${id}-mana`} data-spent={manaSpent ? 'true' : undefined}>
          <span class="cost">
            <ManaSymbol symbol="T" />:
          </span>{' '}
          <span class="effect">
            +
            {mana.map((color, index) => (
              <Fragment key={color}>
                {index > 0 && '/'}
                <ManaSymbol symbol={color} />
              </Fragment>
            ))}
          </span>
        </span>
      )}
      {activated.map((ability, index) => (
        <span
          key={index}
          class={`ability${leadsWithSymbol(ability) ? ' symbol-led' : ''}`}
          data-testid={id && `ability-${id}-${index}`}
          data-usable={usable.includes(index) ? 'true' : undefined}
        >
          <AbilityCost ability={ability} /> <span class="effect">{abilityEffect(ability)}</span>
        </span>
      ))}
    </span>
  );
}

function PowerToughness({ s, id }: { s: GameState; id: CardId }) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const power = getPower(s, id);
  const toughness = getToughness(s, id);
  const remaining = toughness - card.damage;
  const powerClass = power > (def.power ?? 0) ? 'up' : power < (def.power ?? 0) ? 'down' : '';
  const toughClass = card.damage > 0 || toughness < (def.toughness ?? 0) ? 'down' : toughness > (def.toughness ?? 0) ? 'up' : '';
  return (
    <span class="pt num" data-testid={`pt-${id}`}>
      <span class={powerClass}>{power}</span>/<span class={toughClass}>{remaining}</span>
    </span>
  );
}

export function permanentLabel(s: GameState, id: CardId): string {
  const card = s.cards[id];
  if (!card) return id;
  const def = getCardDef(card.def);
  const parts = [def.name];
  if (def.types.includes('creature')) parts.push(`${getPower(s, id)}/${getToughness(s, id) - card.damage}`);
  if (card.counters > 0) parts.push(countersLabel(card.counters));
  if (card.tapped) parts.push('girada');
  if (card.summoningSick && def.types.includes('creature') && !hasKeyword(s, id, 'haste')) parts.push('con mareo de invocación');
  if (s.combat?.attackers.includes(id)) parts.push('atacando');
  if (s.combat?.blocks.some((block) => block.blocker === id)) parts.push('bloqueando');
  return parts.join(', ');
}

interface PermanentProps {
  s: GameState;
  id: CardId;
  flags: CardFlags;
  fx?: CardFx;
  onTap: () => void;
  onInspect: () => void;
}

export function PermanentCard({ s, id, flags, fx, onTap, onInspect }: PermanentProps) {
  const press = usePress(onTap, onInspect);
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const sick = card.summoningSick && !hasKeyword(s, id, 'haste');
  const inCombat = Boolean(flags.attacking || flags.blocking);
  return (
    <div
      class={`slot${card.tapped ? ' tapped' : ''}${inCombat ? ' in-combat' : ''}`}
      data-slot={id}
      data-fx={fx?.kinds.join(' ')}
      data-fx-seq={fx?.seq}
    >
      <button
        type="button"
        class={classes('card permanent', flags)}
        style={cssVars({ '--card-color': cardColorVar(def) })}
        data-testid={`card-${id}`}
        data-card={id}
        data-def={def.id}
        data-zone="battlefield"
        data-tapped={card.tapped ? 'true' : 'false'}
        data-attacking={flags.attacking ? 'true' : undefined}
        data-targetable={flags.targetable ? 'true' : undefined}
        data-aimed={flags.aimed ? 'true' : undefined}
        aria-label={permanentLabel(s, id)}
        aria-pressed={flags.selected ? 'true' : undefined}
        {...press}
      >
        <CardArt defId={def.id} />
        <CardIcons def={def} keywords={getKeywords(s, id)} />
        <AbilityPills def={def} id={id} usable={flags.usable} manaSpent={card.tapped || !isReadyToTap(s, id)} />
        {def.types.includes('creature') && <PowerToughness s={s} id={id} />}
        {sick && <span class="sick" title="Mareo de invocación" />}
        {flags.badge && <span class={`badge ${flags.badge.kind}`}>{flags.badge.value}</span>}
        <FxFlash fx={fx} />
      </button>
      {flags.aimed && <span class="aim" aria-hidden="true" />}
      <FxOverlays id={id} fx={fx} />
    </div>
  );
}

interface GhostProps {
  ghost: GhostFx;
  fx?: CardFx;
  rise: boolean;
}

export function GhostCard({ ghost, fx, rise }: GhostProps) {
  const def = getCardDef(ghost.def);
  return (
    <div
      class={`slot ghost ${ghost.kind} ${rise ? 'rise' : 'sink'}`}
      data-slot={ghost.card}
      data-testid={`fx-ghost-${ghost.card}`}
      data-def={def.id}
      data-fx={fx?.kinds.join(' ') ?? ghost.kind}
      data-fx-seq={fx?.seq}
      style={fxDelay(ghost.delay)}
      aria-hidden="true"
    >
      <div class="card permanent" style={cssVars({ '--card-color': cardColorVar(def) })}>
        <CardArt defId={def.id} />
        <CardIcons def={def} keywords={def.keywords ?? []} />
        <AbilityPills def={def} />
        {def.types.includes('creature') && (
          <span class="pt num">
            {def.power}/{def.toughness}
          </span>
        )}
        <FxFlash fx={fx} />
      </div>
      <FxOverlays id={ghost.card} fx={fx} />
    </div>
  );
}

interface HandCardProps {
  s: GameState;
  id: CardId;
  flags: CardFlags;
  fx?: CardFx;
  onTap: () => void;
  onInspect: () => void;
}

export function MiniFace({ def }: { def: CardDef }) {
  const isCreature = def.types.includes('creature');
  const keywords = isCreature ? (def.keywords ?? []) : [];
  const text = isCreature ? abilityHints(def.id).join(' · ') : rulesText(def).join(' ');
  return (
    <>
      <CardArt defId={def.id} />
      <span class="cost">
        <ManaCost defId={def.id} />
      </span>
      <span class="caption">
        {isCreature && (
          <span class="pt num">
            {def.power}/{def.toughness}
          </span>
        )}
        <span class="name">{def.name}</span>
        {(keywords.length > 0 || text) && (
          <span class="text">
            {keywords.map((keyword) => (
              <CardIcon key={keyword} name={keyword} />
            ))}
            <RulesLine text={text} />
          </span>
        )}
      </span>
    </>
  );
}

export function HandCard({ s, id, flags, fx, onTap, onInspect }: HandCardProps) {
  const press = usePress(onTap, onInspect);
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const isLand = def.types.includes('land');
  return (
    <button
      type="button"
      class={classes('card mini hand-card', flags, isLand ? ['land'] : [])}
      style={cssVars({ '--card-color': cardColorVar(def), '--fx-i': String(fx?.order ?? 0) })}
      data-testid={`card-${id}`}
      data-card={id}
      data-def={def.id}
      data-zone="hand"
      data-fx={fx?.kinds.join(' ')}
      data-fx-seq={fx?.seq}
      data-playable={flags.playable ? 'true' : undefined}
      aria-label={`${def.name}${flags.playable ? ', jugable' : ''}`}
      aria-pressed={flags.selected ? 'true' : undefined}
      {...press}
    >
      <MiniFace def={def} />
    </button>
  );
}

export function DetailFace({ def, pt }: { def: CardDef; pt?: ComponentChildren }) {
  return (
    <div class="card detail-card" style={cssVars({ '--card-color': cardColorVar(def) })} aria-hidden="true">
      <span class="cost">
        <ManaCost defId={def.id} />
      </span>
      <span class="name">{def.name}</span>
      <span class="type">{typeLine(def)}</span>
      <CardArt defId={def.id} />
      {def.types.includes('creature') &&
        (pt ?? (
          <span class="pt num">
            {def.power}/{def.toughness}
          </span>
        ))}
    </div>
  );
}

export function DetailCard({ s, id }: { s: GameState; id: CardId }) {
  const card = s.cards[id];
  if (!card) return null;
  return <DetailFace def={getCardDef(card.def)} pt={card.zone === 'battlefield' ? <PowerToughness s={s} id={id} /> : undefined} />;
}
