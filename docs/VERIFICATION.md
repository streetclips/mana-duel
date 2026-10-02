# Verification checklist

Each feature lists the automated tests that cover it and, when there is one, its built-in **check**: a
deterministic scenario that runs on the pure engine, in Node (`tests/app/checks.test.ts`) and in the browser build
(`e2e/game.spec.ts`). Like the test titles, the table calls cards and decks by the English names their ids keep; the
game shows them in Spanish, and `docs/CARDS.md` pairs each id with its Spanish name. With the game open (`npm run dev`), run any check from the console or Playwright `evaluate`:

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
| F29 | Decks: Emberwild, Dawntide, Duskmire, Stormglass, Sunmeadow, Brightforge, Mistgrave, Gloamwood, Vesperhall, Cindermaw and Deepgrove, 40 cards and 16 lands each, in their own colors, every pair of colors once; no nonland card in two decks; every card is in a deck and every token is created by one of their cards | `tests/engine/cards.test.ts` › decks |
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
| F40 | Flash: a creature with flash is cast whenever you could cast an instant, and blocks the turn it enters | `tests/engine/turn.test.ts` › timing · `tests/engine/spells.test.ts` › Stormglass |
| F41 | "Whenever you cast an instant or sorcery spell": only its controller's instants and sorceries trigger it, above the spell, so it resolves first; pumps, damage and +1/+1 counters (Arc Initiate, Galvanic Channeler, Stormglass Drake) | `tests/engine/spells.test.ts` › Stormglass |
| F42 | +1/+1 counters: added to power and toughness, damage and `-N/-N` included; they outlast cleanup and leave with the creature; one creature or each creature you control; on enters, dies and attacks triggers | `tests/engine/spells.test.ts` › Sunmeadow |
| F43 | Pumps for every creature you control until end of turn (Rally the Meadow, Sunmeadow Herald's attack) | `tests/engine/spells.test.ts` › Sunmeadow |
| F44 | Tokens: created under the controller of the effect, summoning sick unless they have haste; one that dies or returns to hand ceases to exist; they only exist on the battlefield | `tests/engine/spells.test.ts` › Brightforge |
| F45 | "Whenever another creature you control enters" and "dies", tokens included; creatures that die together see each other die (Forge Cadet, Rotwing Crow, Rootgnaw Boar, Gloamwood Elder) | `tests/engine/spells.test.ts` › Brightforge, Gloamwood |
| F46 | Keywords granted until end of turn: first strike (Charge of the Forge), haste (Brightforge Warlord), deathtouch (Venom Duel, Nightshade Tonic) | `tests/engine/spells.test.ts` › Brightforge, Gloamwood |
| F47 | Skulk: no blocker with greater power, compared when blockers are declared | `tests/engine/spells.test.ts` › Mistgrave |
| F48 | Discard: the discarding player chooses, at most the cards in hand, and the game goes on in the same step; "draw two cards, then discard a card" | `tests/engine/spells.test.ts` › Mistgrave · `tests/ui/game.test.tsx` › tokens, sacrifices and discards |
| F49 | "Whenever this creature deals combat damage to a player" (Fogslip Thief, Hushwing Bat), not when it is blocked | `tests/engine/spells.test.ts` › Mistgrave |
| F50 | Undying: the creature returns once, with a +1/+1 counter, as a new object that a spell aimed at it no longer targets | `tests/engine/spells.test.ts` › Gloamwood |
| F51 | "Sacrifice this creature" as a cost: its death triggers resolve first, then the ability without its source | `tests/engine/spells.test.ts` › Gloamwood |
| F52 | "Whenever you gain life": once per gain, lifelink damage dealt at once included, never for the opponent's gains (Vesper Novice, Sanguine Chorister, Vesperhall Matriarch); such an ability can't gain life or deal damage | `tests/engine/spells.test.ts` › Vesperhall · `tests/engine/cards.test.ts` › card validation |
| F53 | Bloodthirst, "if an opponent was dealt damage this turn": damage in or out of combat counts, losing life and damage to yourself don't, the record clears at the next turn (Blistering Hellion, Bloodhungry Ghoul, Brimstone Skirmisher's attack) | `tests/engine/spells.test.ts` › Cindermaw |
| F54 | Hexproof: the opponent's spells and abilities can't target the creature, its controller's can; gaining it in response makes the opponent's spell lose its target | `tests/engine/spells.test.ts` › Deepgrove |
| F55 | Evolve: a +1/+1 counter when another creature with greater power or toughness enters under your control, not for an equal one or the opponent's | `tests/engine/spells.test.ts` › Deepgrove |
| F56 | Bite (Snapjaw Strike): damage equal to the biter's power, none back, deathtouch included; a spell with two targets still acts on the one left (Splitting Flame) | `tests/engine/spells.test.ts` › Deepgrove, Cindermaw |
| F21 | Activated abilities, repeatable, `{T}` costs | `tests/engine/turn.test.ts` › activated abilities |
| F22 | Cleanup: discard to seven, damage and pumps wear off | `tests/engine/turn.test.ts` › turn structure |
| F23 | Game over: 0 life, empty library, concession, turn limit | `tests/engine/gameover.test.ts` |
| F24 | Every listed action is legal; bad input is refused with a reason and changes nothing | `tests/engine/properties.test.ts` |
| F25 | Replays: seed plus actions reproduces a game exactly | `tests/engine/properties.test.ts` · `tests/app/controller.test.ts` |
| F26 | Invariants after every action (one zone per card, clean state off the battlefield) | `tests/engine/properties.test.ts` · `npm run sim` |
| F36 | Every matchup plays to the end with sound invariants | `tests/engine/properties.test.ts` · `npm run sim` (all 121 matchups by default) |

