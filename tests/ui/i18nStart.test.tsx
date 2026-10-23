// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';
import { GameController } from '../../src/app/controller';
import { getLocale, matchLocale, setLocale, withLocale } from '../../src/i18n';
import { App } from '../../src/ui/App';
import { applyLocale, loadLocaleChoice, localeFrom, saveLocaleChoice } from '../../src/ui/localeChoice';
import { shownText, spanishIn } from '../i18n';

afterEach(() => {
  cleanup();
  localStorage.clear();
  applyLocale('es');
});

describe('choosing the language', () => {
  it('matches the browser’s languages by their primary tag', () => {
    expect(matchLocale(['en-US', 'es-ES'])).toBe('en');
    expect(matchLocale(['fr-FR', 'es-MX'])).toBe('es');
    expect(matchLocale(['fr-FR', 'de'])).toBeNull();
    expect(matchLocale([])).toBeNull();
  });

  it('takes the URL first, then the remembered choice, then the browser, then Spanish', () => {
    const none = new URLSearchParams();
    expect(localeFrom(new URLSearchParams('lang=en'), 'es', ['es-ES'])).toBe('en');
    expect(localeFrom(new URLSearchParams('lang=xx'), 'en', ['es-ES'])).toBe('en');
    expect(localeFrom(none, null, ['en-GB'])).toBe('en');
    expect(localeFrom(none, null, ['fr-FR'])).toBe('es');
  });

  it('remembers the choice', () => {
    expect(loadLocaleChoice()).toBeNull();
    saveLocaleChoice('en');
    expect(loadLocaleChoice()).toBe('en');
    localStorage.setItem('manaDuel.locale', 'xx');
    expect(loadLocaleChoice()).toBeNull();
  });

  it('runs a block in another language and comes back', () => {
    expect(withLocale('en', () => getLocale())).toBe('en');
    expect(getLocale()).toBe('es');
  });

  it('marks the document with the language, its title, its description and its manifest', () => {
    document.head.innerHTML = [
      '<meta name="description" content="">',
      '<meta name="apple-mobile-web-app-title" content="">',
      '<link rel="manifest" href="/manifest.es.webmanifest">',
    ].join('');
    applyLocale('en');
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Mana Duel');
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Mana Duel: a minimalist card duel against an AI.',
    );
    expect(document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute('content')).toBe(
      'Mana Duel',
    );
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('manifest.en.webmanifest');
    applyLocale('es');
    expect(document.documentElement.lang).toBe('es');
    expect(document.title).toBe('Duelo de Maná');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('manifest.es.webmanifest');
  });
});

describe('the start screen in English', () => {
  function start(): void {
    render(<App controller={new GameController({ seed: 5, aiDelayMs: 0 })} initialScreen="start" />);
  }

  it('switches language from the settings and remembers it', () => {
    start();
    fireEvent.click(screen.getByTestId('btn-settings'));
    expect(screen.getByTestId('lang-es').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('lang-en').textContent).toBe('English');
    fireEvent.click(screen.getByTestId('lang-en'));
    expect(getLocale()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(loadLocaleChoice()).toBe('en');
    expect(screen.getByTestId('lang-en').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('settings').getAttribute('aria-label')).toBe('Settings');
    expect(screen.getByRole('heading', { name: 'How to play' })).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn-settings-close'));
    expect(screen.getByRole('heading', { name: 'Mana Duel' })).toBeTruthy();
    expect(screen.getByTestId('btn-play').textContent).toBe('Play against the AI');
    expect(screen.getByTestId('seat-0').textContent).toContain('Emberwild');
    fireEvent.click(screen.getByTestId('btn-settings'));
    fireEvent.click(screen.getByTestId('lang-es'));
    expect(getLocale()).toBe('es');
    expect(screen.getByTestId('settings').getAttribute('aria-label')).toBe('Ajustes');
  });

  it('shows no Spanish on the start screen, its settings or the LLM fields', () => {
    setLocale('en');
    start();
    expect(spanishIn(shownText(document.body))).toEqual([]);
    fireEvent.click(screen.getByTestId('btn-settings'));
    fireEvent.click(screen.getByTestId('ai-llm'));
    fireEvent.input(screen.getByTestId('llm-model'), { target: { value: 'not a model' } });
    expect(screen.getByTestId('llm-hint').textContent).toContain('Enter the id of an OpenRouter model');
    expect(spanishIn(shownText(document.body))).toEqual([]);
  });
});
