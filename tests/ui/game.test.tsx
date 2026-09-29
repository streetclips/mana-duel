// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController, type Matchup } from '../../src/app/controller';
import { DECK_LIST, type ScenarioSpec } from '../../src/engine';
import { App } from '../../src/ui/App';
import { loadAutoPass } from '../../src/ui/autoPassChoice';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function setup(scenario?: ScenarioSpec, initialScreen: 'start' | 'game' = 'game', decks?: Matchup) {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, decks });
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
  it('shows the decks and starts a game', () => {
    const { settle } = setup(undefined, 'start');
    for (const deck of DECK_LIST) expect(byTestId('start-screen').textContent).toContain(deck.name);
    click(byTestId('btn-play'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Keep your opening hand?');
    expect(within(byTestId('hand')).getAllByRole('button')).toHaveLength(7);
  });
});

const checked = (id: string): string | null => byTestId(id).getAttribute('aria-checked');

describe('deck selection', () => {
  it('plays the chosen deck against the chosen AI deck', () => {
    const { controller, settle } = setup(undefined, 'start');
    expect(checked('deck-emberwild')).toBe('true');
    click(byTestId('deck-dawntide'));
    expect(checked('deck-dawntide')).toBe('true');
    expect(checked('deck-emberwild')).toBe('false');
    click(byTestId('opponent-duskmire'));
    expect(checked('opponent-duskmire')).toBe('true');
    click(byTestId('btn-play'));
    settle();
    expect(controller.decks).toEqual(['dawntide', 'duskmire']);
    expect(byTestId('deck-name-0').textContent).toContain('Dawntide');
    expect(byTestId('deck-name-1').textContent).toContain('Duskmire');
  });

  it('gives the AI a random deck unless one is picked', () => {
    const { controller } = setup(undefined, 'start');
    expect(checked('opponent-random')).toBe('true');
    click(byTestId('deck-duskmire'));
    click(byTestId('btn-watch'));
    expect(controller.decks?.[0]).toBe('duskmire');
    expect(DECK_LIST.map((deck) => deck.id)).toContain(controller.decks?.[1]);
    expect(controller.autoplay).toBe(true);
  });

  it('remembers the choice for the next visit', () => {
    setup(undefined, 'start');
    click(byTestId('deck-duskmire'));
    click(byTestId('opponent-dawntide'));
    cleanup();
    setup(undefined, 'start');
    expect(checked('deck-duskmire')).toBe('true');
    expect(checked('opponent-dawntide')).toBe('true');
  });

  it('ignores a stored choice that names an unknown deck', () => {
    localStorage.setItem('manaDuel.decks', JSON.stringify({ deck: 'nope', opponent: 'duskmire' }));
    setup(undefined, 'start');
    expect(checked('deck-emberwild')).toBe('true');
    expect(checked('opponent-random')).toBe('true');
  });
});

