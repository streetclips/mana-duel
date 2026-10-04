// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { GameAudio } from '../../src/audio';
import { App } from '../../src/ui/App';
import { DEFAULT_AUDIO, audioChoiceFrom, loadAudioChoice, saveAudioChoice } from '../../src/ui/audioChoice';
import { fakeContext } from '../audio/fakeAudio';

const audios: GameAudio[] = [];

afterEach(() => {
  cleanup();
  localStorage.clear();
  for (const audio of audios.splice(0)) audio.dispose();
});

function setup(initialScreen: 'start' | 'game' = 'game') {
  const { create } = fakeContext();
  const controller = new GameController({ seed: 5, aiDelayMs: 0, startingPlayer: 0, decks: ['sunmeadow', 'duskmire'] });
  const audio = new GameAudio({
    ...loadAudioChoice(),
    createContext: create,
    mayStart: () => true,
    scene: initialScreen === 'start' ? 'title' : 'game',
    defer: (task) => task(),
  });
  audio.attach(controller);
  audios.push(audio);
  render(<App controller={controller} initialScreen={initialScreen} audio={audio} />);
  return { controller, audio };
}

const byTestId = (id: string): HTMLElement => screen.getByTestId(id);
const pressed = (id: string): string | null => byTestId(id).getAttribute('aria-pressed');
const checked = (id: string): string | null => byTestId(id).getAttribute('aria-checked');

describe('sound settings', () => {
  it('turn music and sound effects off from the game menu, remembered for the next visit', () => {
    const { audio } = setup();
    fireEvent.click(byTestId('btn-menu'));
    expect(checked('menu-music')).toBe('true');
    expect(byTestId('menu-music').textContent).toBe('Música: sí');
    expect(byTestId('menu-sfx').textContent).toBe('Efectos de sonido: sí');
    fireEvent.click(byTestId('menu-music'));
    expect(screen.queryByTestId('menu')).toBeNull();
    expect(audio.music).toBe(false);
    expect(loadAudioChoice()).toEqual({ music: false, sfx: true });
    fireEvent.click(byTestId('btn-menu'));
    expect(checked('menu-music')).toBe('false');
    fireEvent.click(byTestId('menu-sfx'));
    expect(audio.sfx).toBe(false);
    expect(loadAudioChoice()).toEqual({ music: false, sfx: false });
    cleanup();
    expect(setup().audio.state()).toMatchObject({ music: { on: false }, sfx: { on: false } });
  });

  it('toggle from the settings of the start screen, pressed while on', () => {
    const { audio } = setup('start');
    expect(screen.queryByTestId('btn-music')).toBeNull();
    fireEvent.click(byTestId('btn-settings'));
    expect([pressed('btn-music'), pressed('btn-sfx')]).toEqual(['true', 'true']);
    expect(byTestId('btn-music').getAttribute('aria-label')).toBe('Música');
    fireEvent.click(byTestId('btn-music'));
    expect(pressed('btn-music')).toBe('false');
    expect(audio.music).toBe(false);
    fireEvent.click(byTestId('btn-sfx'));
    expect(pressed('btn-sfx')).toBe('false');
    expect(loadAudioChoice()).toEqual({ music: false, sfx: false });
    fireEvent.click(byTestId('btn-music'));
    expect(loadAudioChoice()).toEqual({ music: true, sfx: false });
    expect(pressed('btn-music')).toBe('true');
  });

  it('follow the screen: the title theme before a game, the theme of your deck in it', () => {
    localStorage.setItem('manaDuel.decks', JSON.stringify({ deck: 'mistgrave', opponent: 'duskmire' }));
    const { audio } = setup('start');
    expect(audio.state().music.theme).toBe('title');
    fireEvent.click(byTestId('btn-play'));
    expect(audio.state().music.theme).toBe('mistgrave');
    fireEvent.click(byTestId('btn-menu'));
    fireEvent.click(byTestId('menu-home'));
    expect(audio.state().music.theme).toBe('title');
  });

  it('are left out where the game has no audio', () => {
    render(<App controller={new GameController({ seed: 5, aiDelayMs: 0 })} initialScreen="start" />);
    fireEvent.click(byTestId('btn-settings'));
    expect(byTestId('settings')).toBeTruthy();
    expect(screen.queryByTestId('btn-music')).toBeNull();
    fireEvent.click(byTestId('btn-settings-close'));
    fireEvent.click(byTestId('btn-play'));
    fireEvent.click(byTestId('btn-menu'));
    expect(screen.queryByTestId('menu-music')).toBeNull();
    expect(screen.queryByTestId('menu-sfx')).toBeNull();
  });
});

describe('the stored sound choice', () => {
  it('starts with music and sound effects on, and ignores anything malformed', () => {
    expect(loadAudioChoice()).toEqual(DEFAULT_AUDIO);
    localStorage.setItem('manaDuel.audio', '{"music":"no"}');
    expect(loadAudioChoice()).toEqual({ music: true, sfx: true });
    localStorage.setItem('manaDuel.audio', 'not json');
    expect(loadAudioChoice()).toEqual({ music: true, sfx: true });
    saveAudioChoice({ music: false, sfx: true });
    expect(loadAudioChoice()).toEqual({ music: false, sfx: true });
  });

  it('gives way to ?music= and ?sfx= in the URL', () => {
    const stored = { music: false, sfx: true };
    expect(audioChoiceFrom(new URLSearchParams('music=on&sfx=off'), stored)).toEqual({ music: true, sfx: false });
    expect(audioChoiceFrom(new URLSearchParams('music=loud'), stored)).toEqual(stored);
    expect(audioChoiceFrom(new URLSearchParams(''), stored)).toEqual(stored);
  });
});
