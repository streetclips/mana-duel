# Game modes

Besides a single duel against the AI, Mana Duel has modes that span several games. Each one keeps its state in the
browser (`localStorage`) and plays its games through the same `GameController`, so every game of a mode is an
ordinary duel: the same engine, AI or LLM opponent, animations, log and replays.

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

- The run is saved on every change and checked when it is read (`isExpeditionRun`); a run it cannot read is dropped.
- The duel in progress is saved as its replay half a second after each action, when the page is hidden and when you
  leave the game; **Continuar el duelo** loads it again exactly where it was. The run passes each duel its starting
  player: a replay of a game whose starting player came from the engine's own coin flip does not reproduce the
  shuffles after it.
- The run's duel is followed by session: a new game, a scenario or a replay loaded meanwhile is never recorded as the
  run's result.

### Extending

- A relic: its id in `RelicId`, an entry in `RELICS` (Spanish name and text), its perk in `playerPerks` (or the
  starting player in `startDuel`), its icon in `src/ui/components/ExpeditionIcons.tsx`, and its case in
  `tests/app/expedition.test.ts` › turns relics into perks.
- More duels: `DUELS`, with one entry per duel in `RIVAL_LIFE` and `RIVAL_HAND`; relics come every `RELIC_EVERY` wins.
- A deck a run may start from or face: every deck of `DECK_LIST` already is.

Tests: `tests/app/expedition.test.ts` (the run and its controller), `tests/ui/expedition.test.tsx` (the screens),
`e2e/expedition.spec.ts` (a whole flow, a reward, a reload in the middle of a duel).
