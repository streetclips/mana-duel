# Mana Duel

A minimalist, mobile-first card duel built on the rules of Magic: The Gathering. One deck — **Emberwild**, red and
green — and one opponent: an AI that plays by the same rules and never looks at your hand.

## Play

```sh
npm install
npm run dev        # http://localhost:5173 — open it on your phone through your LAN address too
npm run build      # static site in dist/, served by `npm run preview`
```

- Tap a card to read it; the sheet that opens holds its actions (play, cast, activate). Long-press or right-click
  inspects any card.
- Targets glow when a spell needs one: tap the creature or the player.
- Attack by tapping your creatures, then **Attack**. Block by tapping your creature, then the attacker it should
  stop. Numbered badges pair attackers with their blockers.
- Priority passes by itself while there is nothing to decide; **End turn** skips straight to the opponent.
- **Watch AI vs AI** on the start screen lets the AI play both seats.

## What is inside

- **Rules engine** (`src/engine`): turn structure, priority and the stack, instants in response, London mulligan,
  one land per turn, automatic mana payment, summoning sickness, combat with first strike, double strike,
  trample, deathtouch, lifelink, flying and reach, menace, vigilance, haste and defender, triggered and activated
  abilities, fizzling, cleanup and hand size, every way to win or lose. Pure, deterministic and seeded, so any
  game can be replayed. Details in [`docs/RULES.md`](docs/RULES.md).
- **AI** (`src/ai`): evaluates each option by playing the engine forward, predicts blocks with its own blocking
  logic, keeps combat tricks for combat, answers burn with pumps and only chump-blocks to survive. A test proves
  hidden cards never change its decisions.
- **App** (`src/app`, `src/ui`): Preact UI tuned for one-handed phone play, light and dark themes, a game log,
  and an automation API on `window.manaDuel`.
- **Cards**: 18 cards, listed in [`docs/CARDS.md`](docs/CARDS.md) (generated from the definitions).

## Testing and verification

| Command | What it proves |
| --- | --- |
| `npm test` | Engine, AI, controller and UI tests (Vitest, happy-dom), including 27 feature checks |
| `npm run sim -- --games 200` | Headless AI games with invariant checks after every action |
| `npm run test:e2e` | Playwright on the production build, two phone viewports |
| `npm run verify` | Typecheck, tests, 60 simulated games and the build, in one go |

[`docs/VERIFICATION.md`](docs/VERIFICATION.md) maps every feature to its tests. With the game open,
`manaDuel.runChecks()` runs the same feature checks inside the browser, and `manaDuel.help()` lists the rest of
the automation API. [`AGENTS.md`](AGENTS.md) is the guide for coding agents.

## Project structure

```
index.html · src/main.tsx
src/
├── engine/   types, cards, decks, mana, state, targets, combat, effects, rules, game, actions,
│             scenario, describe, invariants
├── ai/       evaluate, rollout, combat, heuristics, chooseAction
├── app/      controller, autopass, testApi, checks
└── ui/       App, Game, model (interaction logic), components/, styles.css
tests/        engine/ ai/ app/ ui/ + helpers.ts
e2e/          Playwright specs
scripts/      sim.ts, cards.ts
docs/         RULES.md, VERIFICATION.md, CARDS.md
```

Mana Duel is an independent fan project inspired by Magic: The Gathering, a trademark of Wizards of the Coast. Card
names and texts are original.
