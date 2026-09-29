import {
  STEP_NAMES,
  blockOptions,
  blocksError,
  canAttack,
  cardName,
  defOf,
  eligibleAttackers,
  getLegalActions,
  sameTarget,
  stackItemSource,
  targetKey,
  targetPhrase,
  targetRef,
  triggeredAbility,
  type Action,
  type Block,
  type CardId,
  type GameState,
  type PlayerId,
  type Target,
  type TargetSpec,
} from '../engine';

export type Interaction =
  | { kind: 'none' }
  | { kind: 'target'; source: CardId; mode: 'cast' | 'activate'; ability: number; chosen: Target[] }
  | { kind: 'attack'; attackers: CardId[] }
  | { kind: 'block'; blocks: Block[]; blocker: CardId | null }
  | { kind: 'select'; cards: CardId[] }
  | { kind: 'triggerTarget'; chosen: Target[] };

export type UiCommand =
  | { kind: 'dispatch'; action: Action }
  | { kind: 'endTurn' }
  | { kind: 'cancel' }
  | { kind: 'newGame' }
  | { kind: 'setInteraction'; interaction: Interaction };

export interface UiButton {
  id: string;
  label: string;
  command: UiCommand;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'danger';
}

export interface Prompt {
  title: string;
  detail?: string;
}

export function isCompatible(s: GameState, human: PlayerId, interaction: Interaction): boolean {
  const pending = s.pending;
  const mine = !!pending && pending.kind !== 'gameOver' && pending.player === human;
  switch (interaction.kind) {
    case 'none':
      return !mine || pending.kind === 'priority' || pending.kind === 'mulligan';
    case 'target':
      return mine && pending.kind === 'priority';
    case 'attack':
      return mine && pending.kind === 'declareAttackers';
    case 'block':
      return mine && pending.kind === 'declareBlockers';
    case 'select':
      return mine && (pending.kind === 'bottom' || pending.kind === 'discard');
    case 'triggerTarget':
      return mine && pending.kind === 'chooseTargets';
  }
}

export function interactionFor(s: GameState, human: PlayerId): Interaction {
  const pending = s.pending;
  if (!pending || pending.kind === 'gameOver' || pending.player !== human) return { kind: 'none' };
  switch (pending.kind) {
    case 'declareAttackers':
      return { kind: 'attack', attackers: [] };
    case 'declareBlockers':
      return { kind: 'block', blocks: [], blocker: null };
    case 'bottom':
    case 'discard':
      return { kind: 'select', cards: [] };
    case 'chooseTargets':
      return { kind: 'triggerTarget', chosen: [] };
    default:
      return { kind: 'none' };
  }
}

export function actionsForCard(actions: Action[], card: CardId): Action[] {
  return actions.filter(
    (action) => (action.type === 'cast' || action.type === 'playLand' || action.type === 'activate') && action.card === card,
  );
}

function hasPrefix(targets: Target[], prefix: Target[]): boolean {
  return prefix.every((target, index) => {
    const other = targets[index];
    return other !== undefined && sameTarget(other, target);
  });
}

export function matchingTargetActions(actions: Action[], interaction: Interaction): Action[] {
  if (interaction.kind === 'target') {
    return actions.filter((action) => {
      if (interaction.mode === 'cast') return action.type === 'cast' && action.card === interaction.source && hasPrefix(action.targets, interaction.chosen);
      return (
        action.type === 'activate' &&
        action.card === interaction.source &&
        action.ability === interaction.ability &&
        hasPrefix(action.targets, interaction.chosen)
      );
    });
  }
  if (interaction.kind === 'triggerTarget') {
    return actions.filter((action) => action.type === 'chooseTargets' && hasPrefix(action.targets, interaction.chosen));
  }
  return [];
}

export function selectableTargets(actions: Action[], interaction: Interaction): Set<string> {
  const keys = new Set<string>();
  const chosen = interaction.kind === 'target' || interaction.kind === 'triggerTarget' ? interaction.chosen : [];
  for (const action of matchingTargetActions(actions, interaction)) {
    if (action.type !== 'cast' && action.type !== 'activate' && action.type !== 'chooseTargets') continue;
    const next = action.targets[chosen.length];
    if (next) keys.add(targetKey(next));
  }
  return keys;
}

function targetSpecsFor(s: GameState, interaction: Interaction): { specs: TargetSpec[]; source: CardId } | null {
  if (interaction.kind === 'target') {
    const def = defOf(s, interaction.source);
    const specs = interaction.mode === 'cast' ? (def.spell?.targets ?? []) : (def.activated?.[interaction.ability]?.targets ?? []);
    return { specs, source: interaction.source };
  }
  if (interaction.kind === 'triggerTarget' && s.pending?.kind === 'chooseTargets') {
    const triggerId = s.pending.trigger;
    const trigger = s.triggers.find((candidate) => candidate.id === triggerId);
    if (!trigger) return null;
    return { specs: triggeredAbility(defOf(s, trigger.source), trigger.ability)?.targets ?? [], source: trigger.source };
  }
  return null;
}

