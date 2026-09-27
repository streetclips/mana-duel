// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import type { ScenarioSpec } from '../../src/engine';
import { App } from '../../src/ui/App';

afterEach(() => {
  cleanup();
});

function setup(scenario?: ScenarioSpec, initialScreen: 'start' | 'game' = 'game') {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  if (scenario) controller.loadScenario(scenario);
  render(<App controller={controller} initialScreen={initialScreen} />);
  const settle = (): void => {
    act(() => controller.settle());
  };
  return { controller, settle };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);

function click(element: HTMLElement): void {
  fireEvent.click(element);
}

function playFromHand(card: string, button: 'sheet-cast' | 'sheet-playLand'): void {
  click(byTestId(`card-${card}`));
  click(byTestId(button));
}

describe('start screen', () => {
  it('shows the deck and starts a game', () => {
    const { settle } = setup(undefined, 'start');
    expect(byTestId('start-screen').textContent).toContain('Emberwild');
    click(byTestId('btn-play'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Keep your opening hand?');
    expect(within(byTestId('hand')).getAllByRole('button')).toHaveLength(7);
  });
});

describe('opening hand', () => {
  it('keeps and reaches the first main phase', () => {
    const { settle } = setup();
    click(byTestId('btn-keep'));
    settle();
    expect(byTestId('phase').textContent).toContain('Turn 1');
    expect(byTestId('prompt').textContent).toBe('Your main phase');
  });

  it('puts a card on the bottom after a mulligan', () => {
    const { controller, settle } = setup();
    click(byTestId('btn-mulligan'));
    click(byTestId('btn-keep'));
    expect(byTestId('prompt').textContent).toBe('Choose 1 card to put on the bottom');
    expect((byTestId('btn-confirm-cards') as HTMLButtonElement).disabled).toBe(true);
    const first = within(byTestId('hand')).getAllByRole('button')[0] as HTMLElement;
    click(first);
    expect((byTestId('btn-confirm-cards') as HTMLButtonElement).disabled).toBe(false);
    click(byTestId('btn-confirm-cards'));
    settle();
    expect(controller.state.players[0].hand).toHaveLength(6);
  });
});

describe('main phase', () => {
  it('plays a land from the card sheet', () => {
    const { controller } = setup({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    playFromHand('f1', 'sheet-playLand');
    expect(controller.state.cards.f1?.zone).toBe('battlefield');
    expect(within(byTestId('lands-0')).getByTestId('card-f1')).toBeTruthy();
  });

  it('casts a spell at a chosen target', () => {
    const { settle } = setup({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}],
    });
    playFromHand('snap', 'sheet-cast');
    expect(byTestId('prompt').textContent).toBe('Choose any target');
    expect(byTestId('player-1').dataset.targetable).toBe('true');
    click(byTestId('player-1'));
    settle();
    expect(byTestId('life-1').textContent).toContain('18');
  });

  it('can cancel targeting', () => {
    const { controller } = setup({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }, {}],
    });
    playFromHand('snap', 'sheet-cast');
    click(byTestId('btn-cancel'));
    expect(byTestId('prompt').textContent).toBe('Your main phase');
    expect(controller.state.stack).toHaveLength(0);
  });

  it('explains why a card cannot be played', () => {
    setup({ players: [{ hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest'] }, {}] });
    click(byTestId('card-rhino'));
    expect(byTestId('card-sheet').textContent).toContain('Not enough mana');
    expect(byTestId('card-sheet').textContent).toContain('Trample');
  });

  it('shows rules text and activates abilities from the battlefield', () => {
    const { controller, settle } = setup({
      players: [{ battlefield: [{ card: 'crag_dragon', id: 'dragon' }, 'mountain'] }, {}],
    });
    click(byTestId('card-dragon'));
    expect(byTestId('card-sheet').textContent).toContain('This creature gets +1/+0 until end of turn.');
    click(byTestId('sheet-activate'));
    settle();
    expect(controller.state.effects).toHaveLength(1);
    expect(byTestId('pt-dragon').textContent).toBe('5/4');
  });
});

describe('combat', () => {
  it('declares attackers by tapping creatures', () => {
    const { settle } = setup({ players: [{ battlefield: [{ card: 'ember_hound', id: 'hound' }] }, {}] });
    click(byTestId('btn-to-combat'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Choose attackers');
    expect(byTestId('btn-confirm-attack').textContent).toBe('No attack');
    click(byTestId('card-hound'));
    expect(byTestId('btn-confirm-attack').textContent).toBe('Attack (1)');
    click(byTestId('btn-confirm-attack'));
    settle();
    expect(byTestId('life-1').textContent).toContain('18');
  });

  it('declares blockers by tapping a blocker and then an attacker', () => {
    const { controller, settle } = setup({
      activePlayer: 1,
      players: [
        { battlefield: [{ card: 'canopy_spider', id: 'spider' }, { card: 'grove_tender', id: 'elf' }] },
        { battlefield: [{ card: 'cinderwing_drake', id: 'drake' }, 'mountain'] },
      ],
    });
    settle();
    if (controller.state.pending?.kind !== 'declareBlockers') throw new Error('the AI was expected to attack');
    expect(byTestId('prompt').textContent).toBe('Choose blockers');
    click(byTestId('card-elf'));
    expect(controller.state.pending.kind).toBe('declareBlockers');
    click(byTestId('card-spider'));
    expect(byTestId('btn-confirm-blocks').textContent).toBe('Block (1)');
    click(byTestId('btn-confirm-blocks'));
    settle();
    expect(controller.state.cards.spider?.zone).toBe('graveyard');
    expect(controller.state.players[0].life).toBe(20);
  });
});

describe('end of turn and game over', () => {
  it('asks to discard down to seven cards', () => {
    const { controller, settle } = setup({
      step: 'main2',
      players: [{ hand: Array.from({ length: 9 }, (_, i) => ({ card: 'forest', id: `f${i}` })), landsPlayed: 1 }, {}],
    });
    click(byTestId('btn-end-turn'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Choose 2 cards to discard');
    click(byTestId('card-f0'));
    click(byTestId('card-f1'));
    click(byTestId('btn-confirm-cards'));
    expect(controller.state.players[0].hand).toHaveLength(7);
    expect(controller.state.players[0].graveyard).toEqual(['f0', 'f1']);
    expect(controller.state.activePlayer).toBe(1);
  });

  it('concedes from the menu and offers a new game', () => {
    const { controller } = setup({ players: [{}, {}] });
    click(byTestId('btn-menu'));
    click(byTestId('menu-concede'));
    expect(byTestId('game-over-title').textContent).toBe('Defeat');
    click(byTestId('btn-play-again'));
    expect(controller.state.pending?.kind).toBe('mulligan');
  });

  it('opens the game log', () => {
    setup({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    playFromHand('f1', 'sheet-playLand');
    click(byTestId('btn-log'));
    expect(byTestId('log-panel').textContent).toContain('You play Forest.');
  });
});