## AI

| Id | Feature | Tests |
| --- | --- | --- |
| F27 | Sensible play: lands by color, creatures after combat, lethal or valuable burn, tricks in combat and never wasted at the end of the opponent's turn, answers to burn, repeated pumps, good attacks and blocks | `tests/ai/ai.test.ts` |
| F28 | Chump-blocks only when the damage would be lethal | `tests/ai/ai.test.ts` › AI combat |
| F37 | Counters threats but lets harmless spells resolve; returns lethal attackers; removal on the biggest threat or a tapped attacker; pays life only when it can afford it | `tests/ai/ai.test.ts` › AI with the Dawntide and Duskmire answers |
| — | Flashes in blockers when attacked; finds lethal through Galvanic Channeler; puts +1/+1 counters where they are worth most; Rally the Meadow after blockers; Wild Blossom against burn; Pack Pounce before a fight | `tests/ai/ai.test.ts` › AI with the Stormglass and Sunmeadow cards |
| — | Casts Brightforge Warlord before combat; makes blockers with Raise the Banners against a lethal attack; Rob the Mind only into a hand that holds cards; discards the card it needs least; sacrifices Bonewood Stalker for a better creature; attacks with a skulker nothing may block | `tests/ai/ai.test.ts` › AI with the Brightforge, Mistgrave and Gloamwood cards |
| — | Waits until after combat to cast a bloodthirsty creature; casts creatures before combat when an evolving attacker grows; answers removal with Shell of the Deep | `tests/ai/ai.test.ts` › AI with the Vesperhall, Cindermaw and Deepgrove cards |
| — | Mulligans hands whose lands cannot cast their spells | `tests/ai/ai.test.ts` › AI setup decisions |
| — | Fairness: hidden cards never change a decision, in mirror and mixed matchups | `tests/ai/ai.test.ts` › AI fairness |
| — | Strength: beats a random player nearly always with any deck; AI vs AI balanced and crash-free | `tests/ai/ai.test.ts` › AI strength · `npm run sim -- --games 3000 --quiet` (`"errors": 0`, per-deck `winRate` near 0.5) · `npm run sim -- --p0 random --games 50 --quiet` |

