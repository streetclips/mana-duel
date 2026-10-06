import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren, CSSProperties } from 'preact';
import { DEFAULT_AI_DELAY_MS, type GameController } from '../app/controller';
import {
  blockOptions,
  canAttack,
  creaturesOf,
  resolveDeck,
  targetKey,
  type Action,
  type CardId,
  type GameState,
  type PlayerId,
  type Target,
} from '../engine';
import { saveAutoPass } from './autoPassChoice';
import { cssVars } from './cardInfo';
import { FxTracker, fxNow, fxTime, fxView, withGhosts, type BattlefieldItem } from './fx';
import { MIN_CARD_SCALE, fitCardScale, type CardSlot } from './layout';
import { playMotions } from './motion';
import { GhostCard, HandCard, PermanentCard, type CardFlags } from './components/Card';
import { ActionBar, CenterStrip, Lands, PlayerBar, RelicBadges } from './components/Board';
import { DeckViewer } from './components/DeckViewer';
import { FxLayer } from './components/Fx';
import { CardSheet, CloseIcon, GameOverModal, LogPanel, Menu, MenuIcon } from './components/Overlays';
import type { AudioToggles } from './components/SoundToggles';
import { commonText } from './text/common';
import { gameText } from './text/game';
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
  type UiButton,
  type UiCommand,
} from './model';
import { useControllerVersion } from './useController';

export interface ModeView {
  badge: string;
  outcome: string | null;
  continueLabel: string;
  homeLabel: string;
  onContinue: () => void;
}

interface GameProps {
  controller: GameController;
  audio?: AudioToggles;
  mode?: ModeView;
  onHome: () => void;
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
  return { ref, style: { '--overlap': `${overlap}px` } };
}

const ATTACK_OFFSET = 16;

interface BattlefieldProps {
  s: GameState;
  player: PlayerId;
  items: BattlefieldItem[];
  children: ComponentChildren;
}

