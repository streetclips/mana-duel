import { getCardDef } from './registry';
import { shuffleInPlace } from './rng';
import {
  changeLife,
  createToken,
  creaturesOf,
  defOf,
  drawCards,
  getCard,
  getKeywords,
  getPower,
  isCreatureDef,
  isPermanentDef,
  moveCard,
  newId,
  onBattlefield,
  opponent,
  triggeredAbility,
} from './state';
import { isLegalTarget, isPlayerTarget } from './targets';
import type {
  CardId,
  ContinuousEffect,
  Effect,
  EffectTarget,
  GameEvent,
  GameState,
  Keyword,
  PlayerId,
  StackItem,
  Target,
  TargetSpec,
  Who,
} from './types';

export interface DamageAssignment {
  source: CardId;
  target: Target;
  amount: number;
}

export function sourceHasKeyword(s: GameState, source: CardId, keyword: Keyword): boolean {
  const card = s.cards[source];
  if (!card) return false;
  const def = getCardDef(card.def);
  if (!isCreatureDef(def)) return false;
  const keywords = card.zone === 'battlefield' ? getKeywords(s, source) : (def.keywords ?? []);
  return keywords.includes(keyword);
}

export function applyDamage(s: GameState, assignments: DamageAssignment[], combat: boolean): void {
  const lifelinkGains = new Map<PlayerId, number>();
  for (const assignment of assignments) {
    const { source, target, amount } = assignment;
    if (amount <= 0) continue;
    if (isPlayerTarget(target)) {
      s.events.push({ t: 'damage', source, target, amount, combat });
      s.players[target.player].damagedThisTurn = true;
      changeLife(s, target.player, -amount);
    } else {
      const card = s.cards[target.card];
      if (!card || card.zone !== 'battlefield') continue;
      card.damage += amount;
      if (sourceHasKeyword(s, source, 'deathtouch')) card.deathtouchDamage = true;
      s.events.push({ t: 'damage', source, target, amount, combat });
    }
    if (sourceHasKeyword(s, source, 'lifelink')) {
      const controller = getCard(s, source).controller;
      lifelinkGains.set(controller, (lifelinkGains.get(controller) ?? 0) + amount);
    }
  }
  for (const [player, amount] of lifelinkGains) changeLife(s, player, amount);
}

export interface EffectContext {
  controller: PlayerId;
  source: CardId;
  targets: Target[];
  targetLegal: boolean[];
}

function resolveEffectTarget(s: GameState, ctx: EffectContext, ref: EffectTarget): Target | null {
  if (ref === 'self') return onBattlefield(s, ctx.source) ? { card: ctx.source } : null;
  const target = ctx.targets[ref];
  if (!target || !ctx.targetLegal[ref]) return null;
  return target;
}

function resolveCreatureTarget(s: GameState, ctx: EffectContext, ref: EffectTarget): CardId | null {
  const target = resolveEffectTarget(s, ctx, ref);
  if (!target || isPlayerTarget(target) || !onBattlefield(s, target.card)) return null;
  return target.card;
}

function pumpUntilEndOfTurn(
  s: GameState,
  card: CardId,
  power: number,
  toughness: number,
  keywords: Keyword[] = [],
): void {
  const effect: ContinuousEffect = { id: newId(s, 'e'), card, power, toughness, until: 'endOfTurn' };
  const event: GameEvent = { t: 'pump', card, power, toughness };
  if (keywords.length > 0) {
    effect.keywords = [...keywords];
    event.keywords = [...keywords];
  }
  s.effects.push(effect);
  s.events.push(event);
}

function playerOf(ctx: EffectContext, who: Who | undefined): PlayerId {
  return who === 'opponent' ? opponent(ctx.controller) : ctx.controller;
}

function addCounters(s: GameState, card: CardId, amount: number): void {
  if (amount <= 0) return;
  getCard(s, card).counters += amount;
  s.events.push({ t: 'addCounters', card, amount });
}

function searchLand(
  s: GameState,
  player: PlayerId,
  land: string,
  battlefield: number,
  hand: number,
  tapped: boolean,
): void {
  const library = s.players[player].library;
  const found = library.filter((id) => getCard(s, id).def === land).slice(0, battlefield + hand);
  found.forEach((id, index) => {
    const to = index < battlefield ? 'battlefield' : 'hand';
    s.events.push({ t: 'search', player, card: id, to });
    moveCard(s, id, to, { controller: player });
    if (to === 'battlefield' && tapped) getCard(s, id).tapped = true;
  });
  shuffleInPlace(s, library);
}

