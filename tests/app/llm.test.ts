import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseAction } from '../../src/ai';
import { GameController, type ControllerOptions, type LlmSetup } from '../../src/app/controller';
import { createTestApi } from '../../src/app/testApi';
import type { GameState, PlayerId } from '../../src/engine';
import { systemPrompt } from '../../src/llm';
import { ScriptedLlm } from '../scriptedLlm';

const thinking = (s: GameState, player: PlayerId) => ({ action: chooseAction(s, player), reason: 'Seems right.' });

function setup(llm: ScriptedLlm, options: ControllerOptions = {}) {
  const factory = vi.fn<(setup: LlmSetup) => ScriptedLlm>(() => llm);
  const controller = new GameController({
    seed: 5,
    aiDelayMs: 0,
    startingPlayer: 0,
    opponent: { kind: 'llm', model: llm.model },
    llmFactory: factory,
    ...options,
  });
  controller.start();
  return { controller, factory };
}

const aiHasAChoice = { activePlayer: 1 as const, players: [{}, { hand: [{ card: 'forest', id: 'f' }] }] as [object, object] };

let controllers: GameController[] = [];
afterEach(() => {
  for (const controller of controllers) controller.dispose();
  controllers = [];
});

function track<T extends { controller: GameController }>(value: T): T {
  controllers.push(value.controller);
  return value;
}

