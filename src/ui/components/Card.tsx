import {
  costSymbols,
  getCardDef,
  getCost,
  getPower,
  getToughness,
  hasKeyword,
  rulesText,
  typeLine,
  type CardId,
  type GameState,
} from '../../engine';
import { cardColorVar, cssVars, hasLongWord, shortText } from '../cardInfo';
import { usePress } from '../useController';

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
    <span class="pip" style={cssVars({ '--pip': `var(--mana-${symbol})` })} aria-label={symbol}>
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
  badge?: { kind: 'attack' | 'block'; value: number };
}

export interface CardFx {
  key: number;
  flash?: 'damage' | 'cast';
  float?: string;
  floatKind?: 'minus' | 'plus';
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
  return names.join(' ');
}

function PowerToughness({ s, id }: { s: GameState; id: CardId }) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const power = getPower(s, id);
  const toughness = getToughness(s, id);
  const remaining = toughness - card.damage;
  const powerClass = power > (def.power ?? 0) ? 'up' : power < (def.power ?? 0) ? 'down' : '';
  const toughClass = card.damage > 0 ? 'down' : toughness > (def.toughness ?? 0) ? 'up' : '';
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
    <div class={`slot${card.tapped ? ' tapped' : ''}${inCombat ? ' in-combat' : ''}`}>
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
        aria-label={permanentLabel(s, id)}
        aria-pressed={flags.selected ? 'true' : undefined}
        {...press}
      >
        <span class={`name${hasLongWord(def.name) ? ' long' : ''}`}>{def.name}</span>
        <span class="kw">{shortText(def.id)}</span>
        {def.types.includes('creature') && <PowerToughness s={s} id={id} />}
        {sick && <span class="sick" title="Summoning sick" />}
        {flags.badge && <span class={`badge ${flags.badge.kind}`}>{flags.badge.value}</span>}
        {fx?.flash && <span key={fx.key} class={`flash ${fx.flash}`} />}
      </button>
      {fx?.float && (
        <span key={`f${fx.key}`} class={`float ${fx.floatKind ?? 'minus'}`}>
          {fx.float}
        </span>
      )}
    </div>
  );
}

interface HandCardProps {
  s: GameState;
  id: CardId;
  flags: CardFlags;
  onTap: () => void;
  onInspect: () => void;
}

export function HandCard({ s, id, flags, onTap, onInspect }: HandCardProps) {
  const press = usePress(onTap, onInspect);
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const isLand = def.types.includes('land');
  const text = isLand ? rulesText(def).join(' ') : shortText(def.id) || rulesText(def).join(' ');
  return (
    <button
      type="button"
      class={classes('card hand-card', flags, isLand ? ['land'] : [])}
      style={cssVars({ '--card-color': cardColorVar(def) })}
      data-testid={`card-${id}`}
      data-card={id}
      data-def={def.id}
      data-zone="hand"
      data-playable={flags.playable ? 'true' : undefined}
      aria-label={`${def.name}${flags.playable ? ', playable' : ''}`}
      aria-pressed={flags.selected ? 'true' : undefined}
      {...press}
    >
      <span class="cost">
        <ManaCost defId={def.id} />
      </span>
      <span class="name">{def.name}</span>
      <span class="type">{typeLine(def)}</span>
      <span class="text">
        <RulesLine text={text} />
      </span>
      {def.types.includes('creature') && (
        <span class="pt num">
          {def.power}/{def.toughness}
        </span>
      )}
    </button>
  );
}

export function DetailCard({ s, id }: { s: GameState; id: CardId }) {
  const card = s.cards[id];
  if (!card) return null;
  const def = getCardDef(card.def);
  const onBattlefield = card.zone === 'battlefield';
  return (
    <div class="card detail-card" style={cssVars({ '--card-color': cardColorVar(def) })} aria-hidden="true">
      <span class="cost">
        <ManaCost defId={def.id} />
      </span>
      <span class="name">{def.name}</span>
      <span class="type">{typeLine(def)}</span>
      {def.types.includes('creature') &&
        (onBattlefield ? (
          <PowerToughness s={s} id={id} />
        ) : (
          <span class="pt num">
            {def.power}/{def.toughness}
          </span>
        ))}
    </div>
  );
}
