# Game modes

Besides a single duel against the AI, Mana Duel has modes that span several games, and decks of your own. Each one
keeps its state in the browser (`localStorage`) and plays its games through the same `GameController`, so every game
of a mode is an ordinary duel: the same engine, AI or LLM opponent, animations, log and replays.

A mode follows the game it starts with a `DuelTracker` (`src/app/duelTracker.ts`): by session, so a new game, a
scenario or a replay loaded meanwhile is never recorded as the mode's result. It saves the game in progress as its
replay half a second after each action, when the page is hidden and when you leave the game, and records the result
once. In the game, the mode puts a badge on the rival's bar (`duel-badge-1`), takes *Nueva partida* out of the menu,
whose *Menú principal* goes back to the mode instead, and the result screen and the bar continue the mode
(`btn-mode-continue`, `btn-mode-next`).

## Expedition

Seven duels in a row with one deck. Each rival is a little stronger than the one before: the first ones start with
less life and a smaller hand, the later ones carry relics, and the boss a boss relic, its special ability. Every win
improves the deck, and a single defeat ends the run.

```
src/app/expedition.ts            the run, pure: rivals, duel setup, rewards, relic offers, validation
src/app/relics.ts                the relics: who may hold them, and what each does for either seat
src/engine/relics.ts             the relics that act during a duel, as the engine plays them
src/app/expeditionController.ts  plays the run's duels in the GameController, records their results, saves the run
src/ui/ExpeditionScreen.tsx      new run, map of rivals and their relics, card reward, swap, relic, result
src/ui/expeditionStore.ts        the run in localStorage under manaDuel.expedition
```

### A run

1. **Start**: pick one of the fourteen decks. The run's seed draws the seven rivals among the other thirteen, the last
   one the boss, and the relics they carry. The map shows each rival's life, hand and relics, and a tap on a relic
   reads it (`relic-sheet`).
2. **Duel**: the run's deck (id `expedition`, named after the deck it started from) against the rival's deck. The
   run's seed also gives each duel its seed and its starting player.
3. **Card reward**, after each win but the last: three cards to choose from, drawn among the nonland cards of the
   fourteen decks whose colors are all colors of the starting deck, never a fifth copy. Take one and swap it for a card
   of the deck, add it without taking one out (the deck grows), or skip.
4. **Relic**, after the third and sixth wins: one of three of the twelve relics you can win, kept for the rest of the
   run.
5. **End**: the run is won after the seventh win. A defeat, a concession included, ends it, unless the Pluma de fénix
   burns for it: then the same rival is fought again, once. A draw plays the same rival again.

| Duel | Rival's life | Rival's opening hand | Rival's relics | AI win rate |
| --- | --- | --- | --- | --- |
| 1 | 14 | 6 | — | 0.74 |
| 2 | 16 | 6 | — | 0.71 |
| 3 | 16 | 6 | 1 | 0.59 |
| 4 | 18 | 6 | 1 | 0.55 |
| 5 | 20 | 6 | 1 | 0.52 |
| 6 | 20 | 6 | 2 | 0.41 |
| 7, boss | 20 | 6 | a boss relic and 1 | 0.30 |

The relics of a rival are drawn without repeats among the ten a rival may carry, and the boss's first one among the
three boss relics. Life and hand on the map are those the rival starts the duel with, its relics and yours counted:
the Amuleto de vigor of a rival adds its life, your Máscara del silencio takes a card from its hand.

Rivals never start above 20 life because more life is not the same handicap for every deck: four more life cost
Brightforge 11 points of win rate and Flamecrest 9, but Mistgrave 3 and Crossroads under 1 (420 games per deck, the
deck against all fourteen). Relics climb instead: they change how each rival plays, the map announces them, and a
player can answer them with the cards and relics of the run.

### Relics