describe('deck viewer', () => {
  const copies = (): number[] =>
    within(byTestId('deck-viewer'))
      .getAllByRole('button')
      .filter((element) => element.dataset.testid?.startsWith('deck-card-'))
      .map((element) => Number(element.dataset.count));

  it('shows every card of a deck with its count, curve and details, and chooses it', () => {
    setup(undefined, 'start');
    click(byTestId('deck-view-duskmire'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('duskmire');
    expect(copies().reduce((sum, count) => sum + count, 0)).toBe(40);
    expect(byTestId('deck-card-swamp').dataset.count).toBe('16');
    expect(byTestId('deck-stats').textContent).toContain('40 cards');
    expect(byTestId('mana-curve').getAttribute('aria-label')).toMatch(/^Mana curve of the nonland cards: \d+ costing 1,/);
    click(byTestId('deck-card-dread_tyrant'));
    expect(byTestId('card-sheet').textContent).toContain('When this creature enters, you lose 2 life.');
    expect(byTestId('card-sheet').textContent).toContain('1 copy in Duskmire');
    click(byTestId('card-sheet'));
    expect(screen.queryByTestId('card-sheet')).toBeNull();
    click(byTestId('btn-deck-choose'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
    expect(checked('deck-duskmire')).toBe('true');
  });

  it('closes without changing the chosen deck', () => {
    setup(undefined, 'start');
    click(byTestId('deck-view-dawntide'));
    click(byTestId('btn-deck-close'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
    expect(checked('deck-emberwild')).toBe('true');
  });

  it('shows both decks of the game from the menu', () => {
    setup(undefined, 'game', ['dawntide', 'duskmire']);
    click(byTestId('btn-menu'));
    click(byTestId('menu-decks'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('dawntide');
    expect(screen.queryByTestId('btn-deck-choose')).toBeNull();
    click(byTestId('deck-tab-1'));
    expect(byTestId('deck-viewer').dataset.deck).toBe('duskmire');
    expect(byTestId('deck-tab-1').textContent).toBe('AI · Duskmire');
    click(byTestId('btn-deck-close'));
    expect(screen.queryByTestId('deck-viewer')).toBeNull();
  });

  it('is not offered for a loaded scenario', () => {
    setup({ players: [{}, {}] });
    click(byTestId('btn-menu'));
    expect(screen.queryByTestId('menu-decks')).toBeNull();
    expect(screen.queryByTestId('deck-name-0')).toBeNull();
  });
});

describe('auto-pass', () => {
  it('turns off from the menu, and the game then stops in the AI’s turn wherever you could act', () => {
    const { controller, settle } = setup({ activePlayer: 1, players: [{ hand: ['ember_snap'], battlefield: ['mountain'] }, {}] });
    click(byTestId('btn-menu'));
    expect(checked('menu-autopass')).toBe('true');
    expect(byTestId('menu-autopass').textContent).toBe('Auto-pass: on');
    click(byTestId('menu-autopass'));
    expect(screen.queryByTestId('menu')).toBeNull();
    expect(controller.autoPass).toBe(false);
    expect(loadAutoPass()).toBe(false);
    settle();
    expect(byTestId('prompt').textContent).toBe("AI's main phase");
    expect(byTestId('prompt-detail').textContent).toBe('You can cast instants now');
    click(byTestId('btn-continue'));
    settle();
    expect(byTestId('prompt').textContent).toBe("AI's second main phase");
    click(byTestId('btn-menu'));
    expect(checked('menu-autopass')).toBe('false');
    click(byTestId('menu-autopass'));
    settle();
    expect(byTestId('prompt').textContent).toBe('Your main phase');
    expect(loadAutoPass()).toBe(true);
  });

  it('names your own attack when it stops after it', () => {
    const { controller, settle } = setup({ players: [{ hand: ['ember_snap'], battlefield: ['mountain', { card: 'ember_hound', id: 'hound' }] }, {}] });
    act(() => controller.setAutoPass(false));
    click(byTestId('btn-to-combat'));
    settle();
    click(byTestId('card-hound'));
    click(byTestId('btn-confirm-attack'));
    settle();
    expect(byTestId('prompt').textContent).toBe('You attack with Ember Hound');
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

describe('counterspells', () => {
  it('target a spell on the stack by tapping it in the center strip', () => {
    const { controller, settle } = setup({
      activePlayer: 1,
      players: [
        { hand: [{ card: 'turn_the_tide', id: 'tide' }], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    settle();
    const item = controller.state.stack[0];
    if (!item) throw new Error('the AI was expected to cast its Rhino');
    expect(byTestId('btn-resolve').textContent).toBe('Let it resolve');
    playFromHand('tide', 'sheet-cast');
    expect(byTestId('prompt').textContent).toBe('Choose target spell');
    expect(byTestId(`stack-${item.id}`).dataset.targetable).toBe('true');
    click(byTestId(`stack-${item.id}`));
    settle();
    expect(controller.state.cards.rhino?.zone).toBe('graveyard');
    expect(controller.log.map((entry) => entry.text)).toContain("AI's Timberland Rhino is countered.");
  });

  it('shows the card behind a stack item when it is tapped outside targeting', () => {
    const { settle } = setup({
      activePlayer: 1,
      players: [
        { hand: ['turn_the_tide'], battlefield: ['island', 'island', 'island'] },
        { hand: [{ card: 'timberland_rhino', id: 'rhino' }], battlefield: ['forest', 'forest', 'forest', 'forest'] },
      ],
    });
    settle();
    click(screen.getAllByRole('button').find((element) => element.dataset.card === 'rhino' && element.dataset.testid?.startsWith('stack-')) as HTMLElement);
    expect(byTestId('card-sheet').textContent).toContain('Timberland Rhino');
    expect(byTestId('card-sheet').textContent).toContain('On the stack');
  });
});

describe('card art', () => {
  it('shows each card art in hand, on the battlefield and in the card sheet', () => {
    setup({
      players: [{ hand: [{ card: 'ember_snap', id: 'snap' }], battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, {}],
    });
    const artOf = (element: HTMLElement): string | null | undefined => element.querySelector('.art img')?.getAttribute('src');
    expect(artOf(byTestId('card-snap'))).toMatch(/cards\/ember_snap\.svg$/);
    expect(artOf(byTestId('card-rhino'))).toMatch(/cards\/timberland_rhino\.svg$/);
    click(byTestId('card-rhino'));
    expect(artOf(byTestId('card-sheet'))).toMatch(/cards\/timberland_rhino\.svg$/);
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

describe('tokens, sacrifices and discards', () => {
  it('shows the tokens a spell creates on the battlefield, as tokens in the card sheet', () => {
    const { controller, settle } = setup({ players: [{ hand: [{ card: 'raise_the_banners', id: 'banners' }], battlefield: ['plains', 'plains'] }, {}] });
    playFromHand('banners', 'sheet-cast');
    settle();
    const tokens = controller.state.players[0].battlefield.filter((id) => controller.state.cards[id]?.def === 'soldier_token');
    expect(tokens).toHaveLength(2);
    expect(within(byTestId('battlefield-0')).getAllByRole('button').filter((button) => button.dataset.def === 'soldier_token')).toHaveLength(2);
    click(byTestId(`card-${tokens[0]}`));
    expect(byTestId('card-sheet').textContent).toContain('Token Creature — Soldier');
  });

  it('sacrifices a creature from its card sheet, then asks for the target', () => {
    const { controller, settle } = setup({
      players: [{ battlefield: [{ card: 'bonewood_stalker', id: 'stalker' }] }, { battlefield: [{ card: 'ember_hound', id: 'hound' }] }],
    });
    click(byTestId('card-stalker'));
    expect(byTestId('card-sheet').textContent).toContain('Sacrifice this creature: Target creature gets -2/-2 until end of turn.');
    expect(byTestId('sheet-activate').textContent).toBe('Activate Sacrifice: -2/-2');
    click(byTestId('sheet-activate'));
    expect(byTestId('prompt').textContent).toBe('Choose target creature');
    click(byTestId('card-hound'));
    settle();
    expect([controller.state.cards.stalker?.zone, controller.state.cards.hound?.zone]).toEqual(['graveyard', 'graveyard']);
  });

  it('asks which card to discard when a spell says so, in the middle of the turn', () => {
    const { controller, settle } = setup({
      players: [
        { hand: [{ card: 'sift_the_depths', id: 'sift' }], battlefield: ['island', 'island'], library: [{ card: 'forest', id: 'a' }, { card: 'island', id: 'b' }] },
        {},
      ],
    });
    playFromHand('sift', 'sheet-cast');
    settle();
    expect(byTestId('prompt').textContent).toBe('Choose 1 card to discard');
    expect(byTestId('prompt-detail').textContent).toBe('Sift the Depths · 0/1 selected');
    click(byTestId('card-a'));
    click(byTestId('btn-confirm-cards'));
    settle();
    expect(controller.state.players[0].hand).toEqual(['b']);
    expect(byTestId('prompt').textContent).toBe('Your main phase');
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
