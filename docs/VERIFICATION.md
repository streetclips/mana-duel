# Verification checklist

Each feature lists the automated tests that cover it and, when there is one, its built-in **check**: a
deterministic scenario that runs on the pure engine, in Node (`tests/app/checks.test.ts`) and in the browser build
(`e2e/game.spec.ts`). With the game open (`npm run dev`), run any check from the console or Playwright `evaluate`:

```js
manaDuel.runChecks()                 // every check; healthy when no result has ok: false
manaDuel.runChecks(['F10', 'F20'])   // just some
manaDuel.checks()                    // ids and titles
```

The checks live in `src/app/checks.ts`; that file is the source of truth for exact inputs and expected outcomes.

## Engine

| Id | Feature | Tests |
| --- | --- | --- |
| F01 | Setup: 40-card decks, seven-card hands, 20 life; the same seed gives the same game | `tests/engine/setup.test.ts` › game setup |
| F02 | London mulligan: new seven, one card to the bottom per mulligan, at most six | `tests/engine/setup.test.ts` › London mulligan · `tests/ui/game.test.tsx` › opening hand |
| F03 | Turn order; the starting player skips the first draw | `tests/engine/setup.test.ts` · `tests/engine/turn.test.ts` › turn structure, passing through a whole turn |
| F04 | One land per turn, main phase, empty stack | `tests/engine/turn.test.ts` › lands |
| F05 | Sorcery speed vs instant speed | `tests/engine/turn.test.ts` › timing |
| F06 | Priority and the stack: last in, first out; responses | `tests/engine/turn.test.ts` › priority and the stack |
| F07 | Mana: automatic payment, colors, sick mana creatures | `tests/engine/mana.test.ts` · `tests/engine/turn.test.ts` › summoning sickness |
| F08 | Summoning sickness and haste | `tests/engine/turn.test.ts` › summoning sickness |
| F09 | Attacking: tapping, vigilance, defender, unblocked damage | `tests/engine/combat.test.ts` › declaring attackers |
| F10 | Blocking: flying/reach, menace, tapped blockers, one attacker per blocker | `tests/engine/combat.test.ts` › declaring blockers |
| F11 | Combat damage split among several blockers | `tests/engine/combat.test.ts` › combat damage |
| F12 | Trample, including damage already marked and blockers that left | `tests/engine/combat.test.ts` › combat damage |
| F13 | First strike and double strike | `tests/engine/combat.test.ts` › combat damage |
| F14 | Deathtouch, also with trample and in fights | `tests/engine/combat.test.ts` · `tests/engine/spells.test.ts` › Feral Clash |
| F15 | Lifelink (engine only, no deck card uses it yet) | `tests/engine/combat.test.ts` › gains life with lifelink |
| F16 | Burn and removal; fizzling | `tests/engine/spells.test.ts` › Ember Snap, Magma Lance |
| F17 | Pump until end of turn | `tests/engine/spells.test.ts` › Verdant Surge · `tests/engine/turn.test.ts` › cleanup |
| F18 | Fight | `tests/engine/spells.test.ts` › Feral Clash |
| F19 | Card draw | `tests/engine/spells.test.ts` › Read the Roots |
| F20 | Enters, dies and attacks triggers, with targets chosen on the stack | `tests/engine/spells.test.ts` › triggered abilities · `tests/engine/combat.test.ts` |
| F21 | Activated abilities, repeatable, `{T}` costs | `tests/engine/turn.test.ts` › activated abilities |
| F22 | Cleanup: discard to seven, damage and pumps wear off | `tests/engine/turn.test.ts` › turn structure |
| F23 | Game over: 0 life, empty library, concession, turn limit | `tests/engine/gameover.test.ts` |
| F24 | Every listed action is legal; bad input is refused with a reason and changes nothing | `tests/engine/properties.test.ts` |
| F25 | Replays: seed plus actions reproduces a game exactly | `tests/engine/properties.test.ts` · `tests/app/controller.test.ts` |
| F26 | Invariants after every action (one zone per card, clean state off the battlefield) | `tests/engine/properties.test.ts` · `npm run sim` |

## AI

| Id | Feature | Tests |
| --- | --- | --- |
| F27 | Sensible play: lands by color, creatures after combat, lethal or valuable burn, tricks in combat, answers to burn, repeated pumps, good attacks and blocks | `tests/ai/ai.test.ts` |
| F28 | Chump-blocks only when the damage would be lethal | `tests/ai/ai.test.ts` › AI combat |
| — | Fairness: hidden cards never change a decision | `tests/ai/ai.test.ts` › AI fairness |
| — | Strength: beats a random player nearly always; AI vs AI balanced and crash-free | `tests/ai/ai.test.ts` › AI strength · `npm run sim -- --games 200 --quiet` (`"errors": 0`) · `npm run sim -- --p0 random --games 50 --quiet` |

## App and UI

| Feature | Tests |
| --- | --- |
| Playing with taps only: mulligan and bottom, lands, casting with targets and cancel, abilities, attacks, blocks, discards, concession, card sheet, log | `tests/ui/game.test.tsx` · `e2e/game.spec.ts` |
| Automatic passing and End turn (behaviour described in `docs/RULES.md`) | `tests/app/controller.test.ts` › auto-pass, ends the turn on request |
| AI runs on timers the player can follow; controller replays and concessions | `tests/app/controller.test.ts` › GameController |
| Mobile layout without horizontal overflow at 360×640 and on a Pixel 7; no console errors | `e2e/game.spec.ts` (projects `mobile`, `small-phone`) |
| Automation surface: `window.manaDuel`, URL parameters, `data-testid` hooks | `tests/app/controller.test.ts` › test API · `e2e/game.spec.ts` |
| `docs/CARDS.md` matches the card definitions | `tests/docs.test.ts` · `npm run cards -- --check` |
| Card art: every card has `public/cards/<id>.svg`, shown in hand, on the battlefield and in the card sheet | `tests/ui/art.test.ts` · `tests/ui/game.test.tsx` › card art · `e2e/game.spec.ts` › every card shows art |

## Manual pass in a browser

For a human-eyes check on a phone-sized viewport (for example Playwright at 390×844):

1. Open `/?seed=7&first=you`, keep the hand, play a land from the card sheet, press **End turn**, and watch the AI
   play its turn (the center strip narrates each action).
2. Load a combat position and play it with taps: `manaDuel.loadScenario({ players: [{ hand: ['ember_snap'],
   battlefield: ['mountain', 'timberland_rhino'] }, { battlefield: ['grove_tender'] }] })`. Cast Ember Snap at the
   Grove Tender, attack with the Rhino, and see the AI's life drop to 16.
3. Open `/?seed=3&autoplay=1&aiDelay=60` to watch a whole AI vs AI game end on the result screen.