export function executeEffects(s: GameState, effects: Effect[], ctx: EffectContext): void {
  for (const effect of effects) {
    switch (effect.kind) {
      case 'damage': {
        const target = resolveEffectTarget(s, ctx, effect.to);
        if (target) applyDamage(s, [{ source: ctx.source, target, amount: effect.amount }], false);
        break;
      }
      case 'pump': {
        const card = resolveCreatureTarget(s, ctx, effect.to);
        if (card) pumpUntilEndOfTurn(s, card, effect.power, effect.toughness, effect.keywords);
        break;
      }
      case 'pumpTeam':
        for (const card of creaturesOf(s, ctx.controller))
          pumpUntilEndOfTurn(s, card, effect.power, effect.toughness, effect.keywords);
        break;
      case 'addCounters': {
        const card = resolveCreatureTarget(s, ctx, effect.to);
        if (card) addCounters(s, card, effect.amount);
        break;
      }
      case 'addCountersTeam':
        for (const card of creaturesOf(s, ctx.controller)) addCounters(s, card, effect.amount);
        break;
      case 'destroy': {
        const card = resolveCreatureTarget(s, ctx, effect.to);
        if (card) moveCard(s, card, 'graveyard');
        break;
      }
      case 'bounce': {
        const card = resolveCreatureTarget(s, ctx, effect.to);
        if (!card) break;
        moveCard(s, card, 'hand');
        s.events.push({ t: 'bounce', card, player: getCard(s, card).owner });
        break;
      }
      case 'counter': {
        const target = resolveEffectTarget(s, ctx, effect.to);
        if (!target || isPlayerTarget(target)) break;
        const index = s.stack.findIndex((item) => item.kind === 'spell' && item.card === target.card);
        const item = s.stack[index];
        if (!item) break;
        s.stack.splice(index, 1);
        moveCard(s, target.card, 'graveyard');
        s.events.push({ t: 'counter', card: target.card, player: item.controller });
        break;
      }
      case 'draw':
        drawCards(s, ctx.controller, effect.amount);
        break;
      case 'gainLife':
        changeLife(s, ctx.controller, effect.amount);
        break;
      case 'loseLife': {
        const player = playerOf(ctx, effect.who);
        s.events.push({ t: 'loseLife', player, amount: effect.amount });
        changeLife(s, player, -effect.amount);
        break;
      }
      case 'fight': {
        const a = resolveCreatureTarget(s, ctx, effect.a);
        const b = resolveCreatureTarget(s, ctx, effect.b);
        if (!a || !b) break;
        s.events.push({ t: 'fight', a, b });
        applyDamage(
          s,
          [
            { source: a, target: { card: b }, amount: getPower(s, a) },
            { source: b, target: { card: a }, amount: getPower(s, b) },
          ],
          false,
        );
        break;
      }
      case 'bite': {
        const a = resolveCreatureTarget(s, ctx, effect.a);
        const b = resolveCreatureTarget(s, ctx, effect.b);
        if (!a || !b) break;
        s.events.push({ t: 'bite', a, b });
        applyDamage(s, [{ source: a, target: { card: b }, amount: getPower(s, a) }], false);
        break;
      }
      case 'createTokens':
        for (let i = 0; i < effect.amount; i++) createToken(s, effect.token, ctx.controller);
        break;
      case 'discard': {
        const player = playerOf(ctx, effect.who);
        const count = Math.min(effect.amount, s.players[player].hand.length);
        if (count > 0) s.pending = { kind: 'discard', player, count, source: ctx.source };
        break;
      }
      case 'returnToBattlefield': {
        const card = s.cards[ctx.source];
        if (!card || card.zone !== 'graveyard') break;
        moveCard(s, ctx.source, 'battlefield', { controller: card.owner });
        s.events.push({ t: 'return', player: card.owner, card: ctx.source });
        addCounters(s, ctx.source, effect.counters);
        break;
      }
      case 'extraLands':
        s.players[ctx.controller].extraLandsThisTurn += effect.amount;
        s.events.push({ t: 'extraLands', player: ctx.controller, amount: effect.amount });
        break;
      case 'searchLand':
        searchLand(s, ctx.controller, effect.land, effect.battlefield, effect.hand ?? 0, effect.tapped ?? false);
        break;
    }
  }
}

export function stackItemSource(item: StackItem): CardId {
  return item.kind === 'spell' ? item.card : item.source;
}

export function stackItemAbility(s: GameState, item: StackItem): { targets: TargetSpec[]; effects: Effect[] } | null {
  const def = defOf(s, stackItemSource(item));
  if (item.kind === 'spell') return def.spell ?? { targets: [], effects: [] };
  if (item.kind === 'trigger') return triggeredAbility(def, item.ability) ?? null;
  return def.activated?.[item.ability] ?? null;
}

export function targetLegality(s: GameState, item: StackItem, specs: TargetSpec[]): boolean[] {
  return item.targets.map((target, i) => {
    const spec = specs[i];
    return spec && !item.lost?.includes(i) ? isLegalTarget(s, item.controller, spec, target) : false;
  });
}

export function resolveTopOfStack(s: GameState): void {
  const item = s.stack.pop();
  if (!item) return;
  const source = stackItemSource(item);

  if (item.kind === 'spell' && isPermanentDef(defOf(s, source))) {
    s.events.push({ t: 'resolve', item });
    moveCard(s, source, 'battlefield', { controller: item.controller });
    return;
  }

  const ability = stackItemAbility(s, item);
  if (!ability) return;
  const legal = targetLegality(s, item, ability.targets);
  if (ability.targets.length > 0 && !legal.some(Boolean)) {
    s.events.push({ t: 'fizzle', item });
  } else {
    s.events.push({ t: 'resolve', item });
    executeEffects(s, ability.effects, {
      controller: item.controller,
      source,
      targets: item.targets,
      targetLegal: legal,
    });
  }
  if (item.kind === 'spell') moveCard(s, source, 'graveyard');
}
