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
| F29 | Decks: Emberwild, Dawntide and Duskmire, 40 cards and 16 lands each, in their own colors; no nonland card in two decks; every card is in a deck | `tests/engine/cards.test.ts` › decks |
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
| F15 | Lifelink (Dawn Acolyte, Aurora Seraph, Duskwing Bat, Blood Reaver) | `tests/engine/combat.test.ts` › gains life with lifelink |
| F16 | Burn and removal; fizzling | `tests/engine/spells.test.ts` › Ember Snap, Magma Lance, life drain and life payment (Soul Siphon, Grave Sentence) |
| F17 | Pump until end of turn | `tests/engine/spells.test.ts` › Verdant Surge · `tests/engine/turn.test.ts` › cleanup |
| F18 | Fight | `tests/engine/spells.test.ts` › Feral Clash |
| F19 | Card draw | `tests/engine/spells.test.ts` › Read the Roots |
| F20 | Enters, dies and attacks triggers, with targets chosen on the stack | `tests/engine/spells.test.ts` › triggered abilities · `tests/engine/combat.test.ts` |
| F30 | Counterspells: a countered spell goes to the graveyard without resolving; only spells can be targeted; counter wars; fizzling | `tests/engine/spells.test.ts` › Turn the Tide |
| F31 | Return to hand: the creature leaves combat and loses damage, pumps and tapped state | `tests/engine/spells.test.ts` › Undertow |
| F32 | `-N/-N` until end of turn, together with marked damage | `tests/engine/spells.test.ts` › Withering Touch |
| F33 | "Target tapped creature": attackers without vigilance are legal targets | `tests/engine/spells.test.ts` › Dawn's Verdict |
| F34 | Losing life as a cost of a spell or trigger, which can end the game | `tests/engine/spells.test.ts` › life drain and life payment, Dawntide and Duskmire creature abilities |
| F35 | Death triggers of Duskmire: draw a card, deal damage to the opponent | `tests/engine/spells.test.ts` › Dawntide and Duskmire creature abilities |
| F21 | Activated abilities, repeatable, `{T}` costs | `tests/engine/turn.test.ts` › activated abilities |
| F22 | Cleanup: discard to seven, damage and pumps wear off | `tests/engine/turn.test.ts` › turn structure |
| F23 | Game over: 0 life, empty library, concession, turn limit | `tests/engine/gameover.test.ts` |
| F24 | Every listed action is legal; bad input is refused with a reason and changes nothing | `tests/engine/properties.test.ts` |
| F25 | Replays: seed plus actions reproduces a game exactly | `tests/engine/properties.test.ts` · `tests/app/controller.test.ts` |
| F26 | Invariants after every action (one zone per card, clean state off the battlefield) | `tests/engine/properties.test.ts` · `npm run sim` |
| F36 | Every matchup plays to the end with sound invariants | `tests/engine/properties.test.ts` · `npm run sim` (all nine matchups by default) |

## AI

| Id | Feature | Tests |
| --- | --- | --- |
| F27 | Sensible play: lands by color, creatures after combat, lethal or valuable burn, tricks in combat and never wasted at the end of the opponent's turn, answers to burn, repeated pumps, good attacks and blocks | `tests/ai/ai.test.ts` |
| F28 | Chump-blocks only when the damage would be lethal | `tests/ai/ai.test.ts` › AI combat |
| F37 | Counters threats but lets harmless spells resolve; returns lethal attackers; removal on the biggest threat or a tapped attacker; pays life only when it can afford it | `tests/ai/ai.test.ts` › AI with the Dawntide and Duskmire answers |
| — | Mulligans hands whose lands cannot cast their spells | `tests/ai/ai.test.ts` › AI setup decisions |
| — | Fairness: hidden cards never change a decision, in mirror and mixed matchups | `tests/ai/ai.test.ts` › AI fairness |
| — | Strength: beats a random player nearly always with any deck; AI vs AI balanced and crash-free | `tests/ai/ai.test.ts` › AI strength · `npm run sim -- --games 270 --quiet` (`"errors": 0`, per-deck `winRate` near 0.5) · `npm run sim -- --p0 random --games 50 --quiet` |

## Animations

Every animation starts from an fx cue: `src/app/fx.ts` turns the engine events of each action into cues, the
controller records them (`manaDuel.fx()`), and `src/ui/fx.ts` and `src/ui/motion.ts` draw them.