export interface TargetChoice {
  interaction: Interaction;
  action?: Action;
}

export function chooseTarget(actions: Action[], interaction: Interaction, target: Target): TargetChoice | null {
  if (interaction.kind !== 'target' && interaction.kind !== 'triggerTarget') return null;
  if (!selectableTargets(actions, interaction).has(targetKey(target))) return null;
  const chosen = [...interaction.chosen, target];
  const next = { ...interaction, chosen } as Interaction;
  const complete = matchingTargetActions(actions, next).find(
    (action) => (action.type === 'cast' || action.type === 'activate' || action.type === 'chooseTargets') && action.targets.length === chosen.length,
  );
  return complete ? { interaction: { kind: 'none' }, action: complete } : { interaction: next };
}

export function beginCardAction(action: Action): TargetChoice {
  if ((action.type === 'cast' || action.type === 'activate') && action.targets.length > 0) {
    return {
      interaction: {
        kind: 'target',
        source: action.card,
        mode: action.type,
        ability: action.type === 'activate' ? action.ability : 0,
        chosen: [],
      },
    };
  }
  return { interaction: { kind: 'none' }, action };
}

export function toggleAttacker(s: GameState, interaction: Interaction, card: CardId): Interaction {
  if (interaction.kind !== 'attack' || !canAttack(s, card)) return interaction;
  const attackers = interaction.attackers.includes(card)
    ? interaction.attackers.filter((id) => id !== card)
    : [...interaction.attackers, card];
  return { kind: 'attack', attackers };
}

export function tapForBlock(s: GameState, human: PlayerId, interaction: Interaction, card: CardId): Interaction {
  if (interaction.kind !== 'block') return interaction;
  const options = blockOptions(s);
  const owner = s.cards[card]?.controller;
  if (owner === human) {
    if (interaction.blocks.some((block) => block.blocker === card)) {
      return { kind: 'block', blocks: interaction.blocks.filter((block) => block.blocker !== card), blocker: null };
    }
    if (!options[card]) return interaction;
    if (interaction.blocker === card) return { ...interaction, blocker: null };
    const attackers = options[card] ?? [];
    if (attackers.length === 1) {
      return { kind: 'block', blocks: [...interaction.blocks, { blocker: card, attacker: attackers[0] as CardId }], blocker: null };
    }
    return { ...interaction, blocker: card };
  }
  const blocker = interaction.blocker;
  if (blocker && options[blocker]?.includes(card)) {
    return { kind: 'block', blocks: [...interaction.blocks, { blocker, attacker: card }], blocker: null };
  }
  return interaction;
}

export function toggleSelected(interaction: Interaction, card: CardId, max: number): Interaction {
  if (interaction.kind !== 'select') return interaction;
  if (interaction.cards.includes(card)) return { kind: 'select', cards: interaction.cards.filter((id) => id !== card) };
  if (interaction.cards.length >= max) return interaction;
  return { kind: 'select', cards: [...interaction.cards, card] };
}

function describeStackTop(s: GameState, human: PlayerId): string | null {
  const top = s.stack.at(-1);
  if (!top) return null;
  const source = stackItemSource(top);
  const who = top.controller === human ? 'You' : s.players[top.controller].name;
  const verb = top.kind === 'spell' ? (top.controller === human ? 'cast' : 'casts') : top.controller === human ? 'activated' : 'uses';
  const what = top.kind === 'spell' ? cardName(s, source) : `${cardName(s, source)}'s ability`;
  const targets = top.targets.length ? ` → ${top.targets.map((target) => targetRef(s, target, human)).join(', ')}` : '';
  return `${who} ${verb} ${what}${targets}`;
}

export interface BarModel {
  prompt: Prompt;
  buttons: UiButton[];
}

function landsInHand(s: GameState, player: PlayerId): number {
  return s.players[player].hand.filter((id) => defOf(s, id).types.includes('land')).length;
}

