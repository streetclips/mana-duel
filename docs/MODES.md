# Game modes

Besides a single duel against the AI, Mana Duel has modes that span several games, and decks of your own. Each one
keeps its state in the browser (`localStorage`) and plays its games through the same `GameController`, so every game
of a mode is an ordinary duel: the same engine, AI or LLM opponent, animations, log and replays.

A mode follows the game it starts with a `DuelTracker` (`src/app/duelTracker.ts`): by session, so a new game, a
scenario or a replay loaded meanwhile is never recorded as the mode's result. It saves the game in progress as its
replay half a second after each action, when the page is hidden and when you leave the game, and records the result
once. In the game, the mode puts a badge on the rival's bar (`duel-badge-1`), takes *Nueva partida* out of the menu,
whose *Menú principal* goes back to the mode instead, and the result screen and the bar continue the mode
(`btn-mode-continue`, `btn-mode-next`). Each mode passes its games their starting player: a replay of a game whose
starting player came from the engine's own coin flip does not reproduce the shuffles after it.

## Expedition

Seven duels in a row with one deck. Each rival is a little stronger than the one before; every win improves the deck,
and a single defeat ends the run.

```
src/app/expedition.ts            the run, pure: rivals, duel setup, rewards, relics, validation
src/app/expeditionController.ts  plays the run's duels in the GameController, records their results, saves the run
src/ui/ExpeditionScreen.tsx      new run, map of rivals, card reward, swap, relic, result
src/ui/expeditionStore.ts        the run in localStorage under manaDuel.expedition
```

### A run

1. **Start**: pick one of the fourteen decks. The run's seed draws the seven rivals among the other thirteen; the last
   one is the boss.
2. **Duel**: the run's deck (id `expedition`, named after the deck it started from) against the rival's deck. The
   run's seed also gives each duel its seed and its starting player.
3. **Card reward**, after each win but the last: three cards to choose from, drawn among the nonland cards of the
   fourteen decks whose colors are all colors of the starting deck, never a fifth copy. Take one and swap it for a card
   of the deck, add it without taking one out (the deck grows), or skip.
4. **Relic**, after the third and sixth wins: one of three, kept for the rest of the run.
5. **End**: the run is won after the seventh win. A defeat, a concession included, ends it; a draw plays the same rival
   again.

| Duel | Rival's life | Rival's opening hand | AI win rate |
| --- | --- | --- | --- |
| 1 | 14 | 6 | 0.74 |
| 2 | 16 | 6 | 0.71 |
| 3 | 16 | 7 | 0.57 |
| 4 | 18 | 7 | 0.53 |
| 5 | 20 | 7 | 0.49 |
| 6 | 22 | 7 | 0.46 |
| 7, boss | 24 | 8 | 0.36 |

| Relic | Id | Effect in every duel | AI win rate against the boss |
| --- | --- | --- | --- |
| Amuleto de vigor | `vigor` | 25 life instead of 20 | 0.44 |
| Ojo del augur | `foresight` | an opening hand of eight cards (a mulligan draws eight too) | 0.45 |
| Estandarte del alba | `banner` | a 1/1 white Soldier token on the battlefield from the start | 0.49 |
| Mapa del cartógrafo | `cartographer` | one more copy of the deck's most common land on the battlefield from the start | — |
| Reloj de arena | `hourglass` | you start every duel | — |

Rivals' life and hands and the relics reach the engine as each player's `life`, `openingHand` and `battlefield`
(`docs/RULES.md` › Game).

### Tuning

The ladder is `RIVAL_LIFE` and `RIVAL_HAND` in `src/app/expedition.ts`. The win rates above are the AI with an
unchanged deck against each rival over 1960 games, every matchup ten times: measure a duel with
`npm run sim -- --games 1960 --quiet --life1 14 --hand1 6` and read `wins.p0` out of `games`; a relic adds
`--life0 25`, `--hand0 8` or `--start0 soldier_token`. A player who beats the AI as often as it beats itself finishes
about one run in a hundred with no reward at all; card rewards, relics and play better than the AI's are what make
a run winnable.

### The saved run

The run is saved on every change and checked when it is read (`isExpeditionRun`); a run it cannot read is dropped.
The duel in progress is saved with it, and **Continuar el duelo** loads it again exactly where it was.

### Extending

- A relic: its id in `RelicId`, an entry in `RELICS` (Spanish name and text), its perk in `playerPerks` (or the
  starting player in `startDuel`), its icon in `src/ui/components/ModeIcons.tsx`, and its case in
  `tests/app/expedition.test.ts` › turns relics into perks.
- More duels: `DUELS`, with one entry per duel in `RIVAL_LIFE` and `RIVAL_HAND`; relics come every `RELIC_EVERY` wins.
- A deck a run may start from or face: every deck of `DECK_LIST` already is.

Tests: `tests/app/expedition.test.ts` (the run and its controller), `tests/ui/expedition.test.tsx` (the screens),
`e2e/expedition.spec.ts` (a whole flow, a reward, a reload in the middle of a duel).

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

