// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseAction } from '../../src/ai';
import { GameController } from '../../src/app/controller';
import type { GameState, PlayerId } from '../../src/engine';
import { DEFAULT_MODEL, type ModelInfo } from '../../src/llm';
import { App } from '../../src/ui/App';
import { ScriptedLlm } from '../scriptedLlm';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const thinking = (s: GameState, player: PlayerId) => ({ action: chooseAction(s, player), reason: 'A fine hand.' });

interface Options {
  proxy?: boolean;
  loadModels?: () => Promise<ModelInfo[]>;
  llm?: ScriptedLlm;
}

function setup({ proxy = false, loadModels, llm = new ScriptedLlm(DEFAULT_MODEL, thinking) }: Options = {}) {
  const factory = vi.fn(() => llm);
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, llmFactory: factory });
  const view = render(<App controller={controller} initialScreen="start" llmProxy={proxy} loadModels={loadModels} />);
  return { controller, factory, llm, view };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);
const checked = (id: string): string | null => byTestId(id).getAttribute('aria-checked');
const type = (id: string, value: string): void => {
  fireEvent.input(byTestId(id), { target: { value } });
};

async function settled(controller: GameController): Promise<void> {
  await act(async () => {
    controller.settle();
    await controller.whenIdle();
  });
}

describe('choosing who plays the AI', () => {
  it('is the classic AI unless the LLM is picked, which needs a model and a key', () => {
    const { controller, factory } = setup();
    expect(checked('ai-classic')).toBe('true');
    expect(screen.queryByTestId('llm-model')).toBeNull();
    fireEvent.click(byTestId('ai-llm'));
    expect(checked('ai-llm')).toBe('true');
    expect((byTestId('llm-model') as HTMLInputElement).value).toBe(DEFAULT_MODEL);
    expect(byTestId('llm-hint').textContent).toContain('Enter your OpenRouter API key.');
    expect((byTestId('btn-play') as HTMLButtonElement).disabled).toBe(true);
    expect((byTestId('btn-watch') as HTMLButtonElement).disabled).toBe(true);
    type('llm-key', 'sk-or-test');
    expect(localStorage.getItem('manaDuel.openrouterKey')).toBe('sk-or-test');
    expect((byTestId('btn-play') as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(byTestId('btn-play'));
    expect(controller.opponent).toEqual({ kind: 'llm', model: DEFAULT_MODEL });
    expect(factory).toHaveBeenCalledWith({ kind: 'llm', model: DEFAULT_MODEL });
    expect(byTestId('player-tag-1').textContent).toBe('LLM');
    expect(byTestId('player-tag-1').getAttribute('title')).toBe(`OpenRouter · ${DEFAULT_MODEL}`);
    expect(screen.queryByTestId('player-tag-0')).toBeNull();
  });

  it('passes the chosen thinking effort to the LLM setup', () => {
    const { controller, factory } = setup({ proxy: true });
    fireEvent.click(byTestId('ai-llm'));
    expect((byTestId('llm-effort') as HTMLSelectElement).value).toBe('default');
    fireEvent.change(byTestId('llm-effort'), { target: { value: 'low' } });
    expect(JSON.parse(localStorage.getItem('manaDuel.opponent') ?? 'null')).toEqual({ kind: 'llm', model: DEFAULT_MODEL, effort: 'low' });
    fireEvent.click(byTestId('btn-play'));
    expect(controller.opponent).toEqual({ kind: 'llm', model: DEFAULT_MODEL, effort: 'low' });
    expect(factory).toHaveBeenCalledWith({ kind: 'llm', model: DEFAULT_MODEL, effort: 'low' });
    expect(byTestId('player-tag-1').getAttribute('title')).toBe(`OpenRouter · ${DEFAULT_MODEL} · low effort`);
  });

  it('checks the model id', () => {
    setup();
    fireEvent.click(byTestId('ai-llm'));
    type('llm-key', 'sk-or-test');
    type('llm-model', 'gpt');
    expect(byTestId('llm-hint').textContent).toContain(`Enter an OpenRouter model id, like ${DEFAULT_MODEL}.`);
    expect((byTestId('btn-play') as HTMLButtonElement).disabled).toBe(true);
    type('llm-model', 'google/gemini-3.8-flash');
    expect((byTestId('btn-play') as HTMLButtonElement).disabled).toBe(false);
  });

  it('needs no key when the dev server proxies OpenRouter', () => {
    setup({ proxy: true });
    fireEvent.click(byTestId('ai-llm'));
    expect((byTestId('btn-play') as HTMLButtonElement).disabled).toBe(false);
    expect(byTestId('llm-hint').textContent).toContain('The dev server adds its own OPENROUTER_API_KEY');
  });

  it('remembers the choice for the next visit', () => {
    const { view } = setup();
    fireEvent.click(byTestId('ai-llm'));
    type('llm-model', 'deepseek/deepseek-v4.1-flash');
    view.unmount();
    setup();
    expect(checked('ai-llm')).toBe('true');
    expect((byTestId('llm-model') as HTMLInputElement).value).toBe('deepseek/deepseek-v4.1-flash');
  });

  it('suggests the models of the OpenRouter catalog', async () => {
    const loadModels = vi.fn(async () => [{ id: 'zeta/model', name: 'Zeta', promptPrice: 0.1, completionPrice: 0.2 }]);
    setup({ loadModels });
    expect(loadModels).not.toHaveBeenCalled();
    fireEvent.click(byTestId('ai-llm'));
    const options = (): (string | null)[] => [...byTestId('llm-models').querySelectorAll('option')].map((option) => option.getAttribute('value'));
    await vi.waitFor(() => expect(options()).toContain('zeta/model'));
    expect(options()).toContain(DEFAULT_MODEL);
    expect(loadModels).toHaveBeenCalledTimes(1);
  });
});

describe('a game against the LLM', () => {
  function startLlmGame(llm: ScriptedLlm) {
    const context = setup({ llm, proxy: true });
    fireEvent.click(byTestId('ai-llm'));
    fireEvent.click(byTestId('btn-play'));
    act(() => context.controller.newGame({ seed: 5, startingPlayer: 0 }));
    return context;
  }

  const liveCalls = (llm: ScriptedLlm) => llm.calls.filter((call) => !call.aborted());

  it('shows the model while the LLM thinks', async () => {
    const llm = new ScriptedLlm(DEFAULT_MODEL);
    const { controller } = startLlmGame(llm);
    fireEvent.click(byTestId('btn-keep'));
    await act(async () => {
      await vi.waitFor(() => expect(liveCalls(llm)).toHaveLength(1));
    });
    expect(byTestId('thinking').textContent).toBe('AI · gpt-6-luna');
    expect(byTestId('game').getAttribute('data-llm')).toBe('thinking');
    liveCalls(llm)[0]?.answer({ action: { type: 'keep', player: 1 }, reason: 'Two lands and cheap spells.' });
    await settled(controller);
    expect(byTestId('game').getAttribute('data-llm')).toBe('ready');
    expect(byTestId('prompt').textContent).not.toBe('Keep your opening hand?');
  });

  it('writes the LLM’s reasoning in the log', async () => {
    const { controller } = startLlmGame(new ScriptedLlm(DEFAULT_MODEL, thinking));
    fireEvent.click(byTestId('btn-keep'));
    await settled(controller);
    fireEvent.click(byTestId('btn-menu'));
    fireEvent.click(byTestId('menu-log'));
    const note = [...byTestId('log-panel').querySelectorAll('li')].find((item) => item.textContent === 'AI thinks: A fine hand.');
    expect(note?.className).toBe('note');
  });

  it('says when the LLM is unavailable and the classic AI takes over', async () => {
    const llm: ScriptedLlm = new ScriptedLlm(DEFAULT_MODEL, (s, player) => {
      llm.unavailable = 'OpenRouter 402: Insufficient credits';
      return { action: chooseAction(s, player), source: 'fallback', error: llm.unavailable };
    });
    const { controller } = startLlmGame(llm);
    fireEvent.click(byTestId('btn-keep'));
    await settled(controller);
    expect(byTestId('llm-notice-text').textContent).toBe('LLM unavailable: OpenRouter 402: Insufficient credits. The classic AI is playing.');
    expect(byTestId('game').getAttribute('data-llm')).toBe('unavailable');
    expect(byTestId('player-tag-1').getAttribute('title')).toBe('LLM unavailable: OpenRouter 402: Insufficient credits');
    fireEvent.click(byTestId('llm-notice-hide'));
    expect(screen.queryByTestId('llm-notice')).toBeNull();
    expect(byTestId('game').getAttribute('data-llm')).toBe('unavailable');
    act(() => controller.newGame({ seed: 6 }));
    expect(byTestId('llm-notice')).toBeTruthy();
  });
});
