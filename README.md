# Mana Duel

A minimalist, mobile-first card duel built on the rules of Magic: The Gathering. Three decks — **Emberwild** (red and
green), **Dawntide** (white and blue) and **Duskmire** (black) — and one opponent: an AI that plays by the same rules
and never looks at your hand.

## Play

```sh
npm install
npm run dev        # http://localhost:5173 — open it on your phone through your LAN address too
npm run build      # static site in dist/, served by `npm run preview`
```

- Pick your deck and the AI's on the start screen (or let chance pick the AI's); **View** opens a deck with every
  card, its mana curve and card details. The in-game menu shows both decks too.
- Tap a card to read it; the sheet that opens holds its actions (play, cast, activate). Long-press or right-click
  inspects any card.
- Targets glow when a spell needs one: tap the creature or the player, or the spell in the center strip for a
  counterspell.
- Attack by tapping your creatures, then **Attack**. Block by tapping your creature, then the attacker it should
  stop. Numbered badges pair attackers with their blockers.
- Priority passes by itself while there is nothing to decide; **End turn** skips straight to the opponent.
- **Watch AI vs AI** on the start screen lets the AI play both seats.
- Every change is animated: the card the opponent plays is shown with its target, creatures strike each other in
  combat, damage and life changes pop, the dead fade out in their place, drawn cards slide into your hand and each
  turn is announced. `?fx=slow` plays them in slow motion and `?fx=off` turns them off.

## What is inside

- **Rules engine** (`src/engine`): turn structure, priority and the stack, instants in response, London mulligan,
  one land per turn, automatic mana payment, summoning sickness, combat with first strike, double strike,
  trample, deathtouch, lifelink, flying and reach, menace, vigilance, haste and defender, triggered and activated
  abilities, counterspells, returning creatures to hand, `-N/-N`, paying life, fizzling, cleanup and hand size,
  every way to win or lose. Pure, deterministic and seeded, so any game can be replayed. Details in
  [`docs/RULES.md`](docs/RULES.md).
- **AI** (`src/ai`): evaluates each option by playing the engine forward, predicts blocks with its own blocking
  logic, keeps combat tricks for combat, answers burn with pumps, counters what is worth countering and only
  chump-blocks to survive. A test proves hidden cards never change its decisions. It plays all three decks, and
  simulated games between them stay close to even.
- **App** (`src/app`, `src/ui`): Preact UI tuned for one-handed phone play, a deck selector and deck viewer, light
  and dark themes, a game log, animations driven by cues that tests and agents can read, and an automation API on
  `window.manaDuel`.
- **Cards**: 49 cards — 44 that belong to a single deck (16 in Emberwild, 14 each in Dawntide and Duskmire) and
  the five basic lands, which any deck may use — each with its own SVG illustration in `public/cards/`, listed in
  [`docs/CARDS.md`](docs/CARDS.md) (generated from the definitions).

## Testing and verification

| Command | What it proves |
| --- | --- |
| `npm test` | Engine, AI, controller and UI tests (Vitest, happy-dom), including 38 feature checks |
| `npm run sim -- --games 270` | Headless AI games in all nine deck matchups, with invariant checks after every action and per-deck win rates (`--decks dawntide,duskmire` for one matchup) |
| `npm run test:e2e` | Playwright on the production build, two phone viewports |
| `npm run verify` | Typecheck, tests, 60 simulated games and the build, in one go |

[`docs/VERIFICATION.md`](docs/VERIFICATION.md) maps every feature to its tests. With the game open,
`manaDuel.runChecks()` runs the same feature checks inside the browser, and `manaDuel.help()` lists the rest of
the automation API. [`AGENTS.md`](AGENTS.md) is the guide for coding agents.

## Project structure

```
index.html · src/main.tsx
src/
├── engine/   types, cards/ (one file per card), registry, decks, mana, state, targets, combat,
│             effects, rules, game, actions, scenario, describe, invariants
├── ai/       evaluate, rollout, combat, heuristics, chooseAction
├── app/      controller, autopass, fx (animation cues), testApi, checks
└── ui/       App, StartScreen (deck selector), Game, model (interaction logic), deckChoice, fx and motion
              (animations), components/ (Board, Card, DeckViewer, Fx, Overlays), styles.css
public/cards/ one SVG illustration per card, named <id>.svg
tests/        engine/ ai/ app/ ui/ + helpers.ts
e2e/          Playwright specs
scripts/      sim.ts, cards.ts
docs/         RULES.md, VERIFICATION.md, CARDS.md
```

Mana Duel is an independent fan project inspired by Magic: The Gathering, a trademark of Wizards of the Coast. Card
names and texts are original.
