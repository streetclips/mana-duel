import { describe, expect, it } from 'vitest';
import { createGame, tryApplyAction, type GameState } from '../../src/engine';
import { DEFAULT_MODEL, createLlmPlayer, isReasoningEffort, openRouterModel, type LlmPlayer } from '../../src/llm';
import { attack, cast, pass, passTo, scenario } from '../helpers';

const live = process.env.LLM_LIVE === '1';
const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
const effort = process.env.OPENROUTER_EFFORT;
const reasoningEffort = isReasoningEffort(effort) ? effort : undefined;
const TIMEOUT_MS = 120_000;

type Decks = readonly [string, string] | null;

const positions: [string, () => GameState, Decks][] = [
  [
    'keeps or mulligans an opening hand',
    () => createGame({ seed: 7, startingPlayer: 1, players: [{ deck: 'emberwild' }, { deck: 'duskmire' }] }),
    ['emberwild', 'duskmire'],
  ],
  [
    'acts in its main phase',
    () =>
      scenario({
        activePlayer: 1,
        players: [
          { life: 3, battlefield: [{ card: 'grove_tender', id: 'elf' }] },
          {
            hand: [
              { card: 'forest', id: 'f' },
              { card: 'ember_snap', id: 'snap' },
            ],
            battlefield: ['mountain', 'forest'],
          },
        ],
      }),
    null,
  ],
  [
    'declares attackers',
    () =>
      passTo(
        scenario({
          activePlayer: 1,
          players: [
            { life: 4, battlefield: ['grove_tender'] },
            {
              battlefield: [
                { card: 'timberland_rhino', id: 'rhino' },
                { card: 'ember_hound', id: 'hound' },
              ],
            },
          ],
        }),
        'declareAttackers',
      ),
    null,
  ],
  [
    'blocks a menace attacker legally',
    () =>
      passTo(
        attack(
          scenario({
            players: [
              { battlefield: [{ card: 'ridge_marauder', id: 'marauder' }] },
              {
                life: 3,
                battlefield: [
                  { card: 'canopy_spider', id: 's1' },
                  { card: 'canopy_spider', id: 's2' },
                ],
              },
            ],
          }),
          ['marauder'],
        ),
        'declareBlockers',
      ),
    null,
  ],
  [
    'aims a trigger',
    () =>
      pass(
        pass(
          cast(
            scenario({
              activePlayer: 1,
              step: 'main2',
              players: [
                { battlefield: [{ card: 'moss_viper', id: 'viper' }] },
                { hand: [{ card: 'cinder_adept', id: 'adept' }], battlefield: ['mountain', 'mountain', 'mountain'] },
              ],
            }),
            'adept',
          ),
        ),
      ),
    null,
  ],
];

describe.runIf(live)(`OpenRouter, live (${model}${reasoningEffort ? `, ${reasoningEffort} effort` : ''})`, () => {
  let player: LlmPlayer;

  it('has an API key', () => {
    expect(apiKey, 'set OPENROUTER_API_KEY (in the shell or in .env.local)').toBeTruthy();
    player = createLlmPlayer({
      model: openRouterModel({ model, apiKey, reasoningEffort }),
      timeoutMs: TIMEOUT_MS - 10_000,
    });
  });

  it.each(positions)(
    '%s',
    async (_, build, decks) => {
      const s = build();
      const decision = await player.decide(s, 1, { decks });
      console.log(
        `${s.pending?.kind}: ${JSON.stringify(decision.action)} — ${decision.reason ?? decision.error} (${decision.ms} ms, $${decision.usage?.cost ?? '?'})`,
      );
      expect(decision.error).toBeUndefined();
      expect(decision.source).toBe('model');
      expect(tryApplyAction(s, decision.action).ok).toBe(true);
    },
    TIMEOUT_MS,
  );
});
