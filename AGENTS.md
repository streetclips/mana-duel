# Mana Duel

Minimalist, mobile-first card duel on the rules of Magic: The Gathering, played in Spanish: fourteen decks, one per
pair of colors, black, red and green alone, and one of all five colors, and a human against an AI: the classic one,
or an OpenRouter model through the AI SDK, one duel at a time, seven in a row in the Expedition, or a best of three
with cards from packs in the Draft.
TypeScript, Preact, Vite; Vitest and Playwright.

## Layout

```
src/engine/  rules: pure functions over a serializable GameState ◄──┐
src/ai/      chooseAction(state, player) via engine rollouts ───────┤ all read the engine
src/llm/     LLM player: seat view, legal moves as a zod schema ────┘
src/app/     GameController (decks per seat, AI timers, async LLM seat, auto-pass, log, fx cues, replay),
             modes: Expedition runs and Draft runs (expedition.ts, draft.ts, pure; their controllers follow their
             games with DuelTracker and save them), your own decks (deckBuilding.ts, DeckLibrary),
             window.manaDuel, feature checks
src/ui/      Preact views of controller.state; every tap becomes an engine Action; start screen with a deck box
             per seat that opens onto the deck picker, a gear for its settings (sound, who plays the AI, how to
             play), deck viewer, the Expedition and Draft screens, your decks and the deck builder; card art from
             public/cards/; animations of the fx cues (fx.ts, motion.ts)
src/audio/   music and sound effects synthesized with Web Audio: a theme per deck whose mood follows the game, a
             sound per fx cue; GameAudio starts on the first tap
tests/       Vitest: engine, ai, llm, app, ui (happy-dom), audio (fake AudioContext) e2e/  Playwright on the
             production build
scripts/     sim.ts (headless AI games in every matchup + invariants, in parallel), cards.ts (writes docs/CARDS.md),
             openrouterProxy.ts (dev server proxy that adds OPENROUTER_API_KEY)
```

## Engine model

- `applyAction(state, action)` returns a new state or throws `IllegalActionError`; `tryApplyAction` returns
  `{ ok, error }` instead. Input states are never mutated.
- `state.pending` is the single decision the game waits for — `priority`, `declareAttackers`, `declareBlockers`,
  `chooseTargets`, `mulligan`, `bottom`, `discard` (at cleanup, or with the `source` of the effect that asks for it)
  or `gameOver` — and `getLegalActions(state)` lists the moves of `pending.player`.
- Randomness lives in `state.rng`, seeded: a seed plus its action list replays a game exactly.
- `createScenario(spec)` builds any position with named card ids; it is the fastest way to exercise a rule.

## Verify a change

1. After editing cards or decks, run `npm run cards` to regenerate `docs/CARDS.md`.
2. Run `npm run verify` (typecheck, unit tests, 196 AI-vs-AI games, one per matchup, with invariant checks,
   production build). Done when it exits 0.
3. After changing cards, decks or the AI, check the balance with `npm run sim -- --games 3000 --quiet` (under a
   minute on ten CPUs: games run in one process per CPU, and `--workers N` changes how many, never the results): every
   `decks.*.winRate` should stay between about 0.42 and 0.58. With 196 matchups, smaller runs are noise, and one run
   of 3000 still moves a deck by about 2 to 3 points: settle a close call with a second `--seed`. To compare two
   versions of a card, run the same `--seed` before and after, with `--decks <id>,all` to play only that deck's
   matchups.
4. For UI or audio changes, also run `npm run test:e2e` (two phone viewports, and `e2e/desktop.spec.ts`, a desktop
   browser whose scrollbars take room: headless Chromium hides them otherwise). Done when every test passes.
5. Steps 1–4 never reach OpenRouter. `npm run test:live` makes real calls and spends credits: run it only when asked.

## Driving the running game

`npm run dev` serves http://localhost:5173.

- URL parameters: `seed`, `first=you|ai`, `aiDelay` (ms), `skipMulligan=1`, `autoplay=1` (AI plays both seats),
  `deck=<id>|random` (yours; one of your decks by its `mine-<n>` id too), `aiDeck=<id>|random`, `ai=llm` with `model=<openrouter id>` and `effort=minimal|low|medium|high`
  (the LLM plays the AI seat), `autoPass=off|on` (off: you pass by hand wherever you could act; the menu toggle is
  remembered), `theme=dark|light`, `fx=off|slow|<speed>` (animations), `music=on|off` and `sfx=on|off` (over the
  remembered toggles; `off` keeps a browser you drive quiet). Decks default to `emberwild`.
  Any of `seed`, `first`, `skipMulligan`, `autoplay`, `deck`, `aiDeck`, `ai`, `model`, `effort` skips the start screen.