## LLM opponent

How it works is in `docs/LLM.md`. Everything here runs offline, against mocked models, except the last row.

| Feature | Tests |
| --- | --- |
| The seat's view: its own hand, card counts for the opponent's hand and both libraries, battlefields with combat, pumps, keywords granted until end of turn, +1/+1 counters and tokens, which player was dealt damage this turn, the stack from the top, recent events from its seat, its thoughts with their turn and step | `tests/llm/view.test.ts` |
| Fairness: the prompt is the same whatever the hidden cards are, over real games in three matchups; the latest events and thoughts, in order | `tests/llm/player.test.ts` › the LLM prompt |
| Every legal action is an option for mulligans, priority and targets; attackers, blockers and cards to bottom or discard are constrained fields, a discard names the card that causes it; a refused answer names the rule | `tests/llm/decision.test.ts` |
| One call per real decision, none for a forced one; retries with the reason; the classic AI when every attempt fails or time runs out; unavailable after 401, 402 or 404; cancellation; lazy loading | `tests/llm/player.test.ts` |
| The OpenRouter request: strict `json_schema`, `provider.require_parameters`, the key, a proxy base URL; the catalog of models with structured outputs | `tests/llm/openrouter.test.ts` |
| Whole games where the model answers anything its schema allows: never an illegal action, sound invariants | `tests/llm/games.test.ts` |
| Controller: the AI seat decides asynchronously, `settle` stops for it, stale answers are dropped, it is asked wherever it could act but never for a single choice, its reasoning goes to the log and back into its next prompts (fallbacks add none), the classic AI takes over when it is unavailable, replays reproduce its games | `tests/app/llm.test.ts` |
| Start screen: Classic or LLM, model, thinking effort and key, remembered, catalog suggestions; in game: the LLM tag, the model while it thinks, the unavailable notice and hiding it | `tests/ui/llm.test.tsx` · `e2e/llm.spec.ts` (OpenRouter mocked with `page.route`) |
| Dev server proxy: adds the server's key, answers only the game's own origin; the factory sends a typed key to OpenRouter, or goes through the proxy | `tests/proxy.test.ts` · `tests/app/llmFactory.test.ts` |
| Live: one real decision of each kind, a whole game | `npm run test:live` · `npm run sim -- --p1 llm --model <id> --log 1` (both need `OPENROUTER_API_KEY` and spend credits) |

## Animations

Every animation starts from an fx cue: `src/app/fx.ts` turns the engine events of each action into cues, the
controller records them (`manaDuel.fx()`), and `src/ui/fx.ts` and `src/ui/motion.ts` draw them.

| Id | Feature | Tests |
| --- | --- | --- |
| F38 | Combat: an attacker and its blocker strike each other; the damage, the trample to the player and the death show, and the dead creature fades out in its own place | `tests/app/fx.test.ts` › combat · `tests/ui/animations.test.tsx` › animations of combat · `e2e/animations.spec.ts` › in combat |
| F39 | The opponent's spell is revealed with its target; burn shows the life lost; a new turn is announced and deals the drawn card | `tests/app/fx.test.ts` · `tests/ui/animations.test.tsx` › animations of plays, of draws and turns · `e2e/animations.spec.ts` |
| — | Lands and permanents entering, tokens entering, abilities, pumps and shrinks with the keywords they grant, +1/+1 counters and pumps for every creature you control (shown as pumps), an undying creature dying and coming back, a bite striking its target, lifelink and life gain, counters, fizzles, bounces, discards, the opening deal | `tests/app/fx.test.ts` · `tests/ui/animations.test.tsx` |
| — | Timing: hits land after the strikes, draws deal one after another, hooks stay until a newer action animates something, slow motion, a new game starts over | `tests/ui/fxTracker.test.ts` |
| — | Pacing: with an AI delay the AI and automatic passing wait for the opponent's plays and for combat to be seen; not with `aiDelay=0` or `fx=off` | `tests/app/controller.test.ts` › animation cues |
| — | Browser: CSS and Web Animations run and end, `freezeFx` holds them, `fx=off` and `fx=slow`, reduced motion, no overflow mid-animation, no console errors | `e2e/animations.spec.ts` |
| — | Deck boxes: a seat's box lifts its lid and raises its cards when tapped, the chosen deck's box opens in its place and in the picker, and they close again | `e2e/animations.spec.ts` › a deck box opens |