export function barModel(
  s: GameState,
  human: PlayerId,
  interaction: Interaction,
  busy: boolean,
  recent?: string,
): BarModel {
  const pending = s.pending;
  const pass: Action = { type: 'pass', player: human };
  if (!pending) return { prompt: { title: '' }, buttons: [] };

  if (pending.kind === 'gameOver') {
    const title = pending.winner === null ? 'Draw' : pending.winner === human ? 'Victory' : 'Defeat';
    return {
      prompt: { title, detail: gameOverDetail(s, human) },
      buttons: [{ id: 'new-game', label: 'New game', command: { kind: 'newGame' }, tone: 'primary' }],
    };
  }

  if (pending.player !== human) {
    const opponent = s.players[pending.player].name;
    const detail =
      pending.kind === 'declareBlockers'
        ? `${opponent} is choosing blockers…`
        : pending.kind === 'declareAttackers'
          ? `${opponent} is deciding how to attack…`
          : pending.kind === 'mulligan'
            ? `${opponent} is looking at its opening hand…`
            : describeStackTop(s, human) ?? recent ?? `${opponent} is thinking…`;
    return { prompt: { title: busy ? `${opponent}'s move` : 'Waiting', detail }, buttons: [] };
  }

  if (interaction.kind === 'target' || interaction.kind === 'triggerTarget') {
    const info = targetSpecsFor(s, interaction);
    const spec = info?.specs[interaction.chosen.length];
    const title = `Choose ${spec ? targetPhrase(spec) : 'a target'}`;
    const detail = info ? `for ${cardName(s, info.source)}` : undefined;
    const buttons: UiButton[] =
      interaction.kind === 'target' ? [{ id: 'cancel', label: 'Cancel', command: { kind: 'cancel' }, tone: 'secondary' }] : [];
    return { prompt: { title, detail }, buttons };
  }

  switch (pending.kind) {
    case 'mulligan': {
      const ps = s.players[human];
      const lands = landsInHand(s, human);
      const size = ps.hand.length - ps.mulligans;
      return {
        prompt: {
          title: ps.mulligans === 0 ? 'Keep your opening hand?' : `Keep ${size} cards?`,
          detail: `${lands} land${lands === 1 ? '' : 's'} in hand${ps.mulligans ? ` · you will put ${ps.mulligans} on the bottom` : ''}`,
        },
        buttons: [
          { id: 'keep', label: 'Keep', command: { kind: 'dispatch', action: { type: 'keep', player: human } }, tone: 'primary' },
          ...(ps.mulligans < 6
            ? [
                {
                  id: 'mulligan',
                  label: 'Mulligan',
                  command: { kind: 'dispatch', action: { type: 'mulligan', player: human } } as UiCommand,
                  tone: 'secondary' as const,
                },
              ]
            : []),
        ],
      };
    }
    case 'bottom':
    case 'discard': {
      const chosen = interaction.kind === 'select' ? interaction.cards : [];
      const verb = pending.kind === 'bottom' ? 'put on the bottom' : 'discard';
      const action: Action =
        pending.kind === 'bottom'
          ? { type: 'bottom', player: human, cards: chosen }
          : { type: 'discard', player: human, cards: chosen };
      const cause = pending.kind === 'discard' && pending.source ? `${cardName(s, pending.source)} · ` : '';
      return {
        prompt: {
          title: `Choose ${pending.count} card${pending.count === 1 ? '' : 's'} to ${verb}`,
          detail: `${cause}${chosen.length}/${pending.count} selected`,
        },
        buttons: [
          {
            id: 'confirm-cards',
            label: pending.kind === 'bottom' ? 'Put on bottom' : 'Discard',
            command: { kind: 'dispatch', action },
            disabled: chosen.length !== pending.count,
            tone: 'primary',
          },
        ],
      };
    }
    case 'declareAttackers': {
      const attackers = interaction.kind === 'attack' ? interaction.attackers : [];
      const eligible = eligibleAttackers(s);
      const buttons: UiButton[] = [
        {
          id: 'confirm-attack',
          label: attackers.length ? `Attack (${attackers.length})` : 'No attack',
          command: { kind: 'dispatch', action: { type: 'declareAttackers', player: human, attackers } },
          tone: 'primary',
        },
      ];
      if (eligible.length > 1 && attackers.length < eligible.length) {
        buttons.push({
          id: 'attack-all',
          label: 'All',
          command: { kind: 'setInteraction', interaction: { kind: 'attack', attackers: [...eligible] } },
          tone: 'secondary',
        });
      }
      return { prompt: { title: 'Choose attackers', detail: 'Tap creatures to attack with them' }, buttons };
    }
    case 'declareBlockers': {
      const blocks = interaction.kind === 'block' ? interaction.blocks : [];
      const error = blocksError(s, blocks);
      const attackers = s.combat?.attackers ?? [];
      const detail =
        interaction.kind === 'block' && interaction.blocker
          ? `Now tap the attacker ${cardName(s, interaction.blocker)} should block`
          : error ?? `${s.players[s.activePlayer].name} attacks with ${attackers.map((id) => cardName(s, id)).join(', ')}. Tap your creature, then an attacker`;
      return {
        prompt: { title: 'Choose blockers', detail },
        buttons: [
          {
            id: 'confirm-blocks',
            label: blocks.length ? `Block (${blocks.length})` : 'No blocks',
            command: { kind: 'dispatch', action: { type: 'declareBlockers', player: human, blocks } },
            disabled: error !== null,
            tone: 'primary',
          },
        ],
      };
    }
    case 'chooseTargets':
      return { prompt: { title: 'Choose a target' }, buttons: [] };
    case 'priority':
      return priorityBar(s, human, pass);
  }
}

