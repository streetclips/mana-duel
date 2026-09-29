# LLM opponent

The AI seat can be played by a language model from [OpenRouter](https://openrouter.ai) instead of the classic AI.
The classic AI stays the default, and it also makes every move the model fails to make. The model gets the game from
its own seat and picks among the legal moves; the engine checks every answer before it is played.

## Flow of one decision

```
GameController (AI seat, src/app/controller.ts)
  │ only one legal action ──► plays it at once, the model is not asked
  ▼
LlmPlayer.decide(state, seat, { decks, recentEvents, recentThoughts, signal })   src/llm/player.ts
  ├─ decisionFor(state, seat)      options, question, zod schema, toAction   src/llm/decision.ts
  ├─ buildPrompt(...)              system rules + user message               src/llm/prompt.ts, view.ts
  ├─ generateText({ output: Output.object({ schema }) })   AI SDK → OpenRouter (json_schema, strict)
  ├─ toAction(answer) + tryApplyAction          an illegal answer is refused with the engine's reason
  │     refused or unparsable ──► asks again with the reason (2 attempts)
  └─ still nothing ──► the classic AI's chooseAction plays the move, marked `fallback`
```

The seat has no auto-pass: the model answers every decision with more than one legal choice, about 55 in a game
(simulated with the classic AI's moves). The human's auto-pass rules would skip about 10 of them, windows where the
classic AI passes 96% of the time.

`generateObject` is deprecated in AI SDK 7; `generateText` with `Output.object` sends OpenRouter the same
`response_format: json_schema` request and throws the same `NoObjectGeneratedError` on a bad answer.

## What the model sees

Every call is stateless (one system prompt and one user message, no chat history). The user message has six
sections, the constant ones first so providers can cache the prefix:

1. **Cards in this game**: every card of both decks plus any visible card, one `cardSummary` line each.
2. **Decks**: both deck lists (public in this app: the in-game menu shows them).
3. **Recent events**: the last 30 log lines from the AI seat, the other player called "Opponent".
4. **Your recent thoughts**: the `reason` of its last 10 decisions that were played, each with its turn and step
   (`thoughtLine`), so it can keep to a plan. Fallbacks and forced moves add none.
5. **Game state from your seat**: `playerView` as compact JSON. Its hand, both battlefields (tapped, sick, damage,
   combat, pumps and keywords granted `untilEndOfTurn`, `plusOneCounters`, `token`), graveyards, untapped mana,
   life, the stack from the top.
6. **Decision**: the question, the options and how to answer.

Hidden from the model: the opponent's hand (`handSize` only), both libraries (`libraryCards` only), the seed and
the random state. A card that left for a hidden zone shows as "a card that is no longer in play". The
`the LLM prompt › is the same whatever the hidden cards are` test in `tests/llm/player.test.ts` rebuilds the prompt
with the hidden cards shuffled at every decision of real games and expects the same text.

## Answer shapes

| Decision | Schema | Legal by construction |
| --- | --- | --- |
| `mulligan`, `priority`, `chooseTargets` | `{ reason, choice }`, `choice` an enum of the ids of every legal action | yes |
| `declareAttackers` | `{ reason, attack: { <id>: boolean } }` for every creature that can attack | yes |
| `declareBlockers` | `{ reason, blocks: { <blocker>: "none" \| <attacker> } }`, each blocker's own legal attackers | all but menace |
| `bottom`, `discard` | `{ reason, cards: <hand id>[] }`; a discard names the card that causes it, or cleanup | the count is checked after |

`reason` comes first so the model thinks before it answers; the log shows it as "AI thinks: …", and the next prompts
list it under "Your recent thoughts".

## Failures

- A refused or unparsable answer is retried once with the reason; then the classic AI plays and the log says why.
- No answer in 60 s: the classic AI plays that move.
- HTTP 400, 401, 402, 403 or 404, or no key: the model is **unavailable** for the rest of the game, the classic AI
  plays every move, and the game shows `llm-notice`. A new game builds a fresh player and tries again.
- Requests use `provider: { require_parameters: true }`, so OpenRouter routes only to providers that honour the
  schema; for a model without structured outputs it answers 404 "No endpoints found", and the model becomes
  unavailable at once.
- A stale answer (the game moved on, a new game started, the player left) is aborted and dropped.

## Keys and models

- In the browser the key is typed on the start screen and kept in `localStorage` (`manaDuel.openrouterKey`); the
  browser calls OpenRouter directly.
- `npm run dev` with `OPENROUTER_API_KEY` set (shell or `.env.local`) serves `/openrouter/v1`, a proxy that adds the
  key on the server (`scripts/openrouterProxy.ts`), so no key is typed, on a phone either. It answers only requests
  whose `Origin` is the dev server itself; anyone on the LAN can still reach it by faking that header. Production
  builds and `vite preview` have no proxy.
- Any OpenRouter model id with structured outputs works; the default is `DEFAULT_MODEL` in `src/llm/models.ts`, and
  the start screen suggests the live catalog.
- **Thinking effort** (start screen, `?effort=`, `--effort`, `OPENROUTER_EFFORT`) sends `reasoning.effort`; "Model
  default" sends nothing. With `require_parameters`, a model that does not reason gets the same 404, so the default
  stays off. Measured on `openai/gpt-6-luna`: about 4–9 s a decision by default,
  2–3 s at `low`, which also misjudged a trigger target the default got right. A decision costs about $0.0001–0.0003.
- The AI SDK, the provider and zod load on the first LLM decision, in their own chunks (`lazyLlmPlayer`).

## Tests

Offline, in `npm test`: `tests/llm/` (view, decisions, player on `MockLanguageModelV4`, the OpenRouter provider on a
fake `fetch`, whole games with random schema-valid answers), `tests/app/llm.test.ts` (the controller's async seat),
`tests/ui/llm.test.tsx`, `tests/proxy.test.ts`, and `e2e/llm.spec.ts` (the browser build with OpenRouter mocked by
`page.route`).

Live, spending OpenRouter credits (needs `OPENROUTER_API_KEY`; `OPENROUTER_MODEL` picks the model):

```sh
npm run test:live                              # one real decision of each kind
npm run sim -- --p1 llm --model <id> [--effort low] --log 1   # one whole game: reasoning, cost, fallbacks
```
