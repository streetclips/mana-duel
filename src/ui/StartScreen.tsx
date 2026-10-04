import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { PlayerId } from '../engine';
import { DeckPicker, Versus } from './components/DeckSelect';
import { ChevronRightIcon, MapIcon } from './components/ExpeditionIcons';
import { SoundToggles, type AudioToggles } from './components/SoundToggles';
import type { DeckChoice } from './deckChoice';
import { EFFORT_LABELS, REASONING_EFFORTS, isReasoningEffort } from '../llm/models';
import { prefersReducedMotion } from './motion';
import { llmProblem, type OpponentChoice } from './opponentChoice';

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

interface StartScreenProps {
  choice: DeckChoice;
  onChange: (choice: DeckChoice) => void;
  onView: (deckId: string) => void;
  onPlay: () => void;
  onWatch: () => void;
  llm: LlmSettings;
  audio?: AudioToggles;
  expedition?: ModeEntry;
}

function LlmFields({ llm, problem }: { llm: LlmSettings; problem: string | null }) {
  const hint =
    problem ??
    (llm.proxy && !llm.apiKey.trim()
      ? 'El servidor de desarrollo añade su propia OPENROUTER_API_KEY, así que aquí no hace falta ninguna clave.'
      : 'Tu clave se queda en este dispositivo. Cada decisión de la IA es una petición a OpenRouter que se cobra a esa clave. Con menos esfuerzo de razonamiento, los modelos que razonan responden antes.');
  return (
    <div class="llm-fields">
      <label class="field">
        <span>Modelo</span>
        <input
          type="text"
          list="llm-models"
          data-testid="llm-model"
          value={llm.choice.model}
          spellcheck={false}
          autocapitalize="off"
          autocomplete="off"
          placeholder="proveedor/modelo"
          onInput={(event) => llm.onChoice({ ...llm.choice, model: event.currentTarget.value })}
        />
      </label>
      <datalist id="llm-models" data-testid="llm-models">
        {llm.models.map((id) => (
          <option key={id} value={id} />
        ))}
      </datalist>
      <label class="field">
        <span>Esfuerzo de razonamiento</span>
        <select
          data-testid="llm-effort"
          value={llm.choice.effort ?? 'default'}
          onChange={(event) => {
            const value = event.currentTarget.value;
            llm.onChoice({ ...llm.choice, effort: isReasoningEffort(value) ? value : null });
          }}
        >
          <option value="default">El del modelo</option>
          {REASONING_EFFORTS.map((effort) => (
            <option key={effort} value={effort}>
              {EFFORT_LABELS[effort]}
            </option>
          ))}
        </select>
      </label>
      <label class="field">
        <span>Clave de API de OpenRouter</span>
        <input
          type="password"
          data-testid="llm-key"
          value={llm.apiKey}
          autocomplete="off"
          placeholder={llm.proxy ? 'Opcional con el servidor de desarrollo' : 'sk-or-…'}
          onInput={(event) => llm.onApiKey(event.currentTarget.value)}
        />
      </label>
      <p class={`field-hint${problem ? ' problem' : ''}`} data-testid="llm-hint">
        {hint}{' '}
        {!llm.apiKey.trim() && !llm.proxy && (
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
            Consigue una clave
          </a>
        )}
      </p>
    </div>
  );
}

function ModeRow({ testId, title, status, onOpen }: { testId: string; title: string; status: string; onOpen: () => void }) {
  return (
    <button type="button" class="mode-row" data-testid={testId} onClick={onOpen}>
      <span class="mode-icon">
        <MapIcon />
      </span>
      <span class="mode-text">
        <b>{title}</b>
        <span data-testid={`${testId}-status`}>{status}</span>
      </span>
      <ChevronRightIcon />
    </button>
  );
}

