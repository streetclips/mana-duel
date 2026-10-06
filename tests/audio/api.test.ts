// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { createTestApi } from '../../src/app/testApi';
import { GameAudio, UNLOCK_EVENTS, bindAudioDataset, type GameAudioOptions } from '../../src/audio';
import { DECK_LIST } from '../../src/engine';
import { fakeContext } from './fakeAudio';

const cleanups: (() => void)[] = [];

afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  Reflect.deleteProperty(document, 'visibilityState');
});

function setup(options: GameAudioOptions = {}) {
  const { ctx, create } = fakeContext();
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0 });
  const audio = new GameAudio({
    createContext: create,
    mayStart: () => true,
    scene: 'game',
    defer: (task) => task(),
    ...options,
  });
  audio.attach(controller);
  cleanups.push(() => audio.dispose());
  const api = createTestApi(controller, () => undefined, { freezeFx: async () => [], audio });
  return { ctx, controller, audio, api };
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('manaDuel.audio', () => {
  it('tells agents what plays, and which sounds each action started', async () => {
    const { api } = setup();
    expect(api.help()).toContain('audio.played(since?)');
    expect(api.audio.state()).toMatchObject({
      supported: true,
      context: 'none',
      music: { on: true, theme: 'emberwild', mood: 'calm' },
      sfx: { on: true },
    });
    expect((await api.audio.unlock()).context).toBe('running');
    api.loadScenario({ players: [{ hand: [{ card: 'forest', id: 'f1' }] }, {}] });
    expect(api.audio.state().music.theme).toBe('neutral');
    const seq = api.fxSeq();
    api.dispatch({ type: 'playLand', player: 0, card: 'f1' });
    expect(api.audio.played(seq)).toMatchObject([{ seq: seq + 1, sound: 'land', color: 'G' }]);
    expect(JSON.parse(JSON.stringify(api.audio.state()))).toEqual(api.audio.state());
    expect(JSON.parse(JSON.stringify(api.audio.played()))).toEqual(api.audio.played());
  });

  it('lists the sounds and the themes, one per deck', () => {
    const { api } = setup();
    expect(api.audio.sounds()).toEqual(expect.arrayContaining(['draw', 'strike', 'hurt', 'victory', 'defeat']));
    expect(api.audio.themes().map((theme) => theme.id)).toEqual([
      'title',
      'neutral',
      ...DECK_LIST.map((deck) => deck.id),
    ]);
    expect(api.audio.themes().find((theme) => theme.id === 'emberwild')).toEqual({
      id: 'emberwild',
      name: 'Brasalvaje',
      colors: ['R', 'G'],
      key: 'A Aeolian',
      tempo: 108,
      lead: 'pluck',
    });
  });

  it('turns music and effects off and sets the volume', async () => {
    const { api } = setup();
    await api.audio.unlock();
    api.audio.setMusic(false);
    api.audio.setSfx(false);
    api.audio.setVolume(0.5);
    expect(api.audio.state()).toMatchObject({ volume: 0.5, music: { on: false, playing: false }, sfx: { on: false } });
  });

  it('reports no audio where the game runs without it, and cannot render', async () => {
    const api = createTestApi(new GameController({ seed: 1 }), () => undefined);
    expect(api.audio.state()).toMatchObject({ supported: false, context: 'none' });
    expect((await api.audio.unlock()).context).toBe('none');
    expect(api.audio.played()).toEqual([]);
    await expect(api.audio.render('strike')).rejects.toThrow('Web Audio is not available');
    await expect(api.audio.render({ theme: 'nope' })).rejects.toThrow('Unknown theme');
  });
});

describe('the game audio in a page', () => {
  it('starts on the first tap or key, and pauses while the page is hidden', async () => {
    const { ctx, audio } = setup();
    cleanups.push(audio.listen(window));
    expect(UNLOCK_EVENTS).toContain('pointerdown');
    expect(audio.state().context).toBe('none');
    window.dispatchEvent(new Event('keydown'));
    await Promise.resolve();
    expect(audio.state().context).toBe('running');
    setVisibility('hidden');
    expect(audio.state()).toMatchObject({ hidden: true, context: 'suspended' });
    setVisibility('visible');
    await Promise.resolve();
    expect(ctx.state).toBe('running');
  });

  it('mirrors its state on an element for tests to wait on', async () => {
    const { audio } = setup();
    const element = document.createElement('div');
    cleanups.push(bindAudioDataset(audio, element));
    expect({ ...element.dataset }).toEqual({ audio: 'none', music: 'emberwild', mood: 'calm' });
    await audio.unlock();
    expect(element.dataset.audio).toBe('running');
    audio.setMusic(false);
    expect(element.dataset.music).toBe('off');
    const unsupported = new GameAudio({ createContext: null });
    cleanups.push(bindAudioDataset(unsupported, element));
    expect(element.dataset.audio).toBe('unsupported');
  });
});