- `window.manaDuel` (`manaDuel.help()` prints it): read with `state()`, `describe()`, `pending()`,
  `legalActions()`, `decks()` (yours too, with `custom` and `playable`), `matchup()`; act for player 0 with `dispatch(action)`, `pass()`, `endTurn()`,
  `setAutoPass(on)`;
  `settle()` runs the AI immediately and stops where the LLM must answer; `await idle()` waits until you decide or the
  game ends; `newGame({ decks: ['dawntide', 'duskmire'], opponent: { kind: 'llm', model } })`, `loadScenario(spec)`,
  `replay()`, `runChecks()`, `fx(since)` for the animation cues of recent actions, `opponent()`, `llmDecisions()`,
  `await llmPrompt()` (what the LLM gets now), `audio.*` for the music and sounds (`audio.played(fxSeq)` lists the
  sounds of the actions after it), `expedition.*` to drive a run (`start({ deck, seed })`, `fight()`, `state()`,
  `chooseCard(id)`, `swapCard(id)`, `chooseRelic(id)`), `draft.*` to drive a draft (`start({ format, seed })`,
  `pick(id)`, `saveDeck()`, `play()`, `state()`), `saveDeck({ name, cards })` and `deleteDeck(id)` for your decks,
  and `engine.*` for pure engine calls.
- DOM hooks (`data-testid`): `card-<cardId>` (plus `data-zone`, `data-def`, `data-tapped`; on the battlefield it
  holds its keyword icons `.icon[data-icon]`, `trigger` for a trigger that can still happen, and the pills
  `ability-<cardId>-<n>`, with `data-usable` while you can activate it, and `ability-<cardId>-mana`, with
  `data-spent` once the creature is tapped or summoning sick), `player-<0|1>`,
  `life-<0|1>`, `deck-name-<p>`, `prompt`, `phase`, `stack`, `stack-<itemId>` (plus `data-card`, `data-targetable`),
  `hand`, `lands-<p>`, `battlefield-<p>`, `btn-<id>` for bar buttons, and `card-sheet` (a long press or right click opens
  any card in it, in the game, the modes and the deck screens) with `sheet-<actionType>` for its actions.
  `btn-menu` opens the menu; `menu-log` opens `log-panel`, where each card a line names is a `log-card-<cardId>` button
  that opens that card above the log, read-only, with where it is now. The result screen: `game-over`,
  `game-over-title`, `btn-play-again`, `btn-home` (back to the start screen), `btn-view-log`.
  Start screen: `seat-<p>` (a deck box: `data-deck`, `aria-expanded`) opens `deck-picker` (`data-seat`), which holds
  `deck-<deckId|random>` or `opponent-<deckId|random>` radios (`aria-checked`), `deck-detail`, `deck-view-<deckId>` and
  `btn-picker-done`; each box's `.deck-box[data-open]` tells whether its lid is open. `btn-settings` opens `settings`
  (`btn-settings-close`), with `ai-classic`, `ai-llm`, `llm-model`, `llm-effort`, `llm-key`, `llm-hint`, the sound
  toggles and how to play; `start-problem` says what the LLM still lacks, `btn-play`, `btn-watch`. LLM in game: `player-tag-1`,
  `llm-notice` (unavailable, `llm-notice-hide` closes it), `game[data-llm]` (`thinking`, `ready`, `unavailable`). Deck viewer: `deck-viewer` (`data-deck`), `deck-card-<defId>` (`data-count`),
  `deck-tab-<p>` in game, `mana-curve`, `btn-deck-close`; `menu-decks` opens it in game.
  `menu-autopass` (`aria-checked`) toggles auto-pass. Expedition: `btn-expedition` (start screen) opens `expedition`
  (`data-stage`: `new`, `duel`, `card`, `swap`, `relic`, `won`, `lost`), with `expedition-deck-<deckId>`,
  `btn-expedition-start`, `expedition-floor-<n>` (`data-state`, `data-deck`), `btn-expedition-fight`,
  `btn-expedition-deck`, `run-deck-size`, `relic-<id>`, `reward-card-<defId>`, `btn-reward-take`, `btn-reward-skip`,
  `swap-card-<defId>`, `btn-swap-confirm`, `btn-swap-add`, `relic-option-<id>`, `btn-relic-take`, `expedition-result`
  (`data-result`), `btn-expedition-new`. Draft: `btn-draft` (start screen) opens `draft` (`data-stage`: `new`,
  `picking`, `building`, `match`, `done`), with `draft-format-<draft|sealed>`, `btn-draft-start`, `draft-card-<defId>`,
  `btn-draft-pick`, `draft-pick-count`, `btn-draft-picks`, `btn-draft-build`, `draft-score`, `btn-draft-play`,
  `btn-draft-edit`, `draft-result-title`, `btn-draft-save`, `btn-draft-ai-deck`, `btn-draft-new`, `btn-draft-abandon`.
  In a mode's game the rival's bar shows `duel-badge-1`, and the result screen and the bar continue the mode with
  `btn-mode-continue` and `btn-mode-next` instead of `btn-play-again`. Your decks: `btn-my-decks` (start screen) opens
  `decks-screen`, with `my-deck-<id>` (`data-playable`), `btn-edit-<id>`, `btn-delete-<id>` (`btn-delete-yes`),
  `copy-<deckId>` and `btn-new-deck`, which open `deck-builder` (`data-tab`): `builder-name`, `btn-builder-save`,
  `btn-builder-back` (`builder-leave` asks first), `builder-count`, `builder-problems`, `builder-tab-deck|pool`,
  `builder-deck-<defId>` and `builder-pool-<defId>` (`data-count`) with `add-<defId>` and `remove-<defId>`,
  `builder-search`, `builder-color-<W|U|B|R|G>`, `builder-kind-<all|creature|spell|land>`, `btn-builder-fill`; the
  pickers list them after `picker-custom`. Audio: `menu-music`, `menu-sfx` (`aria-checked`), the settings'
  `btn-music`, `btn-sfx` (`aria-pressed`), and `html[data-audio]` (`none` until the first tap, `running`, `suspended`,
  `unsupported`), `html[data-music]` (theme id or `off`), `html[data-mood]`.