export function StartScreen({ choice, onChange, onView, onPlay, onWatch, llm, audio, expedition }: StartScreenProps) {
  const [picking, setPicking] = useState<PlayerId | null>(null);
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
    element.animate([{ translate: `0 ${offset}px` }, { translate: '0 0' }], { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }, [picking]);

  const players = [
    { kind: 'classic', label: 'Clásica' },
    { kind: 'llm', label: 'LLM' },
  ] as const;
  const names = ['Tú', llm.choice.kind === 'llm' ? 'IA · LLM' : 'IA'] as const;
  return (
    <main class={`start${picking === null ? '' : ' picking'}`} data-testid="start-screen">
      <div class="start-body">
        <header class="start-head">
          <div class="start-title">
            <div>
              <h1>Duelo de Maná</h1>
              <p class="tagline">Un duelo de cartas minimalista. Toca una caja de mazo para elegir y enfréntate a la IA.</p>
            </div>
            {audio && <SoundToggles audio={audio} />}
          </div>
        </header>

        <div class="matchup" ref={matchup}>
          <Versus choice={choice} picking={picking} names={names} onPick={(seat) => pick(picking === seat ? null : seat)} />
          {picking !== null && (
            <DeckPicker
              seat={picking}
              choice={choice}
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
            <section class="start-section" aria-labelledby="ai-player-label">
              <h2 id="ai-player-label" class="section-label">
                Quién controla la IA
              </h2>
              <div class="segmented" role="radiogroup" aria-labelledby="ai-player-label">
                {players.map((player) => (
                  <button
                    key={player.kind}
                    type="button"
                    role="radio"
                    aria-checked={llm.choice.kind === player.kind}
                    class={llm.choice.kind === player.kind ? 'on' : ''}
                    data-testid={`ai-${player.kind}`}
                    onClick={() => llm.onChoice({ ...llm.choice, kind: player.kind })}
                  >
                    {player.label}
                  </button>
                ))}
              </div>
              {llm.choice.kind === 'llm' && <LlmFields llm={llm} problem={problem} />}
            </section>

            {expedition && (
              <section class="start-section modes" aria-labelledby="modes-label">
                <h2 id="modes-label" class="section-label">
                  Más modos
                </h2>
                <ModeRow testId="btn-expedition" title="Expedición" status={expedition.status} onOpen={expedition.onOpen} />
              </section>
            )}

            <details class="rules">
              <summary>Cómo se juega</summary>
              <ul>
                <li>
                  Toca una caja de mazo para elegir tu mazo o el de la IA, o deja cualquiera de los dos al azar. Los dos
                  empezáis con 20 vidas y 40 cartas.
                </li>
                <li>
                  La IA clásica juega por su cuenta. Elige LLM para que un modelo de lenguaje de OpenRouter tome las
                  decisiones de la IA: ve lo mismo que puede ver la IA, nunca tu mano, y la IA clásica lo sustituye si no
                  responde.
                </li>
                <li>Deja a la IA a 0 vidas para ganar. Juega una tierra por turno; las tierras pagan los hechizos solas.</li>
                <li>Las criaturas no pueden atacar el turno en que llegan, salvo que tengan la habilidad de prisa.</li>
                <li>Ataca con tus criaturas; quien defiende elige las bloqueadoras. Todo el daño se hace a la vez.</li>
                <li>Los instantáneos y las criaturas con destello se pueden lanzar siempre que tengas la prioridad, incluso en respuesta a un hechizo.</li>
                <li>Un contrahechizo tiene como objetivo un hechizo de la pila: tócalo en la franja entre los dos lados.</li>
                <li>Las fichas son criaturas que crean las cartas; desaparecen al salir del campo de batalla.</li>
                <li>Toca una carta para ver qué hace. Mantenla pulsada o haz clic derecho para examinar cualquier carta.</li>
                <li>
                  En la Expedición encadenas siete duelos con el mismo mazo: cada victoria te da una carta nueva y cada tres, una
                  reliquia. Una derrota la termina.
                </li>
              </ul>
            </details>
          </>
        )}
      </div>

      <div class="start-actions">
        <button type="button" class="btn" data-testid="btn-play" disabled={!!problem} onClick={onPlay}>
          Jugar contra la IA
        </button>
        <button type="button" class="btn secondary" data-testid="btn-watch" disabled={!!problem} onClick={onWatch}>
          Ver IA contra IA
        </button>
      </div>
    </main>
  );
}
