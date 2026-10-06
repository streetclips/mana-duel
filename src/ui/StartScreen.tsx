import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { DeckDef, PlayerId } from '../engine';
import { LOCALES, LOCALE_NAMES, type Locale } from '../i18n';
import { DeckPicker, Versus } from './components/DeckSelect';
import { CardsIcon, ChevronRightIcon, GearIcon, MapIcon, PackIcon } from './components/ModeIcons';
import { ScreenBar } from './components/ScreenBar';
import { SoundToggles, type AudioToggles } from './components/SoundToggles';
import type { DeckChoice } from './deckChoice';
import { REASONING_EFFORTS, isReasoningEffort } from '../llm/models';
import { prefersReducedMotion } from './motion';
import { llmProblem, type OpponentChoice } from './opponentChoice';
import { commonText } from './text/common';
import { startText } from './text/start';

export interface LlmSettings {
  choice: OpponentChoice;
  apiKey: string;
  proxy: boolean;
  models: string[];
  onChoice: (choice: OpponentChoice) => void;
  onApiKey: (key: string) => void;
}

export interface ModeEntry {
  status: string;
  onOpen: () => void;
}

export interface LanguageSettings {
  locale: Locale;
  onChange: (locale: Locale) => void;
}

interface StartScreenProps {
  choice: DeckChoice;
  onChange: (choice: DeckChoice) => void;
  onView: (deckId: string) => void;
  onPlay: () => void;
  onWatch: () => void;
  llm: LlmSettings;
  language?: LanguageSettings;
  audio?: AudioToggles;
  customs?: readonly DeckDef[];
  expedition?: ModeEntry;
  draft?: ModeEntry;
  myDecks?: ModeEntry;
}

function LlmFields({ llm, problem }: { llm: LlmSettings; problem: string | null }) {
  const text = startText();
  const hint = problem ?? (llm.proxy && !llm.apiKey.trim() ? text.proxyHint : text.keyHint);
  return (
    <div class="llm-fields">
      <label class="field">
        <span>{text.model}</span>
        <input
          type="text"
          list="llm-models"
          data-testid="llm-model"
          value={llm.choice.model}
          spellcheck={false}
          autocapitalize="off"
          autocomplete="off"
          placeholder={text.modelPlaceholder}
          onInput={(event) => llm.onChoice({ ...llm.choice, model: event.currentTarget.value })}
        />
      </label>
      <datalist id="llm-models" data-testid="llm-models">
        {llm.models.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <label class="field">
        <span>{text.effort}</span>
        <select
          data-testid="llm-effort"
          value={llm.choice.effort ?? 'default'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            llm.onChoice({ ...llm.choice, effort: isReasoningEffort(value) ? value : null });
          }}
        >
          <option value="default">{text.modelEffort}</option>
          {REASONING_EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {commonText().efforts[effort]}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span>{text.apiKey}</span>
        <input
          type="password"
          data-testid="llm-key"
          value={llm.apiKey}
          autocomplete="off"
          placeholder={llm.proxy ? text.apiKeyOptional : 'sk-or-…'}
          onInput={(event) => llm.onApiKey(event.currentTarget.value)}
        />
      </label>
      <p class={`field-hint${problem ? ' problem' : ''}`} data-testid="llm-hint">
        {hint}{' '}
        {!llm.apiKey.trim() && !llm.proxy && (
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
            {text.getKey}
          </a>
        )}
      </p>
    </div>
  );
}

const PLAYERS = ['classic', 'llm'] as const;

function Rules() {
  const text = startText();
  return (
    <section class="rules" aria-labelledby="rules-label">
      <h2 id="rules-label" class="section-label">
        {text.howToPlay}
      </h2>
      <ul>
        {text.rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </section>
  );
}

function LanguagePicker({ language }: { language: LanguageSettings }) {
  return (
    <section aria-labelledby="language-label">
      <h2 id="language-label" class="section-label">
        {startText().language}
      </h2>
      <div class="segmented" role="radiogroup" aria-labelledby="language-label">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            role="radio"
            lang={locale}
            aria-checked={language.locale === locale}
            class={language.locale === locale ? 'on' : ''}
            data-testid={`lang-${locale}`}
            onClick={() => language.onChange(locale)}
          >
            {LOCALE_NAMES[locale]}
          </button>
        ))}
      </div>
    </section>
  );
}

interface SettingsProps {
  llm: LlmSettings;
  problem: string | null;
  language?: LanguageSettings;
  audio?: AudioToggles;
  onClose: () => void;
}

