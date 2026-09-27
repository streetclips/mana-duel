import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren, CSSProperties } from 'preact';
import type { GameController } from '../app/controller';
import {
  blockOptions,
  canAttack,
  creaturesOf,
  formatModifier,
  getDeck,
  targetKey,
  type Action,
  type CardId,
  type GameEvent,
  type GameState,
  type PlayerId,
  type Target,
} from '../engine';
import { fitCardScale, type CardSlot } from './layout';
import { HandCard, PermanentCard, type CardFlags, type CardFx } from './components/Card';
import { ActionBar, CenterStrip, Lands, PlayerBar } from './components/Board';
import { DeckViewer } from './components/DeckViewer';
import { CardSheet, GameOverModal, LogIcon, LogPanel, Menu, MenuIcon } from './components/Overlays';
import {
  actionsForCard,
  barModel,
  beginCardAction,
  chooseTarget,
  combatNumbers,
  interactionFor,
  isCompatible,
  selectableTargets,
  tapForBlock,
  toggleAttacker,
  toggleSelected,
  type Interaction,
  type UiCommand,
} from './model';
import { useControllerVersion } from './useController';

interface GameProps {
  controller: GameController;
  onHome: () => void;
}

interface Effects {
  cards: Map<CardId, CardFx>;
  players: Map<PlayerId, { key: number; text: string; kind: 'minus' | 'plus' }>;
}

