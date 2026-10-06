import { getCardDef } from '../registry';
import {
  EVOLVE_TRIGGER,
  PROWESS_TRIGGER,
  UNDYING_TRIGGER,
  getCard,
  getPower,
  getToughness,
  isCreatureDef,
  isRelicDef,
} from '../state';
import type {
  CardDef,
  CardId,
  Color,
  Effect,
  EffectTarget,
  GameState,
  Keyword,
  PlayerId,
  Step,
  Target,
  TargetSpec,
  TriggerCondition,
  TriggerEvent,
} from '../types';
import { capitalize, cardName, lowerFirst, plainText, type TextPart } from './parts';

export interface SelfReference {
  subject: string;
  object: string;
}

export type Role = keyof SelfReference;

export type TargetRef = (target: EffectTarget, role: Role) => string;

export interface SentenceContext {
  subject: string;
  on?: TriggerEvent;
}

export interface RulesGrammar {
  keywordNames: Record<Keyword, string>;
  keywordLine(keywords: string): string;
  entersTapped: string;
  manaAbility(colors: readonly Color[]): string;
  triggerOpeners: Record<TriggerEvent, string>;
  relicOpeners: Partial<Record<TriggerEvent, string>>;
  triggerConditions: Record<TriggerCondition, string>;
  undying: string;
  evolve: string;
  prowess: string;
  sacrificeCost: string;
  selves: Record<'pronoun' | 'creature' | 'sacrificed', SelfReference>;
  targetPhrase(spec: TargetSpec): string;
  repeatedPhrase(spec: TargetSpec): string;
  effectSentence(effect: Effect, ref: TargetRef, context: SentenceContext): string;
  moreDamage(amount: number, target: string): string;
  andThen: string;
}

export interface StateWords {
  stepName(step: Step): string;
  turn: string;
  active: string;
  life(amount: number): string;
  library: string;
  graveyard: string;
  hand: string;
  hiddenHand(count: number): string;
  battlefield: string;
  relics: string;
  stack: string;
  ability(source: string): string;
  targets(s: GameState, targets: Target[], viewer: PlayerId): TextPart[];
  waitingFor: string;
  tapped: string;
  summoningSick: string;
  damage(amount: number): string;
  counters(count: number): string;
  attacking: string;
  blocking(attacker: CardId): string;
}

const NO_SELF: SelfReference = { subject: '', object: '' };

const OPENER_NAMES_IT: ReadonlySet<TriggerEvent> = new Set(['enters', 'dies', 'attacks', 'damagesPlayer']);

function withoutPeriod(sentence: string): string {
  return sentence.replace(/\.$/, '');
}

function sentences(
  grammar: RulesGrammar,
  effects: Effect[],
  specs: TargetSpec[],
  context: SentenceContext,
  self: SelfReference,
): string {
  const named = new Set<number>();
  const ref: TargetRef = (target, role) => {
    if (target === 'self') return self[role];
    const spec = specs[target];
    if (!spec) return '';
    if (named.has(target)) return grammar.repeatedPhrase(spec);
    named.add(target);
    return grammar.targetPhrase(spec);
  };
  const lines: string[] = [];
  effects.forEach((effect, index) => {
    const previous = effects[index - 1];
    if (effect.kind === 'damage' && previous?.kind === 'damage' && lines.length > 0) {
      lines.push(
        `${withoutPeriod(lines.pop() as string)} ${grammar.moreDamage(effect.amount, ref(effect.to, 'object'))}`,
      );
      return;
    }
    const text = capitalize(grammar.effectSentence(effect, ref, context));
    if (effect.kind === 'discard' && effect.who !== 'opponent' && previous?.kind === 'draw' && lines.length > 0) {
      lines.push(`${withoutPeriod(lines.pop() as string)}${grammar.andThen}${lowerFirst(text)}`);
    } else lines.push(text);
  });
  return lines.join(' ');
}

export function rulesText(grammar: RulesGrammar, def: CardDef): string[] {
  const lines: string[] = [];
  if (def.keywords?.length) {
    const names = def.keywords.map((keyword, i) =>
      i === 0 ? grammar.keywordNames[keyword] : lowerFirst(grammar.keywordNames[keyword]),
    );
    lines.push(grammar.keywordLine(names.join(', ')));
  }
  if (def.entersTapped) lines.push(grammar.entersTapped);
  if (def.mana?.length) lines.push(grammar.manaAbility(def.mana));
  if (def.spell) lines.push(sentences(grammar, def.spell.effects, def.spell.targets, { subject: def.name }, NO_SELF));
  (def.triggers ?? []).forEach((_, index) => lines.push(triggerText(grammar, def, index)));
  (def.activated ?? []).forEach((_, index) => lines.push(activatedText(grammar, def, index)));
  return lines;
}

