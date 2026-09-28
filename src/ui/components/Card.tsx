import type { ComponentChildren, CSSProperties } from 'preact';
import {
  costSymbols,
  getCardDef,
  getCost,
  getPower,
  getToughness,
  hasKeyword,
  rulesText,
  typeLine,
  type CardDef,
  type CardId,
  type GameState,
} from '../../engine';
import { cardArtUrl, cardColorVar, cssVars, hasLongWord, shortText } from '../cardInfo';
import type { CardFx, GhostFx } from '../fx';
import { usePress } from '../useController';

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
      <span class="pip tap" aria-label="tap">
        T
      </span>
    );
  }
  if (/^\d+$/.test(symbol)) {
    return (
      <span class="pip generic" aria-label={`${symbol} generic`}>
        {symbol}
      </span>
    );
  }
  return (
    <span class="pip" style={cssVars({ '--pip': `var(--mana-${symbol})` })} data-color={symbol} aria-label={symbol}>
      {symbol}
    </span>
  );
}

export function ManaCost({ defId }: { defId: string }) {
  const symbols = costSymbols(getCost(defId));
  if (symbols.length === 0) return null;
  return (
    <span class="pips" aria-label={`Cost ${symbols.join(' ')}`}>
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
  if (card.tapped) parts.push('tapped');
  if (card.summoningSick && def.types.includes('creature') && !hasKeyword(s, id, 'haste')) parts.push('summoning sick');
  if (s.combat?.attackers.includes(id)) parts.push('attacking');
  if (s.combat?.blocks.some((block) => block.blocker === id)) parts.push('blocking');
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
        <span class={`name${hasLongWord(def.name) ? ' long' : ''}`}>{def.name}</span>
        <span class="kw">{shortText(def.id)}</span>
        <CardArt defId={def.id} />
        {def.types.includes('creature') && <PowerToughness s={s} id={id} />}
        {sick && <span class="sick" title="Summoning sick" />}
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
        <span class={`name${hasLongWord(def.name) ? ' long' : ''}`}>{def.name}</span>
        <span class="kw">{shortText(def.id)}</span>
        <CardArt defId={def.id} />
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
  const isLand = def.types.includes('land');
  const text = isLand ? rulesText(def).join(' ') : shortText(def.id) || rulesText(def).join(' ');
  return (
    <>
      <span class="cost">
        <ManaCost defId={def.id} />
      </span>
      <span class="name">{def.name}</span>
      <span class="text">
        <RulesLine text={text} />
      </span>
      <CardArt defId={def.id} />
      {def.types.includes('creature') && (
        <span class="pt num">
          {def.power}/{def.toughness}
        </span>
      )}
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
      aria-label={`${def.name}${flags.playable ? ', playable' : ''}`}
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