function Settings({ llm, problem, language, audio, onClose }: SettingsProps) {
  const text = startText();
  return (
    <div class="settings" role="dialog" aria-label={text.settings} data-testid="settings">
      <ScreenBar
        title={text.settings}
        backLabel={text.closeSettings}
        backTestId="btn-settings-close"
        onBack={onClose}
      />
      <div class="settings-body">
        {language && <LanguagePicker language={language} />}
        {audio && <SoundToggles audio={audio} />}
        <section aria-labelledby="ai-player-label">
          <h2 id="ai-player-label" class="section-label">
            {text.whoPlaysAi}
          </h2>
          <div class="segmented" role="radiogroup" aria-labelledby="ai-player-label">
            {PLAYERS.map((kind) => (
              <button
                key={kind}
                type="button"
                role="radio"
                aria-checked={llm.choice.kind === kind}
                class={llm.choice.kind === kind ? 'on' : ''}
                data-testid={`ai-${kind}`}
                onClick={() => llm.onChoice({ ...llm.choice, kind })}
              >
                {text[kind]}
              </button>
            ))}
          </div>
          {llm.choice.kind === 'llm' && <LlmFields llm={llm} problem={problem} />}
        </section>
        <Rules />
      </div>
    </div>
  );
}

interface ModeRowProps {
  testId: string;
  title: string;
  icon: ComponentChildren;
  entry: ModeEntry;
}

function ModeRow({ testId, title, icon, entry }: ModeRowProps) {
  const { status, onOpen } = entry;
  return (
    <button type="button" class="mode-row" data-testid={testId} onClick={onOpen}>
      <span class="mode-icon">{icon}</span>
      <span class="mode-text">
        <b>{title}</b>
        <span data-testid={`${testId}-status`}>{status}</span>
      </span>
      <ChevronRightIcon />
    </button>
  );
}

export function StartScreen({
  choice,
  onChange,
  onView,
  onPlay,
  onWatch,
  llm,
  language,
  audio,
  customs = [],
  expedition,
  draft,
  myDecks,
}: StartScreenProps) {
  const [picking, setPicking] = useState<PlayerId | null>(null);
  const [settings, setSettings] = useState(false);
  const matchup = useRef<HTMLDivElement>(null);
  const lastTop = useRef<number | null>(null);
  const problem = llmProblem(llm.choice, llm.apiKey, llm.proxy);

  const pick = (seat: PlayerId | null): void => {
    lastTop.current = matchup.current?.getBoundingClientRect().top ?? null;
    setPicking(seat);
  };

  useLayoutEffect(() => {
    const element = matchup.current;
    const from = lastTop.current;
    lastTop.current = null;
    if (!element || from === null || typeof element.animate !== 'function' || prefersReducedMotion()) return;
    const offset = from - element.getBoundingClientRect().top;
    if (Math.abs(offset) < 1) return;
    element.animate([{ translate: `0 ${offset}px` }, { translate: '0 0' }], {
      duration: 340,
      easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    });
  }, [picking]);

  const common = commonText();
  const text = startText();
  const names = [common.you, llm.choice.kind === 'llm' ? common.aiLlm : common.ai] as const;
  return (
    <main class={`start${picking === null ? '' : ' picking'}`} data-testid="start-screen">
      <div class="start-body">
        <header class="start-head">
          <div class="start-title">
            <div>
              <h1>{common.title}</h1>
              <p class="tagline">{text.tagline}</p>
            </div>
            <button
              type="button"
              class="icon-btn settings-btn"
              aria-label={text.settings}
              data-testid="btn-settings"
              onClick={() => setSettings(true)}
            >
              <GearIcon />
            </button>
          </div>
        </header>

        <div class="matchup" ref={matchup}>
          <Versus
            choice={choice}
            customs={customs}
            picking={picking}
            names={names}
            onPick={(seat) => pick(picking === seat ? null : seat)}
          />
          {picking !== null && (
            <DeckPicker
              seat={picking}
              choice={choice}
              customs={customs}
              onChange={onChange}
              onView={onView}
              onDone={() => {
                matchup.current?.querySelector<HTMLElement>(`.seat-${picking}`)?.focus();
                pick(null);
              }}
            />
          )}
        </div>

        {picking === null && (
          <>
            {problem && (
              <p class="field-hint problem" data-testid="start-problem">
                {problem}{' '}
                <button type="button" class="hint-link" onClick={() => setSettings(true)}>
                  {text.openSettings}
                </button>
              </p>
            )}

            {(expedition || draft || myDecks) && (
              <section class="start-section modes" aria-labelledby="modes-label">
                <h2 id="modes-label" class="section-label">
                  {text.moreModes}
                </h2>
                {expedition && (
                  <ModeRow testId="btn-expedition" title={text.expedition} icon={<MapIcon />} entry={expedition} />
                )}
                {draft && <ModeRow testId="btn-draft" title={text.draft} icon={<PackIcon />} entry={draft} />}
                {myDecks && <ModeRow testId="btn-my-decks" title={text.myDecks} icon={<CardsIcon />} entry={myDecks} />}
              </section>
            )}
          </>
        )}
      </div>

      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-play" disabled={!!problem} onClick={onPlay}>
          {text.play}
        </button>
        <button type="button" class="btn secondary" data-testid="btn-watch" disabled={!!problem} onClick={onWatch}>
          {text.watch}
        </button>
      </div>
      {settings && (
        <Settings llm={llm} problem={problem} language={language} audio={audio} onClose={() => setSettings(false)} />
      )}
    </main>
  );
}
