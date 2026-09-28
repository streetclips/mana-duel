// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import type { ScenarioSpec } from '../../src/engine';
import { App } from '../../src/ui/App';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(scenario?: ScenarioSpec, options: { fxSpeed?: number; skipMulligans?: boolean } = {}) {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, ...options });
  if (scenario) controller.loadScenario(scenario);
  render(<App controller={controller} initialScreen="game" />);
  const run = (task: () => void): void => {
    act(task);
  };
  return { controller, run, settle: () => run(() => controller.settle()) };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);
const fxOf = (element: Element | null): string[] => element?.getAttribute('data-fx')?.split(' ') ?? [];
const slot = (card: string): HTMLElement | null => document.querySelector(`[data-slot="${card}"]`);
const motions = (element: Element | null): string[] => element?.getAnimations().map((animation) => animation.id) ?? [];

function castFromHand(card: string): void {
  fireEvent.click(byTestId(`card-${card}`));
  fireEvent.click(byTestId('sheet-cast'));
}

describe('animations of life totals', () => {
  it('pop the change beside the life total, which keeps showing only the number', () => {
    const { run, settle } = setup({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}] });
    castFromHand('snap');
    run(() => fireEvent.click(byTestId('player-1')));
    settle();
    expect(byTestId('life-1').textContent).toBe('18');
    expect(fxOf(byTestId('player-1'))).toContain('life');
    expect(byTestId('fx-life-1').textContent).toBe('−2');
    expect(motions(byTestId('player-1'))).toContain('fx-shake');
    expect(screen.queryByTestId('fx-hurt')).toBeNull();
  });

  it('flash the screen edge when you are the one losing life', () => {
    const { settle } = setup({
      activePlayer: 1,
      players: [{ life: 5 }, { hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }],
    });
    settle();
    expect(byTestId('life-0').textContent).toBe('3');
    expect(byTestId('fx-life-0').textContent).toBe('−2');
    expect(byTestId('fx-hurt').dataset.fx).toBe('hurt');
  });
});

describe('animations of combat', () => {
  it('make the attacker and its blocker strike each other and leave a ghost of the creature that died', () => {
    const { controller, run, settle } = setup({
      activePlayer: 1,
      players: [
        { hand: ['forest'], battlefield: [{ card: 'grove_tender', id: 'elf' }] },
        { battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] },
      ],
    });
    settle();
    expect(controller.state.pending).toEqual({ kind: 'declareBlockers', player: 0 });
    expect(fxOf(slot('rhino'))).toContain('attack');
    expect(slot('rhino')?.querySelector('.fx-ring.attack')).not.toBeNull();
    run(() => fireEvent.click(byTestId('card-elf')));
    run(() => fireEvent.click(byTestId('btn-confirm-blocks')));
    settle();
    expect(screen.queryByTestId('card-elf')).toBeNull();
    const ghost = byTestId('fx-ghost-elf');
    expect(fxOf(ghost)).toEqual(expect.arrayContaining(['strike', 'damage', 'dies']));
    expect(ghost.getAttribute('aria-hidden')).toBe('true');
    expect(fxOf(slot('rhino'))).toEqual(expect.arrayContaining(['strike', 'damage']));
    expect(byTestId('fx-float-rhino').textContent).toBe('−1');
    expect(motions(slot('rhino'))).toEqual(expect.arrayContaining(['fx-lunge', 'fx-shake']));
    expect(motions(slot('rhino')).filter((id) => id === 'fx-lunge')).toHaveLength(1);
    expect(motions(ghost)).toContain('fx-lunge');
    expect(byTestId('fx-life-0').textContent).toBe('−3');
  });
});