| Relic | Id | Effect | Kind | Holders | Strength |
| --- | --- | --- | --- | --- | --- |
| Amuleto de vigor | `vigor` | 6 more life | start | you, rivals | 9.6 |
| Ojo del augur | `foresight` | an opening hand of one more card (a mulligan draws that many too) | start | you, rivals | 7.6 |
| Estandarte del alba | `banner` | a 1/1 white Soldier token on the battlefield from the start | start | you, rivals | 14.3 |
| Mapa del cartógrafo | `cartographer` | one more copy of the deck's most common land on the battlefield from the start, and one card fewer in the opening hand | start | you, rivals | 7.1 |
| Reloj de arena | `hourglass` | you start every duel, and draw on your first turn too | start | you | 13.9 |
| Máscara del silencio | `mask` | the other player's opening hand has one card fewer | start | you, rivals | 12.7 |
| Incensario de esporas | `censer` | a 1/1 green Saproling for each instant or sorcery you cast | in play | you, rivals | 12.5 |
| Urna de almas | `urn` | each opponent loses 1 life whenever a creature you control dies | in play | you, rivals | 10.7 |
| Tambor de guerra | `drum` | landfall: creatures you control get +1/+0 until end of turn | in play | you, rivals | 13.1 |
| Cáliz del peregrino | `chalice` | 1 life whenever a creature enters under your control | in play | you, rivals | 11.5 |
| Libro de horas | `tome` | at the beginning of your upkeep, a card if your hand is empty | in play | you, rivals | 7.4 |
| Pluma de fénix | `phoenix` | the first defeat of the run is fought again instead of ending it | run | you | — |
| Campana fúnebre | `bell` | at the beginning of your upkeep, each opponent loses 1 life | in play | bosses | 19.7 |
| Grimorio prohibido | `grimoire` | at the beginning of your upkeep, draw a card and lose 1 life | in play | bosses | 19.2 |
| Corona del tirano | `crown` | at the beginning of your upkeep, creatures you control get +1/+0 until end of turn | in play | bosses | 17.4 |

**Strength** is how many points of win rate the AI loses when its rival holds the relic, at 20 life and seven cards on
both sides, over 1960 games, every matchup ten times; the relics you can win sit between 7 and 14, the boss relics near
20. The Pluma de fénix does nothing in a duel.

- **Start** relics change how the duel is set up: life, opening hand, permanents from the start, the first draw, the
  starting player (`docs/RULES.md` › Game). They reach the engine as each player's `life`, `openingHand`,
  `battlefield` and `drawOnFirstTurn`, the Reloj de arena also as the duel's starting player.
- **In play** relics are engine relics (`src/engine/relics.ts`, listed in `docs/CARDS.md`): the player who holds one
  starts the duel with it beside the battlefield, where it triggers like a permanent and nobody can touch it
  (`docs/RULES.md` › Relics). In the game they sit at the end of their player's row of lands (`relics-<p>`), and a tap
  opens one like a card.
- The **Pluma de fénix** is spent by the first defeat it sees (`spent` in the run), which is recorded in the run's
  history; the same rival is fought again with a new seed. Spent, it stays among your relics, marked *Usada*.

### Tuning

The ladder is `RIVAL_LIFE`, `RIVAL_HAND` and `RIVAL_RELICS` in `src/app/expedition.ts`; the boss carries a boss relic
on top of its count. The win rates above are the AI with an unchanged deck against each rival over 1960 games, every
matchup ten times, each game with the relics its seed draws, as a run draws them: measure a duel with
`npm run sim -- --games 1960 --quiet --duel 5` and read `wins.p0` out of `games`. `--relics0 banner,drum` gives your
seat relics too, and `--relics1 bell` without `--duel` measures one relic on its own at 20 life and seven cards. A
player who beats the AI as often as it beats itself finishes about one run in a hundred with no reward at all; card
rewards, relics and play better than the AI's are what make a run winnable.

### The saved run

The run is saved on every change and checked when it is read (`isExpeditionRun`, version 2): your relics must be some
a player can win, a rival's some a rival can carry, none twice. A run it cannot read, an older version's included, is
dropped. The duel in progress is saved with it, and **Continuar el duelo** loads it again exactly where it was.

### Extending

- A relic: its id in `RelicId` and an entry in `RELICS` (`src/app/relics.ts`) with its kind and who may hold it, and
  its glyph in `src/ui/components/ModeIcons.tsx`, which is also its art in the card sheet. A start relic adds its perk
  in `seatPerks`; one in play is a `CardDef` of type `relic` in `src/engine/relics.ts`, whose name and rules text the
  app reads from the engine. Measure it with `--relics1 <id>` and add it to the tables above and to
  `tests/app/relics.test.ts`.
- More duels: `DUELS`, with one entry per duel in `RIVAL_LIFE`, `RIVAL_HAND` and `RIVAL_RELICS`; relics come every
  `RELIC_EVERY` wins.
- A deck a run may start from or face: every deck of `DECK_LIST` already is.