| Id | Feature | Tests |
| --- | --- | --- |
| F38 | Combat: an attacker and its blocker strike each other; the damage, the trample to the player and the death show, and the dead creature fades out in its own place | `tests/app/fx.test.ts` › combat · `tests/ui/animations.test.tsx` › animations of combat · `e2e/animations.spec.ts` › in combat |
| F39 | The opponent's spell is revealed with its target; burn shows the life lost; a new turn is announced and deals the drawn card | `tests/app/fx.test.ts` · `tests/ui/animations.test.tsx` › animations of plays, of draws and turns · `e2e/animations.spec.ts` |
| — | Lands and permanents entering, abilities, pumps and shrinks, lifelink and life gain, counters, fizzles, bounces, discards, the opening deal | `tests/app/fx.test.ts` · `tests/ui/animations.test.tsx` |
| — | Timing: hits land after the strikes, draws deal one after another, hooks stay until a newer action animates something, slow motion, a new game starts over | `tests/ui/fxTracker.test.ts` |
| — | Pacing: with an AI delay the AI and automatic passing wait for the opponent's plays and for combat to be seen; not with `aiDelay=0` or `fx=off` | `tests/app/controller.test.ts` › animation cues |
| — | Browser: CSS and Web Animations run and end, `freezeFx` holds them, `fx=off` and `fx=slow`, reduced motion, no overflow mid-animation, no console errors | `e2e/animations.spec.ts` |

## App and UI

| Feature | Tests |
| --- | --- |
| Playing with taps only: mulligan and bottom, lands, casting with targets and cancel, abilities, attacks, blocks, discards, concession, card sheet, log | `tests/ui/game.test.tsx` · `e2e/game.spec.ts` |
| Deck selector: your deck and the AI's (or a random one), remembered for the next visit; the game plays that matchup | `tests/ui/game.test.tsx` › deck selection · `e2e/game.spec.ts` › the deck selector |
| Deck viewer: every card with its count and art, mana curve, card details, "Choose"; both decks from the in-game menu | `tests/ui/game.test.tsx` › deck viewer · `tests/ui/deckViewer.test.ts` · `e2e/game.spec.ts` › the deck viewer |
| Counterspells target a spell by tapping it in the center strip; stack items open their card | `tests/ui/game.test.tsx` › counterspells · `e2e/game.spec.ts` › URL parameters pick the decks |
| Controller decks: per-seat decks, kept by "New game", recorded in replays, none for scenarios | `tests/app/controller.test.ts` › decks |
| Automatic passing and End turn (behaviour described in `docs/RULES.md`) | `tests/app/controller.test.ts` › auto-pass, ends the turn on request |
| AI runs on timers the player can follow, and waits for the animations it should see; controller replays and concessions | `tests/app/controller.test.ts` › GameController, animation cues |
| Mobile layout without horizontal overflow at 360×640 and on a Pixel 7; no console errors | `e2e/game.spec.ts` (projects `mobile`, `small-phone`) |
| Automation surface: `window.manaDuel` (including `decks()`, `matchup()`, `fx()`, `freezeFx()`), URL parameters (`deck`, `aiDeck`, `fx`), `data-testid` and `data-fx` hooks | `tests/app/controller.test.ts` › test API, animation cues · `e2e/game.spec.ts` · `e2e/animations.spec.ts` |
| `docs/CARDS.md` matches the card definitions | `tests/docs.test.ts` · `npm run cards -- --check` |
| Card art: every card has `public/cards/<id>.svg`, shown in hand, on the battlefield and in the card sheet | `tests/ui/art.test.ts` · `tests/ui/game.test.tsx` › card art · `e2e/game.spec.ts` › every card shows art |

## Manual pass in a browser

For a human-eyes check on a phone-sized viewport (for example Playwright at 390×844):

1. Open `/`, pick Dawntide for yourself and Duskmire for the AI, open **View** on a deck and tap a card, then
   **Play vs AI**: both player bars name their deck.
2. Open `/?seed=7&first=you`, keep the hand, play a land from the card sheet, press **End turn**, and watch the AI
   play its turn (the center strip narrates each action).
3. Load a combat position and play it with taps: `manaDuel.loadScenario({ players: [{ hand: ['ember_snap'],
   battlefield: ['mountain', 'timberland_rhino'] }, { battlefield: ['grove_tender'] }] })`. Cast Ember Snap at the
   Grove Tender, attack with the Rhino, and see the AI's life drop to 16.
4. Counter a spell: `manaDuel.loadScenario({ activePlayer: 1, players: [{ hand: ['turn_the_tide'], battlefield:
   ['island', 'island', 'island'] }, { hand: ['timberland_rhino'], battlefield: ['forest', 'forest', 'forest',
   'forest'] }] })`, then `manaDuel.settle()`. Cast Turn the Tide and tap the Rhino in the center strip.
5. Open `/?seed=3&autoplay=1&aiDelay=60&deck=duskmire&aiDeck=dawntide` to watch a whole AI vs AI game end on the
   result screen.
6. See a combat animation frame by frame: open `/?seed=1&aiDelay=0` and run `manaDuel.loadScenario({ players: [{
   hand: ['forest'], battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, { life: 4, battlefield: [{ card:
   'grove_tender', id: 'elf' }] }] })`, then in one `evaluate`: `manaDuel.pass(); manaDuel.settle();
   manaDuel.dispatch({ type: 'declareAttackers', player: 0, attackers: ['rhino'] }); manaDuel.settle(); return
   manaDuel.freezeFx(0.4)`. The screenshot shows the Rhino and the Grove Tender that chump-blocks it meeting over the
   center strip, a spark on each and −3 beside the AI's life; after `manaDuel.freezeFx(null)` the Grove Tender fades
   out in its place.