function priorityBar(s: GameState, human: PlayerId, pass: Action): BarModel {
  const top = s.stack.at(-1);
  if (top && top.controller !== human) {
    return {
      prompt: { title: describeStackTop(s, human) ?? 'Respond?', detail: 'Cast an instant in response, or let it resolve' },
      buttons: [{ id: 'resolve', label: 'Let it resolve', command: { kind: 'dispatch', action: pass }, tone: 'primary' }],
    };
  }
  if (top) {
    return {
      prompt: { title: describeStackTop(s, human) ?? 'Waiting', detail: 'Pass to let it resolve' },
      buttons: [{ id: 'resolve', label: 'Resolve', command: { kind: 'dispatch', action: pass }, tone: 'primary' }],
    };
  }
  const myTurn = s.activePlayer === human;
  if (myTurn && s.step === 'main1') {
    const canAttackNow = s.players[human].battlefield.some((id) => canAttack(s, id));
    const buttons: UiButton[] = canAttackNow
      ? [
          { id: 'to-combat', label: 'To combat', command: { kind: 'dispatch', action: pass }, tone: 'primary' },
          { id: 'end-turn', label: 'End turn', command: { kind: 'endTurn' }, tone: 'secondary' },
        ]
      : [{ id: 'end-turn', label: 'End turn', command: { kind: 'endTurn' }, tone: 'primary' }];
    return { prompt: { title: 'Your main phase', detail: mainPhaseHint(s) }, buttons };
  }
  if (myTurn && s.step === 'main2') {
    return {
      prompt: { title: 'Your second main phase', detail: mainPhaseHint(s) },
      buttons: [{ id: 'end-turn', label: 'End turn', command: { kind: 'endTurn' }, tone: 'primary' }],
    };
  }
  const attackers = s.combat?.attackers ?? [];
  const names = attackers.map((id) => cardName(s, id)).join(', ');
  const active = s.players[s.activePlayer].name;
  const step = STEP_NAMES[s.step].toLowerCase();
  let prompt: Prompt = { title: myTurn ? `Your ${step}` : `${active}'s ${step}`, detail: 'You can cast instants now' };
  if (s.step === 'declareAttackers') {
    prompt = { title: `${myTurn ? 'You attack' : `${active} attacks`} with ${names}`, detail: 'Cast an instant before blocks, or continue' };
  } else if (s.step === 'declareBlockers') {
    const blocked = s.combat?.blocks.length ?? 0;
    prompt = {
      title: blocked ? 'Blockers declared' : 'No blockers',
      detail: 'Last chance for combat tricks before damage',
    };
  }
  return {
    prompt,
    buttons: [{ id: 'continue', label: 'Continue', command: { kind: 'dispatch', action: pass }, tone: 'primary' }],
  };
}

function mainPhaseHint(s: GameState): string {
  const actions = getLegalActions(s);
  const land = actions.some((action) => action.type === 'playLand');
  const spell = actions.some((action) => action.type === 'cast' || action.type === 'activate');
  if (land && spell) return 'Play a land, cast spells';
  if (land) return 'You can play a land';
  if (spell) return 'You can cast spells';
  return 'Nothing left to play';
}

function gameOverDetail(s: GameState, human: PlayerId): string {
  const pending = s.pending;
  if (pending?.kind !== 'gameOver') return '';
  const loser = pending.winner === null ? null : pending.winner === 0 ? 1 : 0;
  const who = loser === null ? '' : loser === human ? 'You' : s.players[loser].name;
  switch (pending.reason) {
    case 'life':
      return loser === null ? 'Both players fell to 0 life' : `${who} reached 0 life on turn ${s.turn}`;
    case 'decked':
      return `${who} tried to draw from an empty library`;
    case 'concede':
      return `${who} conceded`;
    case 'turnLimit':
      return 'The turn limit was reached';
  }
}

export function combatNumbers(s: GameState, blocks: Block[]): Map<CardId, number> {
  const numbers = new Map<CardId, number>();
  (s.combat?.attackers ?? []).forEach((attacker, index) => numbers.set(attacker, index + 1));
  for (const block of blocks) {
    const number = numbers.get(block.attacker);
    if (number !== undefined) numbers.set(block.blocker, number);
  }
  return numbers;
}
