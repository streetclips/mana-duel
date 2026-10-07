# Mana Duel

A minimalist, mobile-first card duel built on the rules of Magic: The Gathering, played in Spanish or English: its
screen title is *Duelo de Maná* or *Mana Duel*, and every text it writes — cards, decks, buttons, prompts, the log,
refusals, and the prompt of the LLM opponent — is in the language picked in its settings, at first the browser's. Fourteen decks — **Brasalvaje** (`emberwild`, red and green), **Albamar**
(`dawntide`, white and blue), **Fangoscuro** (`duskmire`, black), **Cristormenta** (`stormglass`, blue and red),
**Pradosol** (`sunmeadow`, green and white), **Forjaluz** (`brightforge`, red and white), **Brumafosa** (`mistgrave`,
blue and black), **Selvumbra** (`gloamwood`, black and green), **Vesperia** (`vesperhall`, white and black),
**Fauceniza** (`cindermaw`, black and red), **Sotohondo** (`deepgrove`, green and blue), **Crestafuego**
(`flamecrest`, red), **Tierrabrava** (`wildland`, green) and **Encrucijada** (`crossroads`, all five colors) — and one opponent that
plays by the same rules and never looks at your hand: the built-in AI, or a language model of your choice through
OpenRouter. Ids, of decks and cards alike, keep the English names: `?deck=dawntide` picks Albamar, which the game
calls Dawntide in English.

## Play

```sh
npm install
npm run dev        # http://localhost:5173 — open it on your phone through your LAN address too
npm run build      # static site in dist/, served by `npm run preview`
docker build -t mana-duel . && docker run --rm -p 8080:80 mana-duel   # the same site served by nginx, as deployed
```

- On the start screen your deck box faces the AI's. Tap one to open it onto every deck and pick another, or
  *Aleatorio* for either seat; **Cartas** opens the chosen deck with every card, its mana curve and card details.
  The in-game menu shows both decks too.
- Tap a card to read it; the sheet that opens holds its actions (play, cast, activate). Long-press or right-click
  inspects any card. The game log, in the menu, opens every card it names on a tap.
- On the battlefield a card is its art, with icons for its keywords and for a trigger still to come, and a pill with
  the cost and effect of each ability you activate (`T: +G`, `R: +1/+0`, `Sacr.: -2/-2`), lit while you can use it.
  In hand, its name and text sit over the art.
- Targets glow when a spell needs one: tap the creature or the player, or the spell in the center strip for a
  counterspell.
- Attack by tapping your creatures, then **Atacar**. Block by tapping your creature, then the attacker it should
  stop. Numbered badges pair attackers with their blockers.
- Priority passes by itself while there is nothing to decide; **Terminar turno** skips straight to the opponent.
  Turn **Pase automático** off in the menu to stop wherever you could act, the opponent's turn included, as the AI
  does.
- **Ver IA contra IA** on the start screen lets the AI play both seats.
- **Expedición**, under *Más modos*: seven duels in a row with one deck, against rivals that start weak, carry relics
  from the third duel on and end in a boss whose boss relic is its special ability. Each win lets you take one of
  three cards into your deck, every third win one of twelve relics that lasts the whole run, and a single defeat ends
  it. The run and the duel in progress are saved in the browser, so a reload picks the duel
  up where it was. Details in [`docs/MODES.md`](docs/MODES.md).
- **Draft**, under *Más modos*: a draft against the AI, three rounds of passing packs of twelve and picking a card
  each time, or a sealed pool of six packs. Build a deck from your cards and the basic lands, starting from a
  suggested one, and play the AI's own deck at the best of three; then save yours into your decks.
- **Mis mazos**, under *Más modos*: build your own decks from every card of the game, from nothing or from a copy of
  one of the fourteen, with a search, filters by color and type, the mana curve, warnings about lands and colors and
  a button that completes the deck with basic lands. A deck of 40 to 60 cards with up to four copies of each card
  (basic lands aside) appears in both seats' pickers and can start an Expedition.
- **Idioma**, in the settings behind the gear of the start screen: *Español* or *English*, remembered in this browser;
  `?lang=es|en` picks one for a visit. These notes quote the Spanish screens.