- Animations (fx): every animated element carries `data-fx` with the cue kinds it plays (`[data-slot="<cardId>"]` on
  battlefield cards, `player-<p>`, hand cards, land pips, stack items), and `fx-ghost-<cardId>` (a creature fading
  out where it died or bounced), `fx-reveal` (the card the opponent plays), `fx-turn`, `fx-hurt`, `fx-life-<p>`,
  `fx-float-<cardId>` and `fx-drawn-<p>` show one each; `data-aimed` marks what the stack targets. Hooks stay until
  a newer action animates something; `game[data-fx-seq]` is the latest cue batch drawn, and `settle()` draws the
  last dozen batches at once. For a screenshot, `await manaDuel.freezeFx(0.4)` in the same `evaluate` as the action
  holds everything still moving at 40% (`freezeFx(null)` resumes); `manaDuel.fxSeq()` before acting scopes `fx(since)`.
- Browsers stall timers in background windows, the Playwright MCP window included: pass `aiDelay=0` and call
  `manaDuel.settle()` rather than waiting for the AI. With `aiDelay` above 0 the AI also waits for the animations of
  the opponent's plays and of combat.
- Sound starts only after a tap or key on the page, and an `evaluate` is no tap: click something, or
  `await manaDuel.audio.unlock()`.

## References

- `docs/VERIFICATION.md` — map of every feature to its tests and built-in check; read it when verifying or adding
  a feature.
- `docs/RULES.md` — implemented rules, automatic passing, differences from Magic; read it for any rules question.
- `docs/CARDS.md` — generated card and keyword list.
- `docs/LLM.md` — LLM opponent: prompt, answer schemas, fallbacks, keys and dev proxy, live tests; read it before
  touching `src/llm` or the controller's AI seat.
- `docs/AUDIO.md` — music and sound effects: themes per color, moods, the sound of each fx cue, mix, test hooks; read
  it before touching `src/audio` or giving a cue a sound.
- `docs/MODES.md` — the Expedition (rivals and their tuning, rewards, relics), the Draft (packs, the AI's picks and
  decks, the match), your own decks (rules, builder, library) and how a mode follows its games; read it before
  touching `src/app/expedition*.ts`, `draft*.ts`, `deck*.ts`, `duelTracker.ts`, their screens, or a relic.