function Battlefield({ s, player, items, children }: BattlefieldProps) {
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
  const slots: CardSlot[] = items.map((item) => {
    if ('ghost' in item) return { sideways: false };
    const id = item.id;
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
    <div
      class={`battlefield${scale <= MIN_CARD_SCALE ? ' crowded' : ''}`}
      data-testid={`battlefield-${player}`}
      data-scale={scale}
      ref={ref}
      style={style}
    >
      {children}
    </div>
  );
}

export function Game({ controller, audio, mode, onHome }: GameProps) {
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
  const [llmNoticeHidden, setLlmNoticeHidden] = useState(false);
  const [tracker] = useState(() => new FxTracker());
  const [, setFxTick] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const played = useRef(new Set<string>());

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
    setLlmNoticeHidden(false);
  }, [controller.session]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const current = isCompatible(s, human, interaction) ? interaction : interactionFor(s, human);
  const actions = useMemo(() => controller.legalActions(), [s, controller.autoplay]);
  const targets = useMemo(() => selectableTargets(actions, current), [actions, current]);
  const plainBar = barModel(s, human, current, controller.busy, controller.lastEventText());
  const continueButton: UiButton | null = mode ? { id: 'mode-next', label: mode.continueLabel, command: { kind: 'newGame' }, tone: 'primary' } : null;
  const bar = continueButton && pending?.kind === 'gameOver' ? { ...plainBar, buttons: [continueButton] } : plainBar;
  const hand = s.players[human].hand;
  const overlap = useHandOverlap(hand.length);

  const entries = tracker.update(controller.session, controller.fx, fxNow(), controller.fxSpeed);
  const fx = fxView(entries, s, human, controller.autoplay, tracker.lastSeq);
  const fxExpiry = tracker.nextExpiry(controller.fxSpeed);
  const aimed = useMemo(() => new Set(s.stack.flatMap((item) => item.targets.map(targetKey))), [s]);

  useEffect(() => {
    if (fxExpiry === null) return;
    const timer = setTimeout(() => setFxTick((tick) => tick + 1), Math.max(0, fxExpiry - fxNow()) + 30);
    return () => clearTimeout(timer);
  }, [fxExpiry]);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    const fresh = entries.filter((entry) => !played.current.has(entry.key));
    played.current = new Set(entries.map((entry) => entry.key));
    if (fresh.length > 0) playMotions(element, fresh, human, fxTime(controller.fxSpeed));
  });

  const playable = useMemo(() => {
    const ids = new Set<CardId>();
    for (const action of actions) {
      if (action.type === 'playLand' || action.type === 'cast' || action.type === 'activate') ids.add(action.card);
    }
    return ids;
  }, [actions]);

  const usable = useMemo(() => {
    const abilities = new Map<CardId, number[]>();
    for (const action of actions) {
      if (action.type !== 'activate') continue;
      const indices = abilities.get(action.card) ?? [];
      if (!indices.includes(action.ability)) abilities.set(action.card, [...indices, action.ability]);
    }
    return abilities;
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
        if (mode) mode.onContinue();
        else controller.newGame();
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
  const deckName = (player: PlayerId): string | undefined => (decks ? resolveDeck(decks[player]).name : undefined);

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
    if (aimed.has(id)) flags.aimed = true;
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
      flags.usable = usable.get(id);
    }
    return flags;
  };

  const handFlags = (id: CardId): CardFlags => {
    if (current.kind === 'select') return { selectable: true, selected: current.cards.includes(id) };
    if (targeting) return { dim: true, selected: current.kind === 'target' && current.source === id };
    return { playable: playable.has(id) };
  };

  const renderSide = (player: PlayerId) => {
    const items = withGhosts(creaturesOf(s, player), fx.ghosts.get(player));
    return (
      <Battlefield s={s} player={player} items={items}>
        {items.map((item) =>
          'ghost' in item ? (
            <GhostCard key={`ghost-${item.ghost.key}`} ghost={item.ghost} fx={fx.cards.get(item.ghost.card)} rise={player !== human} />
          ) : (
            <PermanentCard
              key={item.id}
              s={s}
              id={item.id}
              flags={permanentFlags(item.id)}
              fx={fx.cards.get(item.id)}
              onTap={() => onPermanentTap(item.id)}
              onInspect={() => setInspected(item.id)}
            />
          ),
        )}
      </Battlefield>
    );
  };

  const text = gameText();
  const decider = pending && pending.kind !== 'gameOver' ? pending.player : null;
  const thinking = controller.busy && decider !== null && (decider !== human || controller.autoplay);
  const gameOver = pending?.kind === 'gameOver';
  const llmModel = controller.opponent.kind === 'llm' ? controller.opponent.model : null;
  const llmEffort =
    controller.opponent.kind === 'llm' && controller.opponent.effort ? ` · ${text.effort(commonText().efforts[controller.opponent.effort].toLowerCase())}` : '';
  const llmState = llmModel ? (controller.llmUnavailable ? 'unavailable' : controller.llmThinking ? 'thinking' : 'ready') : undefined;
  const thinkerName = s.players[decider ?? opponent].name;
  const thinkerLabel = controller.llmThinking && llmModel ? `${thinkerName} · ${llmModel.split('/').pop()}` : thinkerName;

  return (
    <div
      class="game"
      ref={root}
      data-testid="game"
      data-step={s.step}
      data-turn={s.turn}
      data-pending={pending?.kind}
      data-decider={decider ?? undefined}
      data-interaction={current.kind}
      data-fx-speed={controller.fxSpeed}
      data-fx-seq={fx.seq}
      data-llm={llmState}
      style={cssVars({ '--fx-time': String(fxTime(controller.fxSpeed)) })}
    >
      <div class="top-actions">
        <button type="button" class="icon-btn" aria-label={text.menu} data-testid="btn-menu" onClick={() => setMenuOpen(true)}>
          <MenuIcon />
        </button>
      </div>

      <section class="side opponent" aria-label={text.opponentSide}>
        <PlayerBar
          s={s}
          player={opponent}
          human={human}
          deckName={deckName(opponent)}
          badge={mode?.badge}
          tag={
            llmModel
              ? { text: 'LLM', title: controller.llmUnavailable ? text.llmUnavailable(controller.llmUnavailable) : `OpenRouter · ${llmModel}${llmEffort}` }
              : undefined
          }
          targetable={targeting && targets.has(targetKey({ player: opponent }))}
          aimed={aimed.has(targetKey({ player: opponent }))}
          fx={fx.players.get(opponent)}
          onTap={() => onPlayerTap(opponent)}
        />
        <div class="lands-row">
          <Lands s={s} player={opponent} cardFx={fx.cards} />
          <RelicBadges s={s} player={opponent} human={human} cardFx={fx.cards} onRelic={setInspected} />
        </div>
        {renderSide(opponent)}
      </section>

      <CenterStrip
        s={s}
        human={human}
        bar={bar}
        targets={targeting ? targets : null}
        aimed={aimed}
        fx={fx}
        onStackTap={onStackTap}
      />

      <section class="side me" aria-label={text.yourSide}>
        {renderSide(human)}
        <div class="lands-row">
          <Lands s={s} player={human} cardFx={fx.cards} />
          <RelicBadges s={s} player={human} human={human} cardFx={fx.cards} onRelic={setInspected} />
        </div>
        <PlayerBar
          s={s}
          player={human}
          human={human}
          deckName={deckName(human)}
          targetable={targeting && targets.has(targetKey({ player: human }))}
          aimed={aimed.has(targetKey({ player: human }))}
          fx={fx.players.get(human)}
          onTap={() => onPlayerTap(human)}
        />
      </section>

      <ActionBar bar={bar} thinking={thinking} opponentName={thinkerLabel} onCommand={run} />

      <div class="hand" data-testid="hand" ref={overlap.ref} style={overlap.style}>
        {hand.map((id) => (
          <HandCard
            key={id}
            s={s}
            id={id}
            flags={handFlags(id)}
            fx={fx.cards.get(id)}
            onTap={() => onHandTap(id)}
            onInspect={() => setInspected(id)}
          />
        ))}
      </div>

      <FxLayer s={s} human={human} fx={fx} />

      {controller.llmUnavailable && !llmNoticeHidden && (
        <div class="llm-notice" role="status" data-testid="llm-notice">
          <span data-testid="llm-notice-text">{text.llmNotice(controller.llmUnavailable)}</span>
          <button type="button" class="icon-btn" aria-label={text.hide} data-testid="llm-notice-hide" onClick={() => setLlmNoticeHidden(true)}>
            <CloseIcon />
          </button>
        </div>
      )}

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
          detail={mode?.outcome ?? bar.prompt.detail}
          onNewGame={() => controller.newGame()}
          onHome={onHome}
          continueLabel={mode?.continueLabel}
          onContinue={mode?.onContinue}
          onLog={() => setLogOpen(true)}
          onClose={() => setGameOverHidden(true)}
        />
      )}

      {menuOpen && (
        <Menu
          gameOver={gameOver}
          fast={controller.aiDelayMs < 300}
          autoPass={controller.autoPass}
          audio={
            audio && {
              music: audio.music,
              sfx: audio.sfx,
              onToggleMusic: () => {
                setMenuOpen(false);
                audio.onToggleMusic();
              },
              onToggleSfx: () => {
                setMenuOpen(false);
                audio.onToggleSfx();
              },
            }
          }
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
            controller.setAiDelay(controller.aiDelayMs < 300 ? DEFAULT_AI_DELAY_MS : 150);
            setMenuOpen(false);
          }}
          onToggleAutoPass={() => {
            const on = !controller.autoPass;
            saveAutoPass(on);
            setMenuOpen(false);
            controller.setAutoPass(on);
          }}
          onNewGame={
            mode
              ? undefined
              : () => {
                  setMenuOpen(false);
                  controller.newGame();
                }
          }
          onHome={() => {
            setMenuOpen(false);
            onHome();
          }}
          homeLabel={mode?.homeLabel}
          onConcede={() => {
            setMenuOpen(false);
            controller.concede();
          }}
          onClose={() => setMenuOpen(false)}
        />
      )}

      {logOpen && <LogPanel key={controller.session} s={s} human={human} entries={controller.log} onClose={() => setLogOpen(false)} />}

      {decksOpen && decks && (
        <DeckViewer
          tabs={([human, opponent] as PlayerId[]).map((player) => ({
            key: String(player),
            label: `${player === human ? commonText().you : s.players[player].name} · ${resolveDeck(decks[player]).name}`,
            deck: resolveDeck(decks[player]),
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