function effectsFrom(events: GameEvent[], key: number): Effects {
  const cards = new Map<CardId, CardFx>();
  const players = new Map<PlayerId, { key: number; text: string; kind: 'minus' | 'plus' }>();
  const damage = new Map<CardId, number>();
  const life = new Map<PlayerId, number>();
  for (const event of events) {
    if (event.t === 'damage') {
      if ('card' in event.target) damage.set(event.target.card, (damage.get(event.target.card) ?? 0) + event.amount);
    } else if (event.t === 'life') {
      life.set(event.player, (life.get(event.player) ?? 0) + event.delta);
    } else if (event.t === 'pump') {
      const shrink = event.power < 0 || event.toughness < 0;
      cards.set(event.card, {
        key,
        flash: shrink ? 'damage' : 'cast',
        float: formatModifier(event.power, event.toughness),
        floatKind: shrink ? 'minus' : 'plus',
      });
    } else if (event.t === 'activate' || event.t === 'trigger') {
      if (!cards.has(event.card)) cards.set(event.card, { key, flash: 'cast' });
    }
  }
  for (const [player, delta] of life) {
    if (delta > 0) players.set(player, { key, text: `+${delta}`, kind: 'plus' });
    else if (delta < 0) players.set(player, { key, text: `−${-delta}`, kind: 'minus' });
  }
  for (const [id, amount] of damage) cards.set(id, { key, flash: 'damage', float: `−${amount}`, floatKind: 'minus' });
  return { cards, players };
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function useHandOverlap(count: number): { ref: { current: HTMLDivElement | null }; style: CSSProperties } {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (): void => setWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const card = ref.current?.querySelector<HTMLElement>('.hand-card');
  const cardWidth = card?.offsetWidth ?? 80;
  const available = Math.max(0, width - 20);
  const overlap = count <= 1 || width === 0 ? 6 : Math.min(6, (available - count * cardWidth) / (count - 1));
  return { ref, style: { '--overlap': `${overlap}px` } as CSSProperties };
}

const ATTACK_OFFSET = 16;

function Battlefield({ s, player, children }: { s: GameState; player: PlayerId; children: ComponentChildren }) {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = (): void => {
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft || '0') - parseFloat(style.paddingRight || '0');
      const height = element.clientHeight - parseFloat(style.paddingTop || '0') - parseFloat(style.paddingBottom || '0');
      setBox((previous) => (previous.width === width && previous.height === height ? previous : { width, height }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const slots: CardSlot[] = creaturesOf(s, player).map((id) => {
    const inCombat = s.combat?.attackers.includes(id) || s.combat?.blocks.some((block) => block.blocker === id);
    return { sideways: Boolean(s.cards[id]?.tapped) && !inCombat };
  });
  const root = getComputedStyle(document.documentElement);
  const cardWidth = parseFloat(root.getPropertyValue('--card-w')) || 68;
  const cardHeight = parseFloat(root.getPropertyValue('--card-h')) || 94;
  const scale = fitCardScale(box.width, box.height - ATTACK_OFFSET, slots, cardWidth, cardHeight);
  const style =
    scale < 1
      ? ({ '--card-w': `${cardWidth * scale}px`, '--card-h': `${cardHeight * scale}px`, '--s': String(scale) } as CSSProperties)
      : undefined;
  return (
    <div class="battlefield" data-testid={`battlefield-${player}`} data-scale={scale} ref={ref} style={style}>
      {children}
    </div>
  );
}

export function Game({ controller, onHome }: GameProps) {
  useControllerVersion(controller);
  const s = controller.state;
  const human = controller.human;
  const opponent: PlayerId = human === 0 ? 1 : 0;
  const pending = s.pending;
  const decisionKey = `${s.seed}|${s.actionCount}|${pending?.kind}|${pending && 'player' in pending ? pending.player : ''}`;

  const [interaction, setInteraction] = useState<Interaction>(() => interactionFor(s, human));
  const [inspected, setInspected] = useState<CardId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [decksOpen, setDecksOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gameOverHidden, setGameOverHidden] = useState(false);

  useEffect(() => {
    setInteraction(interactionFor(controller.state, human));
    setInspected(null);
  }, [decisionKey]);

  useEffect(() => {
    if (pending?.kind !== 'gameOver') setGameOverHidden(false);
  }, [pending?.kind]);

  useEffect(() => {
    controller.start();
  }, [controller]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const current = isCompatible(s, human, interaction) ? interaction : interactionFor(s, human);
  const actions = useMemo(() => controller.legalActions(), [s, controller.autoplay]);
  const targets = useMemo(() => selectableTargets(actions, current), [actions, current]);
  const bar = barModel(s, human, current, controller.busy, controller.log.at(-1)?.text);
  const effects = useMemo(() => effectsFrom(controller.lastEvents, s.actionCount), [s.actionCount, s.seed]);
  const hand = s.players[human].hand;
  const overlap = useHandOverlap(hand.length);

  const playable = useMemo(() => {
    const ids = new Set<CardId>();
    for (const action of actions) {
      if (action.type === 'playLand' || action.type === 'cast' || action.type === 'activate') ids.add(action.card);
    }
    return ids;
  }, [actions]);

  const send = (action: Action): void => {
    const result = controller.dispatch(action);
    if (!result.ok) setToast(capitalize(result.error));
  };

  const run = (command: UiCommand): void => {
    switch (command.kind) {
      case 'dispatch':
        send(command.action);
        return;
      case 'endTurn': {
        const result = controller.endTurn();
        if (!result.ok) setToast(capitalize(result.error));
        return;
      }
      case 'cancel':
        setInteraction(interactionFor(s, human));
        return;
      case 'newGame':
        controller.newGame();
        return;
      case 'setInteraction':
        setInteraction(command.interaction);
        return;
    }
  };

  const pickTarget = (target: Target): boolean => {
    const choice = chooseTarget(actions, current, target);
    if (!choice) return false;
    setInteraction(choice.interaction);
    if (choice.action) send(choice.action);
    return true;
  };

  const startCardAction = (action: Action): void => {
    setInspected(null);
    const choice = beginCardAction(action);
    setInteraction(choice.interaction);
    if (choice.action) send(choice.action);
  };

  const targeting = current.kind === 'target' || current.kind === 'triggerTarget';

  const onPermanentTap = (id: CardId): void => {
    if (targeting) {
      if (!pickTarget({ card: id })) setInspected(id);
      return;
    }
    if (current.kind === 'attack') {
      if (s.cards[id]?.controller === human && canAttack(s, id)) setInteraction(toggleAttacker(s, current, id));
      else setInspected(id);
      return;
    }
    if (current.kind === 'block') {
      const next = tapForBlock(s, human, current, id);
      if (next !== current) setInteraction(next);
      else setInspected(id);
      return;
    }
    setInspected(id);
  };

  const onHandTap = (id: CardId): void => {
    if (current.kind === 'select' && (pending?.kind === 'bottom' || pending?.kind === 'discard')) {
      setInteraction(toggleSelected(current, id, pending.count));
      return;
    }
    if (targeting) return;
    setInspected(id);
  };

  const onPlayerTap = (player: PlayerId): void => {
    if (targeting) pickTarget({ player });
  };

  const onStackTap = (card: CardId): void => {
    if (targeting) {
      if (!pickTarget({ card })) setInspected(card);
      return;
    }
    setInspected(card);
  };

  const decks = controller.decks;
  const deckName = (player: PlayerId): string | undefined => (decks ? getDeck(decks[player]).name : undefined);

  const attackNumbers = combatNumbers(s, current.kind === 'block' ? current.blocks : (s.combat?.blocks ?? []));
  const blockChoices = current.kind === 'block' ? blockOptions(s) : {};
  const selectedBlocker = current.kind === 'block' ? current.blocker : null;

  const permanentFlags = (id: CardId): CardFlags => {
    const mine = s.cards[id]?.controller === human;
    const flags: CardFlags = {};
    const attacking = s.combat?.attackers.includes(id) || (current.kind === 'attack' && current.attackers.includes(id));
    const blocks = current.kind === 'block' ? current.blocks : (s.combat?.blocks ?? []);
    const blocking = blocks.some((block) => block.blocker === id);
    if (attacking) flags.attacking = true;
    if (blocking) flags.blocking = true;
    const number = attackNumbers.get(id);
    if (number !== undefined && (attacking || blocking) && (s.combat?.attackers.length ?? 0) > 0) {
      flags.badge = { kind: attacking ? 'attack' : 'block', value: number };
    }
    if (targeting) {
      if (targets.has(id)) flags.targetable = true;
      else flags.dim = true;
    } else if (current.kind === 'attack') {
      if (mine && canAttack(s, id)) {
        flags.selectable = true;
        flags.selected = current.attackers.includes(id);
      }
    } else if (current.kind === 'block') {
      if (mine && blockChoices[id]) {
        flags.selectable = true;
        flags.selected = selectedBlocker === id;
      }
      if (!mine && selectedBlocker && blockChoices[selectedBlocker]?.includes(id)) flags.targetable = true;
    } else if (mine && playable.has(id)) {
      flags.playable = true;
    }
    return flags;
  };

  const handFlags = (id: CardId): CardFlags => {
    if (current.kind === 'select') return { selectable: true, selected: current.cards.includes(id) };
    if (targeting) return { dim: true, selected: current.kind === 'target' && current.source === id };
    return { playable: playable.has(id) };
  };

  const renderSide = (player: PlayerId) => (
    <Battlefield s={s} player={player}>
      {creaturesOf(s, player).map((id) => (
        <PermanentCard
          key={id}
          s={s}
          id={id}
          flags={permanentFlags(id)}
          fx={effects.cards.get(id)}
          onTap={() => onPermanentTap(id)}
          onInspect={() => setInspected(id)}
        />
      ))}
    </Battlefield>
  );

  const decider = pending && pending.kind !== 'gameOver' ? pending.player : null;
  const thinking = controller.busy && decider !== null && (decider !== human || controller.autoplay);
  const gameOver = pending?.kind === 'gameOver';

  return (
    <div
      class="game"
      data-testid="game"
      data-step={s.step}
      data-turn={s.turn}
      data-pending={pending?.kind}
      data-decider={decider ?? undefined}
      data-interaction={current.kind}
    >
      <div class="top-actions">
        <button type="button" class="icon-btn" aria-label="Game log" data-testid="btn-log" onClick={() => setLogOpen(true)}>
          <LogIcon />
        </button>
        <button type="button" class="icon-btn" aria-label="Menu" data-testid="btn-menu" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
      </div>

      <section class="side opponent" aria-label={`${s.players[opponent].name}'s side`}>
        <PlayerBar
          s={s}
          player={opponent}
          human={human}
          deckName={deckName(opponent)}
          targetable={targeting && targets.has(targetKey({ player: opponent }))}
          lifeFx={effects.players.get(opponent)}
          onTap={() => onPlayerTap(opponent)}
        />
        <Lands s={s} player={opponent} />
        {renderSide(opponent)}
      </section>

      <CenterStrip s={s} human={human} bar={bar} targets={targeting ? targets : null} onStackTap={onStackTap} />

      <section class="side me" aria-label="Your side">
        {renderSide(human)}
        <Lands s={s} player={human} />
        <PlayerBar
          s={s}
          player={human}
          human={human}
          deckName={deckName(human)}
          targetable={targeting && targets.has(targetKey({ player: human }))}
          lifeFx={effects.players.get(human)}
          onTap={() => onPlayerTap(human)}
        />
      </section>

      <ActionBar bar={bar} thinking={thinking} opponentName={s.players[decider ?? opponent].name} onCommand={run} />

      <div class="hand" data-testid="hand" ref={overlap.ref} style={overlap.style}>
        {hand.map((id) => (
          <HandCard key={id} s={s} id={id} flags={handFlags(id)} onTap={() => onHandTap(id)} onInspect={() => setInspected(id)} />
        ))}
      </div>

      {inspected && s.cards[inspected] && (
        <CardSheet
          s={s}
          id={inspected}
          human={human}
          actions={current.kind === 'none' ? actionsForCard(actions, inspected) : []}
          onAction={startCardAction}
          onClose={() => setInspected(null)}
        />
      )}

      {gameOver && !gameOverHidden && !logOpen && !decksOpen && (
        <GameOverModal
          s={s}
          human={human}
          title={bar.prompt.title}
          detail={bar.prompt.detail}
          onNewGame={() => controller.newGame()}
          onLog={() => setLogOpen(true)}
          onClose={() => setGameOverHidden(true)}
        />
      )}

      {menuOpen && (
        <Menu
          gameOver={gameOver}
          fast={controller.aiDelayMs < 300}
          onLog={() => {
            setMenuOpen(false);
            setLogOpen(true);
          }}
          onDecks={
            decks
              ? () => {
                  setMenuOpen(false);
                  setDecksOpen(true);
                }
              : undefined
          }
          onToggleSpeed={() => {
            controller.setAiDelay(controller.aiDelayMs < 300 ? 650 : 150);
            setMenuOpen(false);
          }}
          onNewGame={() => {
            setMenuOpen(false);
            controller.newGame();
          }}
          onHome={() => {
            setMenuOpen(false);
            onHome();
          }}
          onConcede={() => {
            setMenuOpen(false);
            controller.concede();
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {logOpen && <LogPanel entries={controller.log} onClose={() => setLogOpen(false)} />}

      {decksOpen && decks && (
        <DeckViewer
          tabs={([human, opponent] as PlayerId[]).map((player) => ({
            key: String(player),
            label: `${player === human ? 'You' : s.players[player].name} · ${getDeck(decks[player]).name}`,
            deck: getDeck(decks[player]),
          }))}
          onClose={() => setDecksOpen(false)}
        />
      )}

      {toast && (
        <div class="toast" role="status" data-testid="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