- **Quién controla la IA**, in the same settings: *Clásica*, or *LLM* with an [OpenRouter](https://openrouter.ai) model id, a thinking effort
  and your API key (kept in this browser only). The model picks every move among the legal ones, the log shows its
  reasoning and its next prompts recall it; when it fails to answer, the classic AI moves for it. With
  `OPENROUTER_API_KEY` set in the shell or in `.env.local`, `npm run dev` adds the key on the server and no key needs
  typing. `?ai=llm&model=<id>` starts a game against it directly. Details in [`docs/LLM.md`](docs/LLM.md).
- Every change is animated: the card the opponent plays is shown with its target, creatures strike each other in
  combat, damage and life changes pop, the dead fade out in their place, drawn cards slide into your hand and each
  turn is announced. `?fx=slow` plays them in slow motion and `?fx=off` turns them off.
- Five scenes, one per color of mana, behind every screen: golden plains, a coast with a lighthouse, a misty swamp,
  snowy peaks and a pine forest, by day in the light theme and by night in the dark one. The menus fade from one to
  the next every 16 seconds; each game takes the next one, faded behind the board. `?scene=<id>` keeps one.
- Music and sound effects: each deck plays its own theme, in the colors of its cards, that brings in the drums when
  creatures attack and turns tense at low life; every play, hit, death and turn has its sound, timed with its
  animation, and the game ends on a victory or a defeat. All of it is synthesized with the Web Audio API, starts
  with your first tap and turns off from the menu or the start screen's settings (`?music=off`, `?sfx=off`). Details in
  [`docs/AUDIO.md`](docs/AUDIO.md).

## What is inside

- **Rules engine** (`src/engine`): turn structure, priority and the stack, instants in response, London mulligan,
  one land per turn, automatic mana payment, summoning sickness, combat with first strike, double strike,
  trample, deathtouch, lifelink, flying and reach, menace, skulk, vigilance, haste, defender, flash, undying, hexproof,
  evolve and prowess, triggered and activated abilities (including "whenever you cast an instant or sorcery spell",
  "whenever another creature you control enters" or "dies", "whenever this creature deals combat damage to a
  player", "whenever you gain life", landfall and bloodthirst, "if an opponent was dealt damage this turn"), lands
  that enter tapped or tap for three or five colors, land searches and extra land plays, sacrifice costs,
  creature tokens, counterspells, returning creatures to hand, fights and bites, `-N/-N`, +1/+1 counters, pumps and
  keywords granted until end of turn, for one creature or every creature you control, discards the player chooses,
  paying life, fizzling, cleanup and hand size, every way to win or lose. Pure, deterministic and seeded, so any game
  can be replayed. Details in [`docs/RULES.md`](docs/RULES.md).
- **AI** (`src/ai`): evaluates each option by playing the engine forward, predicts blocks with its own blocking
  logic, keeps combat tricks for combat, answers burn with pumps, counters what is worth countering and only
  chump-blocks against lethal damage, with as many blockers as it takes. A test proves hidden cards never change its
  decisions. It plays all fourteen decks, and simulated games between them stay close to even.
- **LLM opponent** (`src/llm`): the AI seat's view of the game as JSON (its own hand, the opponent's card counts),
  every legal move as a zod schema, and one AI SDK `generateText` call with `Output.object` per decision, through
  the OpenRouter provider. Answers the engine refuses are retried, then left to the classic AI. It loads only when
  a game uses it, and the tests run it offline against mocked models.
- **App** (`src/app`, `src/ui`): Preact UI tuned for one-handed phone play, a deck selector of 3D deck boxes that
  open, a deck viewer, light
  and dark themes over five vector scenes, a game log, the Expedition and Draft modes, a deck builder, animations driven by cues that tests
  and agents can read, and an automation API on `window.manaDuel`.
- **Audio** (`src/audio`): a generative score, one theme per color combination and four moods that follow the game,
  scheduled ahead of the audio clock, and a sound for every animation cue, each built from layers of synthesized
  tones and noise. Tests read what plays and render every sound offline.
- **Cards**: 213 cards — 202 that belong to a single deck (19 in Encrucijada, six of them lands, 16 in Brasalvaje, 15
  each in Vesperia and Tierrabrava, 14 each in Albamar, Fangoscuro, Pradosol, Forjaluz, Fauceniza, Sotohondo and
  Crestafuego, 13 each in Cristormenta, Brumafosa and Selvumbra), the five basic lands, which any deck may use, and six
  tokens that cards create (Soldado, Elemental, Saprolín, Espíritu, Monje, Bestia) — each with its own SVG
  illustration in `public/cards/`, listed in [`docs/CARDS.md`](docs/CARDS.md)
  (generated from the definitions) and, in English, [`docs/CARDS.en.md`](docs/CARDS.en.md). Their Spanish names,
  types and rules text follow the official Spanish terminology of Magic (*Vuela*, *Arrolla*, *Resiliencia*, «Crea una
  ficha de criatura Soldado blanca 1/1»), their English ones its Oracle templates (*Flying*, *Trample*, *Undying*,
  "Create a 1/1 white Soldier creature token."), and each name fits the two lines of a card in hand in both
  languages.

## Testing and verification

| Command | What it proves |
| --- | --- |
| `npm test` | Engine, AI, controller, UI and audio tests (Vitest, happy-dom, a fake `AudioContext`), including 62 feature checks |
| `npm run sim -- --games 3000` | Headless AI games in all 196 deck matchups, one process per CPU, with invariant checks after every action and per-deck win rates (`--decks dawntide,duskmire` for one matchup; `--duel 5` for an Expedition rival, `--relics1 bell` for a relic) |
| `npm run test:e2e` | Playwright on the production build, two phone viewports and a desktop browser |
| `npm run test:live` | Real OpenRouter calls, one per decision kind (needs `OPENROUTER_API_KEY`, spends credits; `OPENROUTER_MODEL` picks the model). `npm run sim -- --p1 llm --model <id> --log 1` plays a whole game against it |
| `npm run format:check` | The code keeps oxfmt's layout (`.oxfmtrc.json`); `npm run format` applies it |
| `npm run lint` | oxlint with type information: likely bugs, and the imports each layer may make (`.oxlintrc.json`); `npm run lint:fix` fixes what it can |
| `npm run knip` | Knip: no export, file or dependency that nothing uses |
| `npm run verify` | Format check, lint, Knip, typecheck, tests, 196 simulated games (one per matchup) and the build, in one go |

[`docs/VERIFICATION.md`](docs/VERIFICATION.md) maps every feature to its tests. With the game open,
`manaDuel.runChecks()` runs the same feature checks inside the browser, and `manaDuel.help()` lists the rest of
the automation API. [`AGENTS.md`](AGENTS.md) is the guide for coding agents.

## Project structure

```
index.html · src/main.tsx
src/
├── engine/   types, cards/ (one file per card), relics, registry, decks, mana, state, targets, combat,
│             effects, rules, game, actions, scenario, describe, refusals, invariants, text/ (rules text, log and
│             refusals in Spanish and English; the English names of cards and decks)
├── ai/       evaluate, rollout, combat, heuristics, chooseAction
├── llm/      view (the seat's view), decision (options and schemas), prompt, player, openrouter, models, lazy,
│             text/ (the prompt in Spanish and English)
├── app/      controller, autopass, fx (animation cues), llmFactory, testApi, checks, expedition,
│             expeditionController, relics, draft, draftController, duelTracker, cardPool, deckBuilding, deckLibrary,
│             text/
├── i18n/     the current language and messages({ es, en }), the typed catalogs of every text/ folder
├── audio/    music (themes and moods), cues (a sound per cue), synth, engine, director, render, sounds, gate
└── ui/       App, StartScreen (deck and AI selector), Game, ExpeditionScreen, DraftScreen, DecksScreen, model
              (interaction logic), deckChoice, opponentChoice, autoPassChoice, audioChoice, localeChoice, expeditionStore,
              draftStore, deckLibraryStore, fx and motion (animations), scenery and sceneArt (the backdrop's scenes),
              components/ (Backdrop, Board, Card, DeckBox, DeckBuilder, DeckSelect, DeckViewer, Fx,
              ModeIcons, Overlays, ScreenBar, SoundToggles), text/ (the screens' texts), styles.css
public/cards/ one SVG illustration per card, named <id>.svg
tests/        engine/ ai/ llm/ app/ ui/ audio/ + helpers.ts, scriptedLlm.ts, proxy.test.ts
e2e/          Playwright specs
scripts/      sim.ts, cards.ts, openrouterProxy.ts
docs/         RULES.md, VERIFICATION.md, CARDS.md, CARDS.en.md, LLM.md, AUDIO.md, MODES.md
```

Mana Duel is an independent fan project inspired by Magic: The Gathering, a trademark of Wizards of the Coast. Card
names and texts are original.