## Audio

How the music and the sound effects work is in `docs/AUDIO.md`. Unit tests run against a strict fake `AudioContext`
(`tests/audio/fakeAudio.ts`); `e2e/audio.spec.ts` plays them in Chromium.

| Feature | Tests |
| --- | --- |
| Themes: one per deck from its colors, a different one for each combination, the title and colorless themes; every pitched note in key, each bar's chord on the pad and its root in the bass, the eight-bar loop | `tests/audio/music.test.ts` |
| Moods: calm, danger at 5 life or less, combat while attackers are declared, over at the end; drums in combat and a heartbeat in danger; louder moods on the next beat, calmer ones on the bar line | `tests/audio/music.test.ts` · `tests/audio/engine.test.ts` › changes its mood on the beat · `e2e/audio.spec.ts` › a game plays the theme of your deck |
| A sound for every cue kind, timed like its animation: hits at the impact, the dead after them, your draws one after another, a turn's card after its bell, lands and spells in their colors; repeats capped; a burst heard by its latest actions; slow motion stretches it | `tests/audio/cues.test.ts` · `tests/audio/director.test.ts` · `e2e/audio.spec.ts` › every action plays its sound |
| Victory, defeat and stalemate jingles, once per game, none for a finished replay | `tests/audio/cues.test.ts` › the end of a game · `tests/audio/director.test.ts` · `e2e/audio.spec.ts` › a game ends with a victory jingle |
| Sound gate: one of each sound per 45 ms and ten at once, jingles always | `tests/audio/cues.test.ts` › the sound gate · `tests/audio/engine.test.ts` › drops a sound repeated |
| Recipes and notes: finite, audible layers that fade out; envelopes that start and end silent; every source stopped and every node released; music and effects mixed into a compressed master | `tests/audio/synth.test.ts` |
| Engine: no context before a tap; silent where Web Audio is missing or fails; music scheduled ahead of the audio clock, skipping ahead after a stall; a new theme fades the old one out; toggles; suspended while hidden or with everything off; level and volume | `tests/audio/engine.test.ts` |
| Director: the sounds of each action once, after it; the title theme on the start screen, your deck's theme in a game, the colorless one for a scenario; the opening deal | `tests/audio/director.test.ts` · `tests/ui/audio.test.tsx` › follow the screen |
| Browser: the first tap starts the music and the output rises above silence; every sound and every theme in every mood renders finite, audible, unclipped and fades out; a hidden page pauses it; no console errors | `e2e/audio.spec.ts` |
| Settings: the game menu and start-screen toggles, remembered; `?music=on\|off`, `?sfx=on\|off`; none without audio | `tests/ui/audio.test.tsx` · `e2e/audio.spec.ts` › turn off from the menu, the start screen turns music and sound effects off and on |
| Automation: `manaDuel.audio` (`state`, `played`, `level`, `render`, toggles, `unlock`, `sounds`, `themes`) and `html[data-audio]`, `[data-music]`, `[data-mood]` | `tests/audio/api.test.ts` · `e2e/audio.spec.ts` |

## App and UI