describe('an LLM opponent in the controller', () => {
  it('decides for the AI seat, and its reasoning goes to the log', async () => {
    const llm = new ScriptedLlm('test/scripted', thinking);
    const { controller, factory } = track(setup(llm));
    expect(factory).toHaveBeenCalledWith({ kind: 'llm', model: 'test/scripted' });
    controller.dispatch({ type: 'keep', player: 0 });
    await controller.whenIdle();
    expect(controller.state.pending).toEqual({ kind: 'priority', player: 0 });
    expect(llm.calls.map((call) => call.state.pending?.kind)).toEqual(['mulligan']);
    expect(controller.llmRecords).toMatchObject([{ decision: 'mulligan', source: 'model', model: 'test/scripted', reason: 'Seems right.', turn: 0 }]);
    const log = controller.log.map((entry) => entry.text);
    expect(log.indexOf('El rival piensa: Seems right.')).toBe(log.indexOf('El rival se queda con 7 cartas.') - 1);
    expect(controller.log.find((entry) => entry.text === 'El rival piensa: Seems right.')).toMatchObject({ event: null, parts: ['El rival piensa: Seems right.'] });
    expect(controller.lastEventText()).toBe('Turno 1 — tu turno.');
  });

  it('tells the LLM the decks and the recent events from its own seat', async () => {
    const llm = new ScriptedLlm('test/scripted', thinking);
    const { controller } = track(setup(llm, { decks: ['dawntide', 'duskmire'] }));
    controller.dispatch({ type: 'keep', player: 0 });
    await controller.whenIdle();
    expect(llm.calls[0]?.options.decks).toEqual(['dawntide', 'duskmire']);
    expect(llm.calls[0]?.options.recentEvents).toEqual(['Empieza el rival.', 'El rival se queda con 7 cartas.']);
  });

  it('never asks the LLM when it has a single choice, but asks wherever it could act', async () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller } = track(setup(llm));
    controller.loadScenario({ activePlayer: 1, players: [{ hand: ['forest'] }, {}] });
    controller.settle();
    expect(controller.state).toMatchObject({ activePlayer: 0, step: 'main1', pending: { kind: 'priority', player: 0 } });
    expect(llm.calls).toHaveLength(0);
    controller.loadScenario({ players: [{ battlefield: ['ember_hound'] }, { hand: ['ember_snap'], battlefield: ['mountain'] }] });
    controller.dispatch({ type: 'pass', player: 0 });
    controller.settle();
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    expect(llm.calls[0]?.state).toMatchObject({ activePlayer: 0, step: 'main1', pending: { kind: 'priority', player: 1 } });
  });

  it('reminds the LLM of the reasons it gave, and of no move it did not make', async () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller } = track(setup(llm));
    controller.loadScenario({
      activePlayer: 1,
      players: [{}, { hand: [{ card: 'forest', id: 'f' }, { card: 'ember_snap', id: 'snap' }], battlefield: ['mountain'] }],
    });
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    expect(llm.calls[0]?.options.recentThoughts).toEqual([]);
    llm.calls[0]?.answer({ action: { type: 'playLand', player: 1, card: 'f' }, reason: 'Land first.' });
    await vi.waitFor(() => expect(llm.calls).toHaveLength(2));
    expect(llm.calls[1]?.options.recentThoughts).toEqual(['Turno 3 (tu turno), Fase principal: Land first.']);
    llm.calls[1]?.answer({ action: { type: 'pass', player: 1 }, source: 'fallback', error: 'sin respuesta en 60 s' });
    await vi.waitFor(() => expect(llm.calls).toHaveLength(3));
    expect(llm.calls[2]?.state.step).toBe('main2');
    expect(llm.calls[2]?.options.recentThoughts).toEqual(['Turno 3 (tu turno), Fase principal: Land first.']);
    expect((await controller.llmPrompt())?.prompt).toContain('## Tus pensamientos recientes, del más antiguo al más reciente\n- Turno 3 (tu turno), Fase principal: Land first.');
  });

  it('waits for the answer: settle stops at the LLM’s decision and the game goes on once it comes', async () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller } = track(setup(llm));
    controller.loadScenario(aiHasAChoice);
    controller.settle();
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    expect(controller.state.pending).toEqual({ kind: 'priority', player: 1 });
    expect(controller.busy).toBe(true);
    expect(controller.llmThinking).toBe(true);
    controller.settle();
    controller.setFxSpeed(0.5);
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(llm.calls).toHaveLength(1);
    llm.calls[0]?.answer({ action: { type: 'playLand', player: 1, card: 'f' }, reason: 'Land first.' });
    await controller.whenIdle();
    expect(controller.llmThinking).toBe(false);
    expect(controller.state.cards.f?.zone).toBe('battlefield');
    expect(controller.state.pending).toEqual({ kind: 'priority', player: 0 });
    expect(controller.getReplay().actions.filter((action) => action.player === 1).map((action) => action.type)).toContain('playLand');
  });

  it('drops an answer that comes after the game moved on', async () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller } = track(setup(llm));
    controller.loadScenario(aiHasAChoice);
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    controller.concede();
    expect(llm.calls[0]?.aborted()).toBe(true);
    llm.calls[0]?.answer({ action: { type: 'playLand', player: 1, card: 'f' } });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(controller.state.pending).toEqual({ kind: 'gameOver', winner: 1, reason: 'concede' });
    expect(controller.getReplay().actions).toEqual([{ type: 'concede', player: 0 }]);
    expect(controller.busy).toBe(false);
  });

  it('cancels the question when a new game starts or the player leaves', async () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller, factory } = track(setup(llm));
    controller.loadScenario(aiHasAChoice);
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    controller.pause();
    expect(llm.calls[0]?.aborted()).toBe(true);
    expect(controller.busy).toBe(false);
    controller.start();
    await vi.waitFor(() => expect(llm.calls).toHaveLength(2));
    controller.newGame({ seed: 8 });
    expect(llm.calls[1]?.aborted()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('says in the log when the classic AI had to decide instead', async () => {
    const llm = new ScriptedLlm('test/scripted', (s, player) => ({ action: chooseAction(s, player), source: 'fallback', error: 'sin respuesta en 60 s' }));
    const { controller } = track(setup(llm));
    controller.loadScenario(aiHasAChoice);
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    await controller.whenIdle();
    expect(controller.log.map((entry) => entry.text)).toContain('El LLM no pudo decidir (sin respuesta en 60 s): la IA clásica hizo esta jugada.');
  });

  it('lets the classic AI play the rest of the game once the LLM is unavailable', async () => {
    const llm: ScriptedLlm = new ScriptedLlm('test/scripted', (s, player) => {
      llm.unavailable = 'OpenRouter 401: No auth credentials found';
      return { action: chooseAction(s, player), source: 'fallback', error: llm.unavailable };
    });
    const { controller } = track(setup(llm, { autoplay: true }));
    await controller.whenIdle();
    expect(controller.state.pending?.kind).toBe('gameOver');
    expect(llm.calls).toHaveLength(1);
    expect(controller.llmUnavailable).toBe('OpenRouter 401: No auth credentials found');
    const notes = controller.log.filter((entry) => entry.event === null).map((entry) => entry.text);
    expect(notes).toEqual(['El LLM no está disponible (OpenRouter 401: No auth credentials found): la IA clásica juega el resto de la partida.']);
  });

  it('plays a whole game against the classic AI, and the replay reproduces it', async () => {
    const llm = new ScriptedLlm('test/scripted', thinking);
    const { controller } = track(setup(llm, { autoplay: true, seed: 21, decks: ['emberwild', 'duskmire'] }));
    await controller.whenIdle();
    expect(controller.state.pending?.kind).toBe('gameOver');
    expect(llm.calls.length).toBeGreaterThan(5);
    expect(llm.calls.every((call) => call.player === 1)).toBe(true);
    const other = new GameController({ aiDelayMs: 0 });
    expect(other.loadReplay(controller.getReplay())).toMatchObject({ ok: true });
    expect(other.state).toEqual(controller.state);
  });

  it('keeps its opponent for the next game until told otherwise', () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller, factory } = track(setup(llm));
    controller.newGame();
    expect(controller.opponent).toEqual({ kind: 'llm', model: 'test/scripted' });
    expect(factory).toHaveBeenCalledTimes(2);
    controller.newGame({ opponent: { kind: 'classic' } });
    expect(controller.opponent).toEqual({ kind: 'classic' });
    expect(controller.llm).toBeNull();
  });

  it('needs a way to build the LLM player', () => {
    expect(() => new GameController({ opponent: { kind: 'llm', model: 'x/y' } })).toThrow(/no LLM factory/);
  });

  it('shows agents who plays the AI, the exact prompt it gets and what it decided', async () => {
    const llm = new ScriptedLlm('test/scripted');
    const { controller } = track(setup(llm, { decks: ['emberwild', 'duskmire'] }));
    const api = createTestApi(controller, () => undefined);
    expect(api.help()).toContain('llmPrompt');
    expect(api.opponent()).toEqual({ kind: 'llm', model: 'test/scripted' });
    expect(await api.llmPrompt()).toBeNull();
    api.dispatch({ type: 'keep', player: 0 });
    await vi.waitFor(() => expect(llm.calls).toHaveLength(1));
    const prompt = await api.llmPrompt();
    expect(prompt?.system).toBe(systemPrompt());
    expect(prompt?.prompt).toContain('## Decisión: mulligan');
    expect(prompt?.prompt).toContain('Tu mazo: "Fangoscuro"');
    const idle = api.idle();
    llm.calls[0]?.answer({ action: { type: 'keep', player: 1 }, reason: 'Keep.' });
    expect(await idle).toEqual({ kind: 'priority', player: 0 });
    expect(api.llmDecisions()).toMatchObject([{ decision: 'mulligan', action: { type: 'keep', player: 1 }, reason: 'Keep.' }]);
  });
});