describe('animations of plays', () => {
  it('reveal the card the opponent casts and mark what it aims at', () => {
    const { controller, settle } = setup({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'verdant_surge', id: 'surge' }], battlefield: ['forest', { card: 'grove_tender', id: 'elf' }] },
        { hand: [{ card: 'magma_lance', id: 'lance' }], battlefield: ['mountain', 'mountain', 'mountain'] },
      ],
    });
    settle();
    expect(controller.state.stack).toHaveLength(1);
    const reveal = byTestId('fx-reveal');
    expect(reveal.dataset.def).toBe('magma_lance');
    expect(reveal.dataset.player).toBe('1');
    expect(reveal.textContent).toContain('AI casts');
    expect(reveal.textContent).toContain('→ your Grove Tender');
    expect(byTestId('card-elf').dataset.aimed).toBe('true');
    expect(byTestId(`stack-${controller.state.stack[0]?.id}`).dataset.fx).toBe('play');
  });

  it('reveal the land the opponent plays and pop it into its lands', () => {
    const { settle } = setup({ activePlayer: 1, players: [{ hand: ['forest'] }, { hand: [{ card: 'mountain', id: 'land' }] }] });
    settle();
    expect(byTestId('fx-reveal').dataset.def).toBe('mountain');
    expect(byTestId('fx-reveal').textContent).toContain('AI plays');
    expect(fxOf(byTestId('card-land'))).toContain('enter');
  });

  it('never reveal your own plays, but still pop them into place', () => {
    const { run, settle } = setup({ players: [{ hand: [{ card: 'ember_hound', id: 'hound' }, { card: 'mountain', id: 'land' }], battlefield: ['mountain'] }, {}] });
    fireEvent.click(byTestId('card-land'));
    run(() => fireEvent.click(byTestId('sheet-playLand')));
    expect(fxOf(byTestId('card-land'))).toContain('enter');
    castFromHand('hound');
    settle();
    expect(fxOf(slot('hound'))).toContain('enter');
    expect(screen.queryByTestId('fx-reveal')).toBeNull();
  });

  it('show a countered spell', () => {
    const { controller, run, settle } = setup({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    settle();
    castFromHand('tide');
    run(() => fireEvent.click(byTestId(`stack-${controller.state.stack[0]?.id}`)));
    settle();
    expect(byTestId('fx-reveal').dataset.fx).toBe('counter');
    expect(byTestId('fx-reveal').textContent).toContain('Countered');
  });
});

describe('animations of draws and turns', () => {
  it('announce your turn and slide the card you draw into your hand', () => {
    const { controller, settle } = setup({ activePlayer: 1, players: [{ library: [{ card: 'forest', id: 'top' }] }, {}] });
    settle();
    expect(controller.state.activePlayer).toBe(0);
    expect(byTestId('fx-turn').textContent).toContain('Your turn');
    expect(fxOf(byTestId('card-top'))).toEqual(['draw']);
  });

  it('show the opponent drawing, without revealing the card', () => {
    const { run, settle } = setup({ players: [{ hand: ['forest'], landsPlayed: 1 }, { library: [{ card: 'ember_snap', id: 'secret' }] }] });
    run(() => fireEvent.click(byTestId('btn-end-turn')));
    settle();
    expect(byTestId('fx-drawn-1').textContent).toBe('+1');
    expect(screen.queryByTestId('card-secret')).toBeNull();
  });

  it('deal the opening hand one card after another', () => {
    setup(undefined, { skipMulligans: true });
    const hand = screen.getAllByRole('button').filter((element) => element.dataset.zone === 'hand');
    expect(hand).toHaveLength(7);
    expect(hand.map((card) => fxOf(card))).toEqual(Array.from({ length: 7 }, () => ['draw']));
    expect(hand.map((card) => card.style.getPropertyValue('--fx-i'))).toEqual(['0', '1', '2', '3', '4', '5', '6']);
  });
});

describe('animation hooks', () => {
  it('stay on the page until a newer action animates something, and tell which action they belong to', () => {
    const { controller, run, settle } = setup({ players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}] });
    castFromHand('snap');
    run(() => fireEvent.click(byTestId('player-1')));
    settle();
    run(() => fireEvent.click(byTestId('btn-menu')));
    run(() => fireEvent.click(byTestId('btn-menu')));
    expect(fxOf(byTestId('player-1'))).toContain('life');
    expect(byTestId('game').dataset.fxSeq).toBe(String(controller.fxSeq));
  });

  it('are gone while animations are off', () => {
    const { controller, run, settle } = setup(
      { players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}] },
      { fxSpeed: 0 },
    );
    expect(byTestId('game').dataset.fxSpeed).toBe('0');
    castFromHand('snap');
    run(() => fireEvent.click(byTestId('player-1')));
    settle();
    expect(controller.fx.length).toBeGreaterThan(0);
    expect(document.querySelectorAll('[data-fx]')).toHaveLength(0);
    expect(motions(byTestId('player-1'))).toEqual([]);
  });

  it('follow the animation speed on the page', () => {
    const { controller, run } = setup({ players: [{}, {}] });
    run(() => controller.setFxSpeed(0.25));
    expect(byTestId('game').style.getPropertyValue('--fx-time')).toBe('4');
    expect(byTestId('game').dataset.fxSpeed).toBe('0.25');
  });
});