| Feature | Tests |
| --- | --- |
| Playing with taps only: mulligan and bottom, lands, casting with targets and cancel, abilities, attacks, blocks, discards, concession, card sheet, log; the result screen plays again or goes back to the main menu | `tests/ui/game.test.tsx` · `e2e/game.spec.ts` |
| Game log: opened from the menu or the result screen; every card a line names is a button that opens it above the log, read-only, with where it is now; a card the other player draws is never named | `tests/ui/game.test.tsx` › game log · `tests/engine/spells.test.ts` › event text · `tests/engine/properties.test.ts` · `tests/app/controller.test.ts` · `e2e/game.spec.ts` › the game log |
| Deck selector: your deck box against the AI's; tapping one opens the picker of every deck, Random first for either seat, the chosen one described, remembered for the next visit; the game plays that matchup, Random drawn when it starts | `tests/ui/game.test.tsx` › deck selection · `tests/ui/deckChoice.test.ts` · `e2e/game.spec.ts` › the deck selector, Random draws a deck |
| Deck viewer: every card with its count and art, mana curve, card details, opened from the picker and back to it; both decks from the in-game menu | `tests/ui/game.test.tsx` › deck viewer · `tests/ui/deckViewer.test.ts` · `e2e/game.spec.ts` › the deck viewer |
| Counterspells target a spell by tapping it in the center strip; stack items open their card | `tests/ui/game.test.tsx` › counterspells · `e2e/game.spec.ts` › URL parameters pick the decks |
| Flash creatures cast from the card sheet in the opponent's turn; +1/+1 counters raise the P/T tag and show in the card sheet | `e2e/game.spec.ts` › Stormglass and Sunmeadow |
| Tokens on the battlefield and in the card sheet; sacrifice abilities from the card sheet; a spell that makes you discard asks which card, naming itself; an undying creature back with its counter | `tests/ui/game.test.tsx` › tokens, sacrifices and discards · `e2e/game.spec.ts` › Brightforge, Mistgrave and Gloamwood |
| A hexproof creature never glows as the opponent's target; life gain and evolve raise a creature's P/T tag; a bloodthirsty creature cast after a hit arrives with its counters | `e2e/game.spec.ts` › Vesperhall, Cindermaw and Deepgrove |
| Controller decks: per-seat decks, kept by "New game", recorded in replays, none for scenarios | `tests/app/controller.test.ts` › decks |
| Automatic passing and End turn (behaviour described in `docs/RULES.md`) | `tests/app/controller.test.ts` › auto-pass, ends the turn on request |
| Auto-pass off: stops wherever you could act, End turn still works; the menu toggle, remembered, `?autoPass=on\|off`, `setAutoPass()`; prompts that name whose step it is | `tests/app/controller.test.ts` › auto-pass · `tests/ui/game.test.tsx` › auto-pass · `e2e/game.spec.ts` › auto-pass |
| AI runs on timers the player can follow, and waits for the animations it should see; controller replays and concessions | `tests/app/controller.test.ts` › GameController, animation cues |
| Mobile layout without horizontal overflow at 360×640 and on a Pixel 7; no console errors | `e2e/game.spec.ts` (projects `mobile`, `small-phone`) |
| Automation surface: `window.manaDuel` (including `decks()`, `matchup()`, `fx()`, `freezeFx()`, `opponent()`, `llmDecisions()`, `llmPrompt()`, `idle()`, `setAutoPass()`, `audio.*`), URL parameters (`deck`, `aiDeck`, `fx`, `ai`, `model`, `autoPass`, `music`, `sfx`), `data-testid`, `data-fx`, `data-llm` and `data-audio` hooks | `tests/app/controller.test.ts` › test API, animation cues · `tests/app/llm.test.ts` · `e2e/game.spec.ts` · `e2e/animations.spec.ts` · `e2e/llm.spec.ts` |
| `docs/CARDS.md` matches the card definitions | `tests/docs.test.ts` · `npm run cards -- --check` |
| Card art: every card has `public/cards/<id>.svg`, shown in hand, on the battlefield and in the card sheet; each deck's featured card on its box | `tests/ui/art.test.ts` · `tests/ui/game.test.tsx` › card art · `e2e/game.spec.ts` › every card shows art, every deck box shows its featured art |

## Manual pass in a browser