## Extending

- A card is one typed `CardDef` in `src/engine/cards/<id>.ts`, listed in `src/engine/cards/index.ts`; its rules text
  is generated by `src/engine/describe.ts`. Its art is `public/cards/<id>.svg` on a 120×80 viewBox with the subject
  centred: it fills the whole card, so a battlefield card shows about its central half, with keyword icons in the
  top-left corner, ability pills above the bottom edge and the P/T in the bottom-right corner, and a hand card lays
  its name and text over the bottom third. Its `name`, `subtypes` and `flavor` are Spanish; `subtypes` follow a
  Spanish type line (`['Soldado', 'Humano']` prints «Soldado humano»), and the name fits the two-line name box of a
  hand card (68 px wide, 60 px on short screens, so a word of eleven letters seldom fits): `e2e/game.spec.ts` checks
  that no `.card .name` in hand overflows.
- A token is a creature `CardDef` with `token: true`, its `colors` and no cost, filed and drawn like any card but in
  no deck; a `createTokens` effect names it. Tokens get ids `tk<n>` and, once they leave the battlefield, stay in
  `state.cards` with zone `gone` so the log and the animations can still name them.
- A new effect, trigger or keyword touches `src/engine/types.ts`, its behaviour where it happens (`effects.ts`,
  `combat.ts`, `rules.ts` for timing, `game.ts` for cast triggers and costs, `state.ts` `moveCard` for enters, dies
  and "another creature" triggers), its text in `describe.ts`, its short label in `src/ui/cardInfo.ts` (a keyword,
  its icon in `src/ui/components/KeywordIcon.tsx`), and
  `src/ai/evaluate.ts` when it changes what a creature is worth. An effect that waits for a player's choice sets
  `state.pending` during resolution (see the `discard` effect) and needs a case in `src/ai/rollout.ts`. State a
  creature keeps on the battlefield, like +1/+1 counters, also needs its reset in `moveCard`, a rule in
  `invariants.ts`, a scenario field and a place in `src/llm/view.ts`; state a player keeps for the turn, like
  `damagedThisTurn`, resets in `goToNextStep` and needs the same scenario field and view. A keyword that triggers
  (undying, evolve, prowess) is a negative ability index in `state.ts` (`UNDYING_TRIGGER`, `EVOLVE_TRIGGER`,
  `PROWESS_TRIGGER`) with its text in `triggerText`; a trigger's `condition` (bloodthirst's `opponentDamaged`) is
  checked by `conditionHolds` when it would trigger. Cover it with a scenario test in `tests/engine` and a check in
  `src/app/checks.ts`.
- A new `GameEvent` animates once `src/app/fx.ts` turns it into a cue (`tests/app/fx.test.ts`) and `src/ui/fx.ts`
  gives the cue its hooks and overlays (`tests/ui/animations.test.tsx`, `e2e/animations.spec.ts`); it sounds once
  `soundsOf` in `src/audio/cues.ts` maps the cue to a sound (`tests/audio/cues.test.ts`).
- Decks live in `src/engine/decks.ts`: 40 cards, 16 lands, only the deck's colors, and no nonland card shared with
  another deck (basic lands may be). `featured` names the card whose art is on the deck's box. A new deck
  appears in both seats' pickers, the viewer, the simulator and `docs/CARDS.md` on its own, and gets a music theme
  from its colors.

## Conventions

- Code, docs, tests, commit messages and developer-facing strings (`manaDuel.help()`, check titles, programmer
  errors, the output of `npm run sim`) are English. Code carries no comments: names and tests explain it.
- Every text the player reads is Spanish: card and deck names, rules text, the UI, the log, engine refusals (they
  reach toasts and prompts) and the LLM prompt (its reasons reach the log). Rules text follows the official Spanish
  templates of Magic, built in `src/engine/describe.ts`; the log and the prompts call the other player «el rival».
  Ids of cards, decks, test hooks and URL parameters keep their English names.
- Tests build positions with `scenario(...)` and explicit card ids (`tests/helpers.ts`); seeds are for whole games.
- The AI and the LLM read only public state, their own hand and card counts; `tests/ai/ai.test.ts` › AI fairness and
  `tests/llm/player.test.ts` › the LLM prompt guard this.
