// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GameController } from '../../src/app/controller';
import { App } from '../../src/ui/App';
import { SCENE_ART, SCENE_LAYERS } from '../../src/ui/sceneArt';
import {
  SCENES,
  SCENE_MS,
  firstScene,
  isSceneId,
  loadScene,
  nextScene,
  saveScene,
  sceneFrom,
} from '../../src/ui/scenery';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const backdrop = (): HTMLElement => screen.getByTestId('backdrop');
function elapse(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}
const shown = (): { scene?: string; mode?: string } => ({
  scene: backdrop().dataset.scene,
  mode: backdrop().dataset.mode,
});

function open(initialScreen: 'start' | 'game', pinnedScene?: (typeof SCENES)[number]) {
  const controller = new GameController({ seed: 5, aiDelayMs: 0, skipMulligans: true, startingPlayer: 0 });
  render(<App controller={controller} initialScreen={initialScreen} pinnedScene={pinnedScene} />);
  return controller;
}

describe('the scenes', () => {
  it('are five, one per color of mana, and follow each other in the order of the colors', () => {
    expect(SCENES).toEqual(['plains', 'island', 'swamp', 'mountain', 'forest']);
    expect(SCENES.map(nextScene)).toEqual(['island', 'swamp', 'mountain', 'forest', 'plains']);
    expect(SCENES.every(isSceneId)).toBe(true);
    expect(isSceneId('desert')).toBe(false);
  });

  it('draw a sky and several planes of land, every shape a path the backdrop can paint', () => {
    for (const id of SCENES) {
      const art = SCENE_ART[id];
      expect(art.sky.length).toBeGreaterThan(0);
      expect(art.land.length).toBeGreaterThanOrEqual(5);
      for (const layer of SCENE_LAYERS) {
        for (const shape of art[layer]) expect(shape.d).toMatch(/^M-?\d/);
      }
    }
  });

  it('remember the last one shown and start the next visit on the one after it', () => {
    expect(loadScene()).toBeNull();
    expect(firstScene(null, null)).toBe('plains');
    saveScene('swamp');
    expect(loadScene()).toBe('swamp');
    expect(firstScene(null, loadScene())).toBe('mountain');
    localStorage.setItem('manaDuel.scene', 'desert');
    expect(loadScene()).toBeNull();
  });

  it('give way to ?scene= in the URL', () => {
    expect(sceneFrom(new URLSearchParams('scene=forest'))).toBe('forest');
    expect(sceneFrom(new URLSearchParams('scene=desert'))).toBeNull();
    expect(sceneFrom(new URLSearchParams('seed=3'))).toBeNull();
    expect(firstScene('island', 'swamp')).toBe('island');
  });
});

describe('the backdrop', () => {
  it('cycles through the scenes behind the menus, stays on one in a game and takes the next one for each game', () => {
    vi.useFakeTimers();
    open('start');
    expect(shown()).toEqual({ scene: 'plains', mode: 'menu' });
    expect(backdrop().getAttribute('aria-hidden')).toBe('true');
    expect(backdrop().querySelectorAll('.scene')).toHaveLength(5);
    expect(backdrop().querySelector('.scene.on')?.getAttribute('data-scene-id')).toBe('plains');
    elapse(SCENE_MS);
    expect(shown()).toEqual({ scene: 'island', mode: 'menu' });
    fireEvent.click(screen.getByTestId('btn-play'));
    expect(shown()).toEqual({ scene: 'swamp', mode: 'game' });
    elapse(SCENE_MS * 3);
    expect(shown().scene).toBe('swamp');
    fireEvent.click(screen.getByTestId('btn-menu'));
    fireEvent.click(screen.getByTestId('menu-new-game'));
    expect(shown()).toEqual({ scene: 'mountain', mode: 'game' });
    fireEvent.click(screen.getByTestId('btn-menu'));
    fireEvent.click(screen.getByTestId('menu-home'));
    expect(shown()).toEqual({ scene: 'mountain', mode: 'menu' });
    fireEvent.click(screen.getByTestId('btn-expedition'));
    elapse(SCENE_MS);
    expect(shown()).toEqual({ scene: 'forest', mode: 'menu' });
    expect(loadScene()).toBe('forest');
  });

  it('opens a game at the scene after the last one shown, without skipping one', () => {
    saveScene('forest');
    const controller = open('game');
    expect(shown()).toEqual({ scene: 'plains', mode: 'game' });
    act(() => controller.newGame());
    expect(shown().scene).toBe('island');
  });

  it('keeps a pinned scene in the menus and in every game, and leaves the stored one alone', () => {
    vi.useFakeTimers();
    saveScene('island');
    open('start', 'mountain');
    elapse(SCENE_MS * 2);
    expect(shown()).toEqual({ scene: 'mountain', mode: 'menu' });
    fireEvent.click(screen.getByTestId('btn-play'));
    expect(shown()).toEqual({ scene: 'mountain', mode: 'game' });
    expect(loadScene()).toBe('island');
  });

  it('changes scene only between games for a player who asks for reduced motion', () => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }));
    open('start');
    elapse(SCENE_MS * 2);
    expect(shown()).toEqual({ scene: 'plains', mode: 'menu' });
    fireEvent.click(screen.getByTestId('btn-play'));
    expect(shown()).toEqual({ scene: 'island', mode: 'game' });
  });
});