Tests: `tests/app/expedition.test.ts` (the run and its controller), `tests/app/relics.test.ts` (the relics and their
perks), `tests/engine/relics.test.ts` (relics in play), `tests/ui/expedition.test.tsx` (the screens),
`e2e/expedition.spec.ts` (a whole flow, a reward, a reload in the middle of a duel, the boss's relic on the map and in
its duel).

## My decks

Decks of your own, built from every card of the fourteen decks and saved in the browser. A deck that can be played
appears after the fourteen in both seats' pickers, under *Mis mazos*, and among the decks an Expedition can start
from; the AI plays it like any other.

```
src/app/deckBuilding.ts      drafts and the rules of a deck: limits, problems, notes, colors, box art, basic lands
src/app/deckLibrary.ts       the decks you saved: ids, names, which can be played
src/ui/DecksScreen.tsx       your decks, a copy of a deck of the game, a new empty deck, deleting one
src/ui/components/DeckBuilder.tsx   the builder, for any pool of cards and limits
src/ui/deckLibraryStore.ts   the decks in localStorage under manaDuel.customDecks
```

- **Rules**: at least 40 cards and at most 60, up to four copies of each card but the basic lands, which have no
  limit; any card of the fourteen decks, no tokens. A deck that breaks a rule can still be saved, as *incompleto*, and
  stays out of the pickers until it is fixed. The builder lists what breaks a rule and, as notes, a land count outside
  14-20 and a color that no card of the deck can pay.
- **A deck**: its colors are those of its spells (of its lands when it has none), its box shows the card you put on it
  or else its most expensive spell, and its description counts its creatures, spells and lands. Ids are `mine-<n>`;
  names have at most 22 characters, and a new deck gets the first free *Mi mazo*, *Mi mazo 2*…
- **The builder** shows the deck by type with a stepper per card, the pool with a search and filters by color and type,
  the count, the colors and the mana curve. *Completar con tierras básicas* adds the basics that bring the deck to 40,
  shared as the colored mana symbols of its spells. Leaving with changes asks first.
- **A choice that names a deck that is gone** (deleted, or no longer playable) falls back to Emberwild for your seat
  and Random for the AI's; a stored choice that names an unknown deck is dropped whole when the game opens.

Tests: `tests/app/deckBuilding.test.ts` (the rules, the library, the automation API), `tests/ui/decks.test.tsx` and
`tests/ui/deckChoice.test.ts` (the screens and the pickers), `e2e/decks.spec.ts` (a deck built on the phone and played,
a copy that survives a reload and starts an Expedition).

## Draft and sealed

New cards every time: cards from random packs, a deck built from them and the basic lands, and a match against the
AI's own deck, best of three games.

```
src/app/draft.ts            the run, pure: packs, picks, ratings, the AI's picks and decks, the match
src/app/draftController.ts  plays the match's games in the GameController, records them, saves the run
src/ui/DraftScreen.tsx      format, picks, building with the deck builder, the match, the result
src/ui/draftStore.ts        the run in localStorage under manaDuel.draft
```

1. **Format**: *Draft contra la IA*, three rounds of a pack of twelve for each of you: you pick a card from yours, the
   AI from its own at the same time, and you swap packs until both are empty; 36 cards each. *Sellado*: six packs of
   twelve for each, opened at once. A pack holds twelve different cards of the fourteen decks, basic lands aside.
2. **Building**: the deck builder of *My decks* with your picks, each as many times as you took it, and
   the basic lands without limit. It opens on a suggested deck, and *Sugerir un mazo* brings it back; **Listo** takes
   only a deck that can be played. The deck can change between games.
3. **Match**: your deck (id `draft`) against the AI's (`draft-ai`, *Draft de la IA*), best of three: a coin flip from
   the run's seed picks who starts the first game, the loser of each game starts the next, and a draw counts for
   nobody. At the end you can see the AI's deck and save yours into your decks.

The AI rates a card by what it does for its cost (`cardRating`: power and toughness, keywords, abilities, and what a
spell's effects are worth, removal and card draw above all), picks the best one, and after five picks prefers cards of
its two best colors. It builds by taking the 23 best spells of the pair of colors that adds up to most, up to two
more lands when the pair falls short, then the best cards of one more color, and the basic lands that bring the deck
to 40 in the share of its colored mana symbols (`autoBuild`); your suggested deck is built the same way.

Tests: `tests/app/draft.test.ts` (packs, picks, ratings, building, the match, the controller, the automation API),
`tests/ui/draft.test.tsx` (the screens and the games), `e2e/draft.spec.ts` (a sealed match played to the end, picks
by tap that survive a reload).