For a human-eyes check on a phone-sized viewport (for example Playwright at 390×844):

Every text the game shows is in Spanish, so the steps quote it; cards and decks also give their ids.

1. Open `/`, tap your deck box and pick Albamar (`dawntide`), tap the AI's and pick Fangoscuro (`duskmire`), open
   **Cartas** and tap a card, close it, then **Jugar contra la IA**: both player bars name their deck.
2. Open `/?seed=7&first=you`, keep the hand (**Me quedo**), play a land from the card sheet, press
   **Terminar turno**, and watch the AI play its turn (the center strip narrates each action).
3. Load a combat position and play it with taps: `manaDuel.loadScenario({ players: [{ hand: ['ember_snap'],
   battlefield: ['mountain', 'timberland_rhino'] }, { battlefield: ['grove_tender'] }] })`. Cast Chasquido de brasas
   (`ember_snap`) at the Elfa del soto (`grove_tender`), attack with the Rinoceronte forestal (`timberland_rhino`), and
   see the AI's life drop to 16.
4. Counter a spell: `manaDuel.loadScenario({ activePlayer: 1, players: [{ hand: ['turn_the_tide'], battlefield:
   ['island', 'island', 'island'] }, { hand: ['timberland_rhino'], battlefield: ['forest', 'forest', 'forest',
   'forest'] }] })`, then `manaDuel.settle()`. Cast Cambio de marea (`turn_the_tide`) and tap the Rinoceronte
   forestal in the center strip.
5. Open `/?seed=3&autoplay=1&aiDelay=60&deck=duskmire&aiDeck=dawntide` to watch a whole AI vs AI game end on the
   result screen.
6. See a combat animation frame by frame: open `/?seed=1&aiDelay=0` and run `manaDuel.loadScenario({ players: [{
   hand: ['forest'], battlefield: [{ card: 'timberland_rhino', id: 'rhino' }] }, { life: 4, battlefield: [{ card:
   'grove_tender', id: 'elf' }] }] })`, then in one `evaluate`: `manaDuel.pass(); manaDuel.settle();
   manaDuel.dispatch({ type: 'declareAttackers', player: 0, attackers: ['rhino'] }); manaDuel.settle(); return
   manaDuel.freezeFx(0.4)`. The screenshot shows the Rinoceronte forestal and the Elfa del soto that chump-blocks it
   meeting over the center strip, a spark on each and −3 beside the AI's life; after `manaDuel.freezeFx(null)` the
   Elfa del soto fades out in its place.
7. Try the newest decks' mechanics: open `/?seed=2&first=you&deck=brightforge&aiDeck=mistgrave&aiDelay=0`, run
   `manaDuel.loadScenario({ players: [{ hand: ['raise_the_banners'], battlefield: ['plains', 'plains',
   'forge_cadet'] }, {}] })` and cast Izar banderas: two Soldado tokens appear and Cadete de la forja grows to 3/3.
   Then run `manaDuel.loadScenario({ activePlayer: 1, players: [{ hand: ['forest', 'ember_snap'] }, { hand:
   ['memory_leech'], battlefield: ['swamp', 'swamp', 'swamp'] }] })` and `manaDuel.settle()`: the AI casts
   Sanguijuela mental and the prompt reads "Elige 1 carta para descartar".
8. Try the Vesperia, Fauceniza and Sotohondo mechanics: open `/?seed=2&first=you&deck=cindermaw&aiDeck=deepgrove&aiDelay=0`
   and run `manaDuel.loadScenario({ players: [{ hand: ['bloodfire_bolt', 'blistering_hellion'], battlefield:
   ['swamp', 'mountain', 'mountain', 'mountain', 'mountain'] }, { battlefield: ['mossfin_lurker'] }] })`. Cast
   Rayo de sangre: the Pez musgoso never glows as a target, so aim it at the AI. Then cast Infernal abrasador: it
   arrives as a 5/4 with two +1/+1 counters, because the AI was dealt damage this turn.