export function triggerText(grammar: RulesGrammar, def: CardDef, index: number): string {
  if (index === UNDYING_TRIGGER) return grammar.undying;
  if (index === EVOLVE_TRIGGER) return grammar.evolve;
  if (index === PROWESS_TRIGGER) return grammar.prowess;
  const trigger = def.triggers?.[index];
  if (!trigger) return '';
  const self = OPENER_NAMES_IT.has(trigger.on) ? grammar.selves.pronoun : grammar.selves.creature;
  const condition = trigger.condition ? `${grammar.triggerConditions[trigger.condition]}, ` : '';
  const opener = (isRelicDef(def) ? grammar.relicOpeners[trigger.on] : undefined) ?? grammar.triggerOpeners[trigger.on];
  return `${opener}, ${condition}${lowerFirst(sentences(grammar, trigger.effects, trigger.targets, { subject: self.subject, on: trigger.on }, self))}`;
}

export function activatedText(grammar: RulesGrammar, def: CardDef, index: number): string {
  const ability = def.activated?.[index];
  if (!ability) return '';
  const cost = [
    ability.cost && ability.cost !== '{0}' ? ability.cost : '',
    ability.tap ? '{T}' : '',
    ability.sacrifice ? grammar.sacrificeCost : '',
  ]
    .filter(Boolean)
    .join(', ');
  const self = ability.sacrifice ? grammar.selves.sacrificed : grammar.selves.creature;
  return `${capitalize(cost)}: ${sentences(grammar, ability.effects, ability.targets, { subject: self.subject }, self)}`;
}

function permanentLabel(words: StateWords, s: GameState, id: CardId): string {
  const card = getCard(s, id);
  const def = getCardDef(card.def);
  const flags: string[] = [];
  if (card.tapped) flags.push(words.tapped);
  if (card.summoningSick && isCreatureDef(def)) flags.push(words.summoningSick);
  if (card.damage > 0) flags.push(words.damage(card.damage));
  if (card.counters > 0) flags.push(words.counters(card.counters));
  if (s.combat?.attackers.includes(id)) flags.push(words.attacking);
  const block = s.combat?.blocks.find((candidate) => candidate.blocker === id);
  if (block) flags.push(words.blocking(block.attacker));
  const stats = isCreatureDef(def) ? ` ${getPower(s, id)}/${getToughness(s, id)}` : '';
  return `${def.name}(${id})${stats}${flags.length ? ` [${flags.join(', ')}]` : ''}`;
}

export function describeState(words: StateWords, s: GameState, viewer: PlayerId, revealAll: boolean): string {
  const lines: string[] = [];
  lines.push(
    `${words.turn} ${s.turn} · ${words.stepName(s.step)} · ${words.active}: ${s.players[s.activePlayer].name} (p${s.activePlayer})`,
  );
  for (const player of [viewer, viewer === 0 ? 1 : 0] as PlayerId[]) {
    const ps = s.players[player];
    const showHand = revealAll || player === viewer;
    const hand = showHand
      ? ps.hand.map((id) => `${cardName(s, id)}(${id})`).join(', ')
      : words.hiddenHand(ps.hand.length);
    lines.push(
      `${ps.name} (p${player}): ${words.life(ps.life)} · ${words.library} ${ps.library.length} · ${words.graveyard} ${ps.graveyard.length}`,
    );
    lines.push(`  ${words.hand}: ${hand || '—'}`);
    lines.push(`  ${words.battlefield}: ${ps.battlefield.map((id) => permanentLabel(words, s, id)).join(', ') || '—'}`);
    if (ps.command.length > 0)
      lines.push(`  ${words.relics}: ${ps.command.map((id) => `${cardName(s, id)}(${id})`).join(', ')}`);
  }
  const stack = [...s.stack]
    .reverse()
    .map((item) => {
      const source = item.kind === 'spell' ? item.card : item.source;
      const label = item.kind === 'spell' ? cardName(s, source) : words.ability(cardName(s, source));
      return `${label}${plainText(words.targets(s, item.targets, viewer))}`;
    })
    .join(' ← ');
  lines.push(`${words.stack}: ${stack || '—'}`);
  const pending = s.pending;
  if (pending) {
    const who = pending.kind === 'gameOver' ? '' : ` (${s.players[pending.player].name})`;
    lines.push(`${words.waitingFor}: ${pending.kind}${who}`);
  }
  return lines.join('\n');
}
